import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { addonPaths, disableAddon, readState, recordInstall } from '@racehubos/shared/addons';
import { prisma } from './setup.js';
import { createExtras } from '../addons/extras.js';
import { AddonActionError, checkRepo, createAddonManager, pruneDataBackups } from '../addons/manager.js';
import { makeAddon, makeRoot, removeRoot, writeFile } from './helpers/addonFixtures.js';
import { git, makeRepo, release } from './helpers/gitRepos.js';

// Real git on local repositories; npm is faked: a build or an install takes no time here
let root;
let backupDir;
let npm;
let failBuild;
let catalogEntries;

beforeEach(() => {
  root = makeRoot();
  backupDir = path.join(root, 'db-old');
  failBuild = null;
  catalogEntries = [];
  npm = jest.fn(async (command) => {
    if (command === 'npm run build' && failBuild) {
      const stderr = failBuild();
      if (stderr) throw Object.assign(new Error('Command failed: npm run build'), { stderr });
    }
    return { stdout: '' };
  });
});
afterEach(() => removeRoot(root));

const backup = jest.fn(({ reason }) => {
  fs.mkdirSync(backupDir, { recursive: true });
  const file = path.join(backupDir, `2026-11-09_12-00-00_${reason}.db`);
  fs.writeFileSync(file, '');
  return file;
});
beforeEach(() => backup.mockClear());

const log = { error: jest.fn() };
const manager = () =>
  createAddonManager({
    rootDir: root,
    prisma,
    npm,
    backup,
    log,
    catalog: async () => ({ source: 'local', addons: catalogEntries }),
  });

async function run(action, params) {
  const steps = [];
  const prepared = await manager().prepare(action, params);
  await prepared.run((step) => steps.push(step));
  return { steps, addon: prepared.addon };
}

const addonDir = (id) => path.join(root, 'addons', id);
const manifestOf = (id) => JSON.parse(fs.readFileSync(path.join(addonDir(id), 'racehubos-addon.json'), 'utf-8'));
const builds = () => npm.mock.calls.filter(([command]) => command === 'npm run build').length;
const leftovers = () => fs.readdirSync(path.join(root, 'addons')).filter((name) => name.startsWith('.install-'));

describe('checkRepo', () => {
  test.each(['https://github.com/x/racehubos-a', 'git@github.com:x/a.git', '/home/x/a', ' https://x/a '])(
    '%s is a link',
    (repo) => {
      expect(checkRepo(repo)).toBe(repo.trim());
    }
  );

  test.each([undefined, '', '  ', '--upload-pack=touch x', 'https://x/a b'])('%s is not', (repo) => {
    expect(() => checkRepo(repo)).toThrow(AddonActionError);
  });
});

describe('install', () => {
  test('from the catalog: the highest tag, recorded, backed up and built', async () => {
    const repo = makeRepo(root, 'hello', ['0.1.0', '0.2.0'], { untagged: '0.3.0' });
    catalogEntries = [{ id: 'hello', repo, ref: null }];
    writeFile(root, 'addons/.data/other/data.db', 'x');

    const { steps, addon } = await run('install', { id: 'hello' });

    expect(addon).toBe('hello');
    expect(steps).toEqual(['download', 'backup', 'build']);
    expect(manifestOf('hello').version).toBe('0.2.0');
    expect(readState(root).installed.hello).toMatchObject({ source: 'catalog', repo, ref: 'v0.2.0', version: '0.2.0' });
    expect(backup).toHaveBeenCalledWith({ reason: 'addon-hello' });
    expect(fs.existsSync(path.join(backupDir, '2026-11-09_12-00-00_addon-hello.addons-data/other/data.db'))).toBe(true);
    expect(npm.mock.calls).toEqual([['npm run build', { cwd: root }]]);
    expect(leftovers()).toEqual([]);
  });

  test('a catalog pin holds the add-on back', async () => {
    const repo = makeRepo(root, 'hello', ['0.1.0', '0.2.0']);
    catalogEntries = [{ id: 'hello', repo, ref: 'v0.1.0' }];
    await run('install', { id: 'hello' });
    expect(manifestOf('hello').version).toBe('0.1.0');
    expect(readState(root).installed.hello.ref).toBe('v0.1.0');
  });

  test('from a link: the id comes from the manifest', async () => {
    const repo = makeRepo(root, 'linked', ['1.0.0']);
    const { addon } = await run('install', { repo });
    expect(addon).toBe('linked');
    expect(readState(root).installed.linked).toMatchObject({ source: 'link', repo, ref: 'v1.0.0' });
  });

  test('without tags, the default branch', async () => {
    const repo = makeRepo(root, 'fresh', [], { untagged: '0.0.1' });
    await run('install', { repo });
    expect(manifestOf('fresh').version).toBe('0.0.1');
    expect(readState(root).installed.fresh.ref).toBeNull();
  });

  test('its own dependencies are installed, without dev dependencies', async () => {
    const repo = makeRepo(root, 'deps', ['1.0.0'], { files: { 'package.json': { dependencies: { leftpad: '1' } } } });
    const { steps } = await run('install', { repo });
    expect(steps).toEqual(['download', 'backup', 'dependencies', 'build']);
    expect(npm).toHaveBeenCalledWith('npm install --omit=dev --no-audit --no-fund', { cwd: addonDir('deps') });
  });

  test('a package.json without dependencies installs nothing', async () => {
    const repo = makeRepo(root, 'plain', ['1.0.0'], { files: { 'package.json': { type: 'module' } } });
    await run('install', { repo });
    expect(builds()).toBe(1);
    expect(npm).toHaveBeenCalledTimes(1);
  });

  test.each([
    [{ id: 'nowhere' }, 404, 'not in the catalog'],
    [{}, 400, 'is required'],
    [{ repo: '-x' }, 400, 'not a repository link'],
  ])('refused before anything starts: %o', async (params, status, message) => {
    await expect(manager().prepare('install', params)).rejects.toMatchObject({
      status,
      message: expect.stringContaining(message),
    });
  });

  test('an installed add-on is not installed again', async () => {
    makeAddon(root, 'hello');
    catalogEntries = [{ id: 'hello', repo: 'https://x/hello.git', ref: null }];
    await expect(manager().prepare('install', { id: 'hello' })).rejects.toMatchObject({ status: 409 });

    const repo = makeRepo(root, 'hello', ['1.0.0']);
    await expect(run('install', { repo })).rejects.toMatchObject({ status: 409 });
    expect(leftovers()).toEqual([]);
  });

  test('a repository that is no add-on leaves nothing behind', async () => {
    const repo = makeRepo(root, 'broken', ['1.0.0'], { manifest: { version: 'one' } });
    await expect(run('install', { repo })).rejects.toMatchObject({
      status: 422,
      message: expect.stringContaining('semver'),
    });

    const empty = path.join(root, 'repos/empty');
    writeFile(empty, 'README.md', '#');
    git(empty, 'init', '--quiet');
    git(empty, 'add', '-A');
    git(empty, 'commit', '--quiet', '-m', 'readme');
    await expect(run('install', { repo: empty })).rejects.toMatchObject({ status: 422 });
    expect(leftovers()).toEqual([]);
    expect(backup).not.toHaveBeenCalled();
  });

  test('a catalog entry pointing at another add-on is refused', async () => {
    catalogEntries = [{ id: 'expected', repo: makeRepo(root, 'other', ['1.0.0']), ref: null }];
    await expect(run('install', { id: 'expected' })).rejects.toThrow('holds "other", not "expected"');
  });

  test('a build failing on the new add-on removes it and rebuilds without it', async () => {
    const repo = makeRepo(root, 'crashy', ['1.0.0']);
    let attempt = 0;
    failBuild = () => (++attempt === 1 ? 'error in addons/crashy/web/index.jsx' : null);
    await expect(run('install', { repo })).rejects.toThrow('build failed: error in addons/crashy/web/index.jsx');
    expect(fs.existsSync(addonDir('crashy'))).toBe(false);
    expect(readState(root)).toMatchObject({ installed: {}, disabled: {} });
    expect(builds()).toBe(3);
  });

  test('a build failing for another reason removes it too', async () => {
    const repo = makeRepo(root, 'suspect', ['1.0.0']);
    failBuild = () => 'out of memory';
    await expect(run('install', { repo })).rejects.toThrow('Command failed');
    expect(fs.existsSync(addonDir('suspect'))).toBe(false);
  });
});

describe('update', () => {
  async function installed(versions = ['0.1.0']) {
    const repo = makeRepo(root, 'hello', versions);
    catalogEntries = [{ id: 'hello', repo, ref: null }];
    await run('install', { id: 'hello' });
    npm.mockClear();
    backup.mockClear();
    return repo;
  }

  test('to the new highest tag', async () => {
    const repo = await installed();
    release(repo, 'hello', '0.2.0');
    const { steps } = await run('update', { id: 'hello' });
    expect(steps).toEqual(['download', 'backup', 'build']);
    expect(manifestOf('hello').version).toBe('0.2.0');
    expect(readState(root).installed.hello).toMatchObject({ source: 'catalog', repo, ref: 'v0.2.0', version: '0.2.0' });
    expect(backup).toHaveBeenCalledWith({ reason: 'addon-hello' });
  });

  test('to the catalog pin', async () => {
    const repo = await installed(['0.1.0', '0.2.0']);
    catalogEntries = [{ id: 'hello', repo, ref: 'v0.1.0' }];
    await run('update', { id: 'hello' });
    expect(manifestOf('hello').version).toBe('0.1.0');
  });

  test('without tags, the default branch', async () => {
    const repo = makeRepo(root, 'fresh', [], { untagged: '0.0.1' });
    await run('install', { repo });
    writeFile(repo, 'racehubos-addon.json', { id: 'fresh', name: 'fresh', version: '0.0.2' });
    git(repo, 'commit', '--quiet', '-am', 'next');
    await run('update', { id: 'fresh' });
    expect(manifestOf('fresh').version).toBe('0.0.2');
    expect(readState(root).installed.fresh.ref).toBeNull();
  });

  test('a failed build goes back to the version that worked, still enabled', async () => {
    const repo = await installed();
    release(repo, 'hello', '0.2.0');
    let attempt = 0;
    failBuild = () => (++attempt === 1 ? 'error in addons/hello/web/index.jsx' : null);
    await expect(run('update', { id: 'hello' })).rejects.toThrow('build failed');
    expect(manifestOf('hello').version).toBe('0.1.0');
    expect(readState(root).installed.hello.ref).toBe('v0.1.0');
    expect(readState(root).disabled.hello).toBeUndefined();
  });

  test('a disabled add-on stays disabled after a failed update', async () => {
    const repo = await installed();
    disableAddon(root, 'hello', 'by the user');
    release(repo, 'hello', '0.2.0', { manifest: { id: 'renamed' } });
    await expect(run('update', { id: 'hello' })).rejects.toThrow('the new version is "renamed"');
    expect(readState(root).disabled.hello.reason).toBe('by the user');
  });

  test.each([
    ['../x', 400],
    ['missing', 404],
  ])('%s cannot be updated', async (id, status) => {
    await expect(manager().prepare('update', { id })).rejects.toMatchObject({ status });
  });

  test("a developer's folder is never updated by the app", async () => {
    makeAddon(root, 'mine');
    await expect(manager().prepare('update', { id: 'mine' })).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining('never updates it'),
    });
  });
});

describe('enable and disable', () => {
  test('disable records the user, then builds', async () => {
    makeAddon(root, 'mine');
    const { steps } = await run('disable', { id: 'mine' });
    expect(steps).toEqual(['build']);
    expect(readState(root).disabled.mine.reason).toBe('disabled by the user');
    expect(builds()).toBe(1);
  });

  test('enable, then build', async () => {
    makeAddon(root, 'mine');
    disableAddon(root, 'mine', 'by the user');
    await run('enable', { id: 'mine' });
    expect(readState(root).disabled.mine).toBeUndefined();
  });

  test('an add-on that breaks the build is disabled again', async () => {
    makeAddon(root, 'mine');
    disableAddon(root, 'mine', 'by the user');
    let attempt = 0;
    failBuild = () => (++attempt === 1 ? 'error in addons/mine/web/index.jsx' : null);
    await expect(run('enable', { id: 'mine' })).rejects.toThrow('build failed');
    expect(readState(root).disabled.mine.reason).toContain('build failed');
  });

  test('an invalid add-on cannot be enabled', async () => {
    writeFile(root, 'addons/broken/racehubos-addon.json', { id: 'broken' });
    await expect(manager().prepare('enable', { id: 'broken' })).rejects.toMatchObject({ status: 422 });
  });

  test('an unknown action', async () => {
    await expect(manager().prepare('explode', {})).rejects.toMatchObject({ status: 400 });
  });
});

describe('uninstall', () => {
  async function installed() {
    catalogEntries = [{ id: 'hello', repo: makeRepo(root, 'hello', ['0.1.0']), ref: null }];
    await run('install', { id: 'hello' });
  }

  test('removes the folder and keeps the data', async () => {
    await installed();
    writeFile(root, 'addons/.data/hello/hello.db', 'x');
    const car = await prisma.car.create({ data: { brand: 'Porsche', model: '911' } });
    await createExtras(prisma, 'hello').set('car', car.id, { km: 3 });

    const { steps } = await run('uninstall', { id: 'hello' });

    expect(steps).toEqual(['backup', 'build']);
    expect(fs.existsSync(addonDir('hello'))).toBe(false);
    expect(readState(root)).toMatchObject({ installed: {}, purge: [] });
    expect(fs.existsSync(path.join(addonPaths(root).dataDir, 'hello/hello.db'))).toBe(true);
    expect(await prisma.carExtra.count({ where: { addon: 'hello' } })).toBe(1);
  });

  test('with its data: the extra rows go now, the data folder at the restart', async () => {
    await installed();
    const car = await prisma.car.create({ data: { brand: 'Porsche', model: '911' } });
    await createExtras(prisma, 'hello').set('car', car.id, { km: 3 });
    await createExtras(prisma, 'other').set('car', car.id, { km: 4 });

    await run('uninstall', { id: 'hello', deleteData: true });

    expect(await prisma.carExtra.count({ where: { addon: 'hello' } })).toBe(0);
    expect(await prisma.carExtra.count({ where: { addon: 'other' } })).toBe(1);
    expect(readState(root).purge).toEqual(['hello']);
  });

  test("a developer's folder is never removed by the app", async () => {
    makeAddon(root, 'mine');
    await expect(manager().prepare('uninstall', { id: 'mine' })).rejects.toMatchObject({ status: 409 });
  });
});

describe('list', () => {
  test('add-ons with their updates, the catalog and the override stacks', async () => {
    const helloRepo = makeRepo(root, 'hello', ['0.1.0']);
    const pinnedRepo = makeRepo(root, 'pinned', ['0.1.0', '0.2.0']);
    catalogEntries = [
      { id: 'hello', repo: helloRepo, ref: null },
      { id: 'pinned', repo: pinnedRepo, ref: 'v0.1.0' },
      { id: 'market', repo: 'https://x/market.git', ref: null },
    ];
    await run('install', { id: 'hello' });
    await run('install', { id: 'pinned' });
    release(helloRepo, 'hello', '0.2.0');
    catalogEntries[1] = { ...catalogEntries[1], ref: 'v0.2.0' };

    const core = 'packages/frontend/src/Leaderboard.jsx';
    writeFile(root, core, 'export default 1');
    makeAddon(root, 'mine', { files: { [`overrides/${core}`]: 'export default 2', 'overrides/x/Missing.jsx': '' } });
    recordInstall(root, 'gone', { source: 'link', repo: path.join(root, 'nowhere') });
    makeAddon(root, 'gone');
    writeFile(root, 'addons/broken/racehubos-addon.json', { id: 'broken' });

    const data = await manager().list();

    const byId = Object.fromEntries(data.addons.map((addon) => [addon.id, addon]));
    expect(Object.keys(byId).sort()).toEqual(['broken', 'gone', 'hello', 'mine', 'pinned']);
    expect(byId.hello).toMatchObject({ enabled: true, update: { ref: 'v0.2.0' }, installed: { ref: 'v0.1.0' } });
    expect(byId.pinned.update).toEqual({ ref: 'v0.2.0' });
    expect(byId.mine).toMatchObject({ installed: null, update: null });
    expect(byId.gone.update).toBeNull();
    expect(byId.broken).toMatchObject({ valid: false, enabled: false });
    expect(byId.broken.errors).toContain('version must be semver (e.g. "1.2.0")');

    expect(data.catalog).toEqual({
      source: 'local',
      addons: [
        expect.objectContaining({ id: 'hello', installed: true }),
        expect.objectContaining({ id: 'pinned', installed: true }),
        expect.objectContaining({ id: 'market', installed: false }),
      ],
    });
    expect(data.overrides).toEqual({
      stacks: [{ file: core, layers: ['mine'] }],
      replacements: [{ file: core, id: 'mine', hides: [] }],
      orphans: [{ id: 'mine', file: 'x/Missing.jsx' }],
    });
  });

  test('an add-on at its pin or its latest tag has no update', async () => {
    const repo = makeRepo(root, 'hello', ['0.1.0']);
    catalogEntries = [{ id: 'hello', repo, ref: null }];
    await run('install', { id: 'hello' });
    expect((await manager().list()).addons[0].update).toBeNull();
    catalogEntries = [{ id: 'hello', repo, ref: 'v0.1.0' }];
    expect((await manager().list()).addons[0].update).toBeNull();
  });
});

test('reads the catalog shipped in addons/ by default', async () => {
  writeFile(root, 'addons/catalog.json', { addons: [{ id: 'market', repo: 'https://x/market.git' }] });
  process.env.RACEHUBOS_CATALOG_URL = '';
  try {
    const data = await createAddonManager({ rootDir: root, prisma }).list();
    expect(data.catalog).toEqual({ source: 'local', addons: [expect.objectContaining({ id: 'market' })] });
  } finally {
    delete process.env.RACEHUBOS_CATALOG_URL;
  }
});

describe('pruneDataBackups', () => {
  test('keeps the data copies whose database backup is still there', () => {
    writeFile(backupDir, 'a.db');
    writeFile(backupDir, 'a.addons-data/x.db');
    writeFile(backupDir, 'b.addons-data/x.db');
    pruneDataBackups(backupDir);
    expect(fs.readdirSync(backupDir).sort()).toEqual(['a.addons-data', 'a.db']);
  });
});
