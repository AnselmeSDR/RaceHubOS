import { jest } from '@jest/globals';
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { createResolveHook, initialize, loadOverrides, registerAddonHooks, resolve } from '../addons/hooks.js';
import { makeAddon, makeRoot, removeRoot, writeFile } from './helpers/addonFixtures.js';

const hooksUrl = pathToFileURL(path.resolve(import.meta.dirname, '../addons/hooks.js')).href;
const preload = path.resolve(import.meta.dirname, '../addons/preload.js');
const url = (file) => pathToFileURL(file).href;

// Runs node in a child process: hooks registered here would stay in the Jest process
function runNode(args, env = {}) {
  const { NODE_OPTIONS: _ignored, ...base } = process.env;
  const child = spawnSync(process.execPath, args, { env: { ...base, ...env }, encoding: 'utf-8' });
  if (child.status !== 0) throw new Error(child.stderr);
  return { stdout: child.stdout.trim(), stderr: child.stderr.trim() };
}

let root;
beforeEach(() => {
  root = makeRoot();
});
afterEach(() => removeRoot(root));

// A core module, a core entry using it, and two add-ons wrapping it
function setupRepository() {
  const core = writeFile(
    root,
    'packages/backend/src/board.js',
    "export default () => ['core'];\nexport const name = 'board';"
  );
  writeFile(root, 'packages/backend/src/helper.js', "export const helper = 'helper from the core folder';");
  const main = writeFile(
    root,
    'packages/backend/src/main.js',
    "import board, { name } from './board.js';\nconsole.log(JSON.stringify({ rows: board(), name }));"
  );
  const sectors = makeAddon(root, 'sectors', {
    manifest: { order: 100 },
    files: {
      'overrides/packages/backend/src/board.js': [
        "export * from '@base';",
        "import base from '@base';",
        "import { helper } from './helper.js';",
        "import label from '@addon/server/label.js';",
        'export default () => [...base(), label, helper];',
      ].join('\n'),
      'server/label.js': "export default 'sectors';",
    },
  });
  makeAddon(root, 'pits', {
    manifest: { order: 200 },
    files: {
      'overrides/packages/backend/src/board.js':
        "export * from '@base';\nimport base from '@base';\nexport default () => [...base(), 'pits'];",
    },
  });
  const layer = (dir) => path.join(dir, 'overrides/packages/backend/src/board.js');
  return { core, main, sectorsLayer: layer(sectors), pitsLayer: layer(path.join(root, 'addons/pits')), sectors };
}

describe('createResolveHook', () => {
  const nextResolve = jest.fn(async (specifier, context) => ({
    url: specifier.startsWith('file:') ? specifier : new URL(specifier, context.parentURL).href,
    format: 'module',
  }));
  beforeEach(() => nextResolve.mockClear());

  test('@base is the layer below, the core file at the bottom', async () => {
    const { core, sectorsLayer, pitsLayer } = setupRepository();
    const resolve = createResolveHook(loadOverrides(root).resolver);
    expect(await resolve('@base', { parentURL: url(pitsLayer) }, nextResolve)).toEqual({
      url: url(sectorsLayer),
      shortCircuit: true,
    });
    expect((await resolve('@base', { parentURL: url(sectorsLayer) }, nextResolve)).url).toBe(url(core));
    expect(nextResolve).not.toHaveBeenCalled();
  });

  test('@base outside an override is an error', async () => {
    const { main } = setupRepository();
    const resolve = createResolveHook(loadOverrides(root).resolver);
    await expect(resolve('@base', { parentURL: url(main) }, nextResolve)).rejects.toThrow(
      '"@base" can only be imported from an override'
    );
    await expect(resolve('@base', { parentURL: 'data:text/javascript,' }, nextResolve)).rejects.toThrow(
      '(in data:text/javascript,)'
    );
  });

  test('@addon/ is the importing add-on folder', async () => {
    const { sectorsLayer, sectors } = setupRepository();
    const resolve = createResolveHook(loadOverrides(root).resolver);
    const resolved = await resolve('@addon/server/label.js', { parentURL: url(sectorsLayer) }, nextResolve);
    expect(fileURLToPath(resolved.url)).toBe(path.join(sectors, 'server/label.js'));
  });

  test('@addon/ outside an add-on is an error', async () => {
    const { main } = setupRepository();
    const resolve = createResolveHook(loadOverrides(root).resolver);
    await expect(resolve('@addon/x.js', { parentURL: url(main) }, nextResolve)).rejects.toThrow(
      '"@addon/x.js" can only be imported from an add-on'
    );
    await expect(resolve('@addon/x.js', {}, nextResolve)).rejects.toThrow('(in undefined)');
  });

  test('a relative import in an override starts from the core file folder', async () => {
    const { sectorsLayer } = setupRepository();
    const resolve = createResolveHook(loadOverrides(root).resolver);
    const resolved = await resolve('./helper.js', { parentURL: url(sectorsLayer) }, nextResolve);
    expect(fileURLToPath(resolved.url)).toBe(path.join(root, 'packages/backend/src/helper.js'));
  });

  test('an import landing on an overridden file gets the top of the stack', async () => {
    const { main, pitsLayer } = setupRepository();
    const resolve = createResolveHook(loadOverrides(root).resolver);
    expect(await resolve('./board.js', { parentURL: url(main) }, nextResolve)).toEqual({
      url: url(pitsLayer),
      format: 'module',
    });
    expect((await resolve('./helper.js', { parentURL: url(main) }, nextResolve)).url).toBe(
      url(path.join(root, 'packages/backend/src/helper.js'))
    );
  });

  test('built-in and package imports pass through', async () => {
    const resolve = createResolveHook(loadOverrides(root).resolver);
    const next = async () => ({ url: 'node:fs' });
    expect(await resolve('fs', { parentURL: undefined }, next)).toEqual({ url: 'node:fs' });
  });
});

describe('hooks thread entry points', () => {
  test('initialize reads the add-ons of the root, resolve applies them', async () => {
    const { main, pitsLayer } = setupRepository();
    initialize({ rootDir: root });
    const next = async (specifier, context) => ({ url: new URL(specifier, context.parentURL).href });
    expect((await resolve('./board.js', { parentURL: url(main) }, next)).url).toBe(url(pitsLayer));
  });

  test('no add-on, nothing registered', () => {
    expect(registerAddonHooks(root)).toBe(false);
  });
});

describe('hooks in a real Node process', () => {
  const runWithHooks = (main) => {
    const register = writeFile(
      root,
      'register.mjs',
      `import { registerAddonHooks } from ${JSON.stringify(hooksUrl)};\n` +
        `console.error(registerAddonHooks(${JSON.stringify(root)}) ? 'registered' : 'skipped');`
    );
    return runNode(['--import', url(register), main]);
  };

  test('every layer wraps the one below, with @addon/ and relative imports', () => {
    const { main } = setupRepository();
    const { stdout, stderr } = runWithHooks(main);
    expect(stderr).toBe('registered');
    expect(JSON.parse(stdout)).toEqual({
      rows: ['core', 'sectors', 'helper from the core folder', 'pits'],
      name: 'board',
    });
  });

  test('without add-ons, no hooks and the core as it is', () => {
    const main = writeFile(root, 'main.mjs', "console.log('core only');");
    expect(runWithHooks(main)).toEqual({ stdout: 'core only', stderr: 'skipped' });
  });

  test('preload.js wraps the real core from the add-ons folder in use', () => {
    const addonsDir = path.join(root, 'addons');
    makeAddon(root, 'names', {
      files: {
        'overrides/packages/backend/src/lib/sessionNames.js': [
          "export * from '@base';",
          "import { sessionName as base } from '@base';",
          "export const sessionName = (type, names) => base(type, names) + ' (from an add-on)';",
        ].join('\n'),
      },
    });
    const sessionNames = url(path.resolve(import.meta.dirname, '../lib/sessionNames.js'));
    const output = runNode(
      [
        '--import',
        preload,
        '--input-type=module',
        '-e',
        `import { sessionName } from ${JSON.stringify(sessionNames)};\nconsole.log(sessionName('race'))`,
      ],
      { RACEHUBOS_ADDONS_DIR: addonsDir }
    );
    expect(output.stdout).toBe('Race (from an add-on)');
  });
});
