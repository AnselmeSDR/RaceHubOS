import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { disableAddon, readState } from '@racehubos/shared/addons';
import { blames, buildApp, errorSummary, runNpm } from '../addons/build.js';
import { CATALOG_URL, parseCatalog, readCatalog } from '../addons/catalog.js';
import { highestVersionTag, latestTag, runGit } from '../addons/git.js';
import { makeAddon, makeRoot, removeRoot, writeFile } from './helpers/addonFixtures.js';
import { makeRepo } from './helpers/gitRepos.js';

let root;
beforeEach(() => {
  root = makeRoot();
});
afterEach(() => removeRoot(root));

describe('highestVersionTag', () => {
  test('the highest vX.Y.Z, compared as versions, pre-releases and other tags left out', () => {
    const output = [
      'a1\trefs/tags/v0.9.0',
      'a2\trefs/tags/v0.10.0',
      'a3\trefs/tags/v1.0.0-beta',
      'a4\trefs/tags/latest',
      'a5\trefs/tags/v0.2.0',
      '',
    ].join('\n');
    expect(highestVersionTag(output)).toBe('v0.10.0');
  });

  test('no version tag', () => {
    expect(highestVersionTag('')).toBeNull();
    expect(highestVersionTag('a1\trefs/tags/release')).toBeNull();
  });
});

describe('latestTag', () => {
  test('reads the tags of a real repository', async () => {
    const repo = makeRepo(root, 'hello', ['0.1.0', '0.2.0']);
    expect(await latestTag(repo)).toBe('v0.2.0');
  });

  test('runGit fails on a repository that does not exist', async () => {
    await expect(runGit(['ls-remote', path.join(root, 'nowhere')])).rejects.toThrow();
  });
});

describe('parseCatalog', () => {
  test('keeps valid entries, the first of a repeated id, with defaults', () => {
    const raw = {
      addons: [
        { id: 'planner', repo: 'https://x/planner.git', name: { en: 'Planner' }, description: 'Draw' },
        { id: 'planner', repo: 'https://x/other.git' },
        { id: 'pinned', repo: 'https://x/pinned.git', ref: 'v1.0.0' },
        { id: 'Bad Id', repo: 'https://x' },
        { id: 'no-repo' },
        { id: 'option', repo: '--upload-pack=touch x' },
        { id: 'spaced', repo: 'https://x/a b' },
        { id: 'bad-ref', repo: 'https://x/r.git', ref: '-x' },
        null,
      ],
    };
    expect(parseCatalog(raw)).toEqual([
      { id: 'planner', repo: 'https://x/planner.git', ref: null, name: { en: 'Planner' }, description: 'Draw' },
      { id: 'pinned', repo: 'https://x/pinned.git', ref: 'v1.0.0', name: 'pinned', description: null },
    ]);
  });

  test('anything else is an empty catalog', () => {
    expect(parseCatalog(null)).toEqual([]);
    expect(parseCatalog({ addons: 'x' })).toEqual([]);
  });
});

describe('readCatalog', () => {
  const remote = { addons: [{ id: 'remote', repo: 'https://x/remote.git' }] };
  const local = { addons: [{ id: 'local', repo: 'https://x/local.git' }] };
  const ok = (body) => async () => ({ ok: true, json: async () => body });

  test('from GitHub first', async () => {
    writeFile(root, 'addons/catalog.json', local);
    const fetchImpl = jest.fn(ok(remote));
    const catalog = await readCatalog(root, { url: CATALOG_URL, fetchImpl });
    expect(catalog).toEqual({ source: 'remote', addons: [expect.objectContaining({ id: 'remote' })] });
    expect(fetchImpl).toHaveBeenCalledWith(CATALOG_URL, expect.objectContaining({ signal: expect.any(AbortSignal) }));
  });

  test.each([
    ['GitHub answers an error', async () => ({ ok: false })],
    [
      'GitHub cannot be reached',
      async () => {
        throw new Error('offline');
      },
    ],
  ])('the local copy when %s', async (_case, fetchImpl) => {
    writeFile(root, 'addons/catalog.json', local);
    expect(await readCatalog(root, { url: CATALOG_URL, fetchImpl })).toEqual({
      source: 'local',
      addons: [expect.objectContaining({ id: 'local' })],
    });
  });

  test('an empty address reads only the local copy', async () => {
    writeFile(root, 'addons/catalog.json', local);
    const fetchImpl = jest.fn();
    expect((await readCatalog(root, { url: '', fetchImpl })).source).toBe('local');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test('RACEHUBOS_CATALOG_URL replaces the address', async () => {
    process.env.RACEHUBOS_CATALOG_URL = '';
    try {
      const fetchImpl = jest.fn();
      await readCatalog(root, { fetchImpl });
      expect(fetchImpl).not.toHaveBeenCalled();
    } finally {
      delete process.env.RACEHUBOS_CATALOG_URL;
    }
  });

  test('no catalog at all', async () => {
    expect(await readCatalog(root, { url: '' })).toEqual({ source: 'none', addons: [] });
  });
});

describe('blames and errorSummary', () => {
  const addon = (id) => ({ id, dir: path.join(root, 'addons', id) });
  const addonsDir = () => path.join(root, 'addons');

  test('a path inside the add-on, with / or \\', () => {
    fs.mkdirSync(addon('planner').dir, { recursive: true });
    expect(blames('error in ../../addons/planner/web/index.jsx', addon('planner'), addonsDir())).toBe(true);
    expect(blames('error in C:\\race\\addons\\planner\\web\\x.jsx', addon('planner'), addonsDir())).toBe(true);
    expect(blames('error in addons/planner-pro/web/x.jsx', addon('planner'), addonsDir())).toBe(false);
  });

  test('the real path of a linked add-on', () => {
    const elsewhere = makeRoot('racehubos-linked-');
    try {
      const copy = makeAddon(elsewhere, 'linked');
      fs.mkdirSync(addonsDir());
      fs.symlinkSync(copy, addon('linked').dir, 'dir');
      expect(blames(`error in ${copy}/web/x.jsx`, addon('linked'), addonsDir())).toBe(true);
    } finally {
      removeRoot(elsewhere);
    }
  });

  test('the summary is the first error line, or the first line', () => {
    expect(errorSummary('vite v8\n\nx Build failed\nerror: missing export\nmore')).toBe('error: missing export');
    expect(errorSummary('first\nsecond')).toBe('first');
    expect(errorSummary('')).toBe('unknown error');
    expect(errorSummary('error ' + 'x'.repeat(400))).toHaveLength(300);
  });
});

test('runNpm runs npm through the shell', async () => {
  const { stdout } = await runNpm('npm --version', { cwd: root });
  expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
});

describe('buildApp', () => {
  const log = { error: jest.fn() };
  const failure = (stderr) => Object.assign(new Error('Command failed: npm run build'), { stderr });

  test('a passing build disables nothing', async () => {
    const npm = jest.fn(async () => ({ stdout: '' }));
    expect(await buildApp(root, { npm, log })).toEqual({ disabled: [] });
    expect(npm).toHaveBeenCalledWith('npm run build', { cwd: root });
  });

  test('disables each add-on the build blames, then passes', async () => {
    makeAddon(root, 'planner');
    makeAddon(root, 'timing');
    makeAddon(root, 'quiet');
    const npm = jest
      .fn()
      .mockRejectedValueOnce(failure('error: in addons/timing/web/index.jsx'))
      .mockRejectedValueOnce(failure('error: in addons/planner/web/index.jsx'))
      .mockResolvedValueOnce({ stdout: '' });
    expect(await buildApp(root, { npm, log })).toEqual({ disabled: ['timing', 'planner'] });
    expect(readState(root).disabled.timing.reason).toBe('build failed: error: in addons/timing/web/index.jsx');
    expect(readState(root).disabled.quiet).toBeUndefined();
    expect(log.error).toHaveBeenCalledWith(expect.stringContaining('timing disabled'));
  });

  test('a failure no enabled add-on is to blame is the core build failing', async () => {
    makeAddon(root, 'planner');
    disableAddon(root, 'planner', 'off');
    const npm = jest.fn().mockRejectedValue(failure('error: in addons/planner/web/index.jsx'));
    await expect(buildApp(root, { npm, log })).rejects.toThrow('Command failed');
    expect(npm).toHaveBeenCalledTimes(1);
  });
});
