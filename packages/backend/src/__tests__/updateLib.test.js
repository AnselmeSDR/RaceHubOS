import { jest } from '@jest/globals';
import { exec } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { promisify } from 'util';
import { applyUpdate, checkForUpdate, fetchMain, localVersion } from '../lib/update.js';
import { git } from './helpers/gitRepos.js';

let rootDir;

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'racehubos-update-'));
  fs.writeFileSync(path.join(rootDir, 'package.json'), JSON.stringify({ version: '1.2.0' }));
});
afterEach(() => {
  fs.rmSync(rootDir, { recursive: true, force: true });
  jest.restoreAllMocks();
});

describe('checking for an update', () => {
  const remote = (version, ok = true) => jest.fn(async () => ({ ok, json: async () => ({ version }) }));

  test('a newer version on GitHub is an update, an older one is not', async () => {
    const fetch = remote('1.3.0');
    expect(await checkForUpdate(rootDir, { fetch })).toEqual({
      currentVersion: '1.2.0',
      latestVersion: '1.3.0',
      updateAvailable: true,
    });
    expect(fetch.mock.calls[0][0]).toMatch(/AnselmeSDR\/RaceHubOS\/contents\/package\.json$/);
    expect((await checkForUpdate(rootDir, { fetch: remote('1.1.9') })).updateAvailable).toBe(false);
  });

  test('GitHub out of reach is no update, with the reason', async () => {
    expect(await checkForUpdate(rootDir, { fetch: remote(null, false) })).toEqual({
      currentVersion: '1.2.0',
      latestVersion: null,
      updateAvailable: false,
      error: 'Impossible de contacter GitHub',
    });
    const offline = async () => {
      throw new Error('getaddrinfo ENOTFOUND');
    };
    expect((await checkForUpdate(rootDir, { fetch: offline })).error).toBe('getaddrinfo ENOTFOUND');
  });
});

describe('applying an update', () => {
  let commands, emitted, failOn;

  beforeEach(() => {
    commands = [];
    emitted = [];
    failOn = {};
  });

  /** Records each command; `git pull` brings version 1.3.0. */
  const run = async (command, { cwd }) => {
    commands.push([command, path.relative(rootDir, cwd)]);
    const failure = failOn[command];
    if (failure) {
      delete failOn[command]; // a command fails once: the rollback runs it again
      throw new Error(failure);
    }
    if (command === 'git pull origin main --ff-only') {
      fs.writeFileSync(path.join(rootDir, 'package.json'), JSON.stringify({ version: '1.3.0' }));
    }
    return { stdout: command === 'git rev-parse HEAD' ? 'abc123def456\n' : '' };
  };
  const apply = (overrides = {}) =>
    applyUpdate({
      rootDir,
      run,
      emit: (...progress) => emitted.push(progress),
      backup: () => '/backups/update.db',
      build: async () => ({ disabled: [] }),
      refreshInstaller: () => ({ copied: true, target: '/Desktop/install.bat' }),
      ...overrides,
    });

  test('backs up, pulls, installs, builds, migrates, then returns the new version', async () => {
    const build = jest.fn(async () => ({ disabled: ['broken-addon'] }));
    expect(await apply({ build })).toBe('1.3.0');
    expect(commands).toEqual([
      ['git rev-parse HEAD', ''],
      ['git fetch origin main', ''],
      ['git checkout -- .', ''],
      ['git pull origin main --ff-only', ''],
      ['npm install --legacy-peer-deps', ''],
      ['npx prisma generate', 'packages/backend'],
      ['node scripts/migrate.js', 'packages/backend'],
    ]);
    expect(build).toHaveBeenCalledWith(rootDir);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('broken-addon'));
    expect(emitted.map(([step]) => step)).toEqual([1, 2, 3, 4, 5]);
    expect(console.log).toHaveBeenCalledWith('[update] Installeur du bureau mis à jour: /Desktop/install.bat');
  });

  test('the Windows launchers are rewritten for the new version', async () => {
    fs.writeFileSync(path.join(rootDir, 'RaceHubOS.bat.template'), 'title __VERSION__\ncd /d __TARGET_DIR__');
    fs.writeFileSync(path.join(rootDir, 'RaceHubOS-v1.2.0.bat'), 'old');
    fs.writeFileSync(path.join(rootDir, 'other.bat'), 'kept');
    await apply();
    expect(fs.readFileSync(path.join(rootDir, 'RaceHubOS-v1.2.0.bat'), 'utf-8')).toBe(
      `title v1.3.0\ncd /d ${rootDir.replace(/\//g, '\\')}`
    );
    expect(fs.readFileSync(path.join(rootDir, 'other.bat'), 'utf-8')).toBe('kept');
    expect(emitted.map(([step]) => step)).toContain(6);
  });

  test('what may fail without harm only warns', async () => {
    failOn = {
      'git checkout -- .': 'nothing to discard',
      'npx prisma generate': 'locked',
      'node scripts/migrate.js': 'retried at startup',
    };
    const refreshInstaller = () => {
      throw new Error('no desktop');
    };
    expect(await apply({ backup: () => null, refreshInstaller })).toBe('1.3.0');
    expect(console.warn).toHaveBeenCalledWith('[update] Installeur du bureau non mis à jour:', 'no desktop');
  });

  test('a failed install or build rolls back to the previous commit', async () => {
    failOn = { 'npm install --legacy-peer-deps': 'ETARGET' };
    await expect(apply()).rejects.toThrow('Mise à jour annulée, version précédente restaurée (ETARGET)');
    expect(commands.slice(4).map(([command]) => command)).toEqual([
      'npm install --legacy-peer-deps',
      'git reset --hard abc123def456',
      'npm install --legacy-peer-deps',
      'npm run build',
    ]);

    commands = [];
    failOn = {};
    const build = async () => {
      throw new Error('vite failed');
    };
    await expect(apply({ build })).rejects.toThrow('(vite failed)');
    expect(commands.slice(5).map(([command]) => command)).toEqual([
      'git reset --hard abc123def456',
      'npm install --legacy-peer-deps',
      'npm run build',
    ]);
  });

  test('a failed rollback says to run the installer', async () => {
    failOn = { 'npm install --legacy-peer-deps': 'ETARGET', 'git reset --hard abc123def456': 'index.lock' };
    await expect(apply()).rejects.toThrow('index.lock');
    expect(emitted.at(-1)).toEqual([0, "Restauration impossible: index.lock. Relancez l'installeur.", 'error']);
  });

  test('a failed download stops before touching anything', async () => {
    failOn = { 'git fetch origin main': 'offline' };
    await expect(apply()).rejects.toThrow('offline');
    expect(commands.map(([command]) => command)).toEqual(['git rev-parse HEAD', 'git fetch origin main']);
    expect(localVersion(rootDir)).toBe('1.2.0');
  });
});

describe('a checkout and GitHub main', () => {
  let origin, checkout;

  const commitVersion = (dir, version) => {
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ version }));
    git(dir, 'add', '-A');
    git(dir, 'commit', '--quiet', '-m', `version ${version}`);
  };
  // Real git; npm, build and migration do nothing
  const execAsync = promisify(exec);
  const run = async (command, options) => (command.startsWith('git ') ? execAsync(command, options) : { stdout: '' });
  const update = (replaceLocal) =>
    applyUpdate({
      rootDir: checkout,
      replaceLocal,
      run,
      backup: () => null,
      build: async () => ({ disabled: [] }),
      refreshInstaller: () => ({ copied: false }),
    });

  beforeEach(() => {
    origin = path.join(rootDir, 'origin');
    checkout = path.join(rootDir, 'checkout');
    fs.mkdirSync(origin);
    git(origin, 'init', '--quiet', '--initial-branch=main');
    commitVersion(origin, '1.2.0');
    git(rootDir, 'clone', '--quiet', origin, checkout);
  });

  test('a checkout behind main has not diverged', async () => {
    commitVersion(origin, '1.3.0');
    expect(await fetchMain(checkout)).toEqual({ diverged: false });
    expect(await update(false)).toBe('1.3.0');
  });

  test('main rewritten upstream: the checkout has diverged, only replacing its code follows main', async () => {
    git(origin, 'commit', '--quiet', '--amend', '-m', 'version 1.2.0, rewritten');
    commitVersion(origin, '1.3.0');
    fs.writeFileSync(path.join(checkout, 'dev.db'), 'laps');

    expect(await fetchMain(checkout)).toEqual({ diverged: true });
    await expect(update(false)).rejects.toThrow(/fast-forward/);
    expect(localVersion(checkout)).toBe('1.2.0');

    expect(await update(true)).toBe('1.3.0');
    expect(git(checkout, 'rev-parse', 'HEAD')).toBe(git(origin, 'rev-parse', 'HEAD'));
    expect(fs.readFileSync(path.join(checkout, 'dev.db'), 'utf-8')).toBe('laps');
  });

  test('a git failure is not a divergence', async () => {
    fs.rmSync(origin, { recursive: true });
    await expect(fetchMain(checkout)).rejects.toThrow(/git fetch origin main/);

    const brokenHistory = async (command) => {
      if (command.startsWith('git merge-base')) throw Object.assign(new Error('bad object HEAD'), { code: 128 });
      return { stdout: '' };
    };
    await expect(fetchMain(checkout, { run: brokenHistory })).rejects.toThrow('bad object HEAD');
  });
});
