import fs from 'fs';
import path from 'path';
import {
  addonPaths,
  buildOverrideStacks,
  compareAddons,
  createOverrideResolver,
  DEFAULT_ORDER,
  disableAddon,
  discoverAddons,
  enableAddon,
  enabledAddons,
  findReplacements,
  forgetAddon,
  importsBase,
  isLocalizedText,
  localized,
  readState,
  realPosix,
  recordInstall,
  toPosix,
  validateManifest,
  writeState,
} from '@racehubos/shared/addons';
import { localized as localizedFromIndex } from '@racehubos/shared';
import { makeAddon, makeRoot, removeRoot, writeFile } from './helpers/addonFixtures.js';

const valid = { id: 'track-planner', name: 'Track planner', version: '0.1.0' };

describe('validateManifest', () => {
  test('accepts a minimal manifest and defaults the order', () => {
    const { manifest, errors } = validateManifest(valid, 'track-planner');
    expect(errors).toEqual([]);
    expect(manifest).toEqual({ ...valid, order: DEFAULT_ORDER });
  });

  test('keeps an explicit order and extra fields', () => {
    const { manifest } = validateManifest({ ...valid, order: 5, author: 'Andi' });
    expect(manifest.order).toBe(5);
    expect(manifest.author).toBe('Andi');
  });

  test.each([null, [], 'text', 42])('rejects a manifest that is not an object: %p', (raw) => {
    expect(validateManifest(raw)).toEqual({ manifest: null, errors: ['the manifest must be a JSON object'] });
  });

  test.each(['Track', 'track planner', '-track', 'track-', 'track--planner', '', 3])('rejects the id %p', (id) => {
    const { manifest, errors } = validateManifest({ ...valid, id });
    expect(manifest).toBeNull();
    expect(errors[0]).toMatch(/kebab-case/);
  });

  test('the id must match the folder name', () => {
    expect(validateManifest(valid, 'planner').errors).toEqual([
      'id "track-planner" must match the folder name "planner"',
    ]);
  });

  test.each([undefined, '', '  ', {}, { en: '' }, { en: 3 }, ['a']])('rejects the name %p', (name) => {
    expect(validateManifest({ ...valid, name }).errors[0]).toMatch(/^name is required/);
  });

  test('accepts a name per language', () => {
    expect(validateManifest({ ...valid, name: { en: 'Planner', fr: 'Éditeur' } }).errors).toEqual([]);
  });

  test.each(['1.0', 'v1.0.0', '1.0.0.0', 1, undefined])('rejects the version %p', (version) => {
    expect(validateManifest({ ...valid, version }).errors[0]).toMatch(/^version must be semver/);
  });

  test.each(['1.0.0-beta.1', '2.3.4+build.5', '10.20.30'])('accepts the version %p', (version) => {
    expect(validateManifest({ ...valid, version }).errors).toEqual([]);
  });

  test('checks the description only when present', () => {
    expect(validateManifest({ ...valid, description: { en: 'Draw' } }).errors).toEqual([]);
    expect(validateManifest({ ...valid, description: 5 }).errors[0]).toMatch(/^description/);
  });

  test.each(['1', Infinity, NaN, null])('rejects the order %p', (order) => {
    expect(validateManifest({ ...valid, order }).errors).toEqual(['order must be a number']);
  });

  test('reports every problem at once', () => {
    expect(validateManifest({ id: 'X', version: 'x', order: 'y' }).errors).toHaveLength(4);
  });
});

describe('isLocalizedText and localized', () => {
  test('isLocalizedText', () => {
    expect(isLocalizedText('a')).toBe(true);
    expect(isLocalizedText({ en: 'a', fr: 'b' })).toBe(true);
    expect(isLocalizedText(null)).toBe(false);
  });

  test('picks the language, then the fallback, then any language', () => {
    const text = { en: 'Planner', fr: 'Éditeur' };
    expect(localized(text, 'fr')).toBe('Éditeur');
    expect(localized(text, 'de')).toBe('Planner');
    expect(localized({ de: 'Planer' }, 'fr')).toBe('Planer');
    expect(localized({ de: 'Planer' }, 'fr', 'de')).toBe('Planer');
  });

  test('a plain string is returned as is, nothing gives an empty string', () => {
    expect(localized('Planner', 'fr')).toBe('Planner');
    expect(localized(undefined, 'fr')).toBe('');
    expect(localized(null, 'fr')).toBe('');
    expect(localized({}, 'fr')).toBe('');
  });

  test('is also exported by the browser entry of @racehubos/shared', () => {
    expect(localizedFromIndex).toBe(localized);
  });
});

describe('add-on state', () => {
  let root;
  beforeEach(() => {
    root = makeRoot();
  });
  afterEach(() => removeRoot(root));

  test('paths', () => {
    expect(addonPaths(root)).toEqual({
      addonsDir: path.join(root, 'addons'),
      dataDir: path.join(root, 'addons', '.data'),
      stateFile: path.join(root, 'addons', '.data', 'state.json'),
      catalogFile: path.join(root, 'addons', 'catalog.json'),
    });
  });

  test('RACEHUBOS_ADDONS_DIR moves the add-ons folder, relative to the root', () => {
    process.env.RACEHUBOS_ADDONS_DIR = 'tests/fixtures/addons';
    try {
      expect(addonPaths(root).addonsDir).toBe(path.join(root, 'tests/fixtures/addons'));
      expect(addonPaths(root).dataDir).toBe(path.join(root, 'tests/fixtures/addons/.data'));
    } finally {
      delete process.env.RACEHUBOS_ADDONS_DIR;
    }
  });

  test('a missing state means nothing disabled and nothing installed', () => {
    expect(readState(root)).toEqual({ disabled: {}, installed: {} });
  });

  test('a damaged state is ignored instead of stopping the app', () => {
    writeFile(root, 'addons/.data/state.json', '{ not json');
    expect(readState(root)).toEqual({ disabled: {}, installed: {} });
  });

  test('a partial state is completed', () => {
    writeFile(root, 'addons/.data/state.json', { disabled: { a: { reason: 'x' } } });
    expect(readState(root)).toEqual({ disabled: { a: { reason: 'x' } }, installed: {} });
  });

  test('disable, enable, record and forget', () => {
    disableAddon(root, 'a', new Error('boom'));
    expect(readState(root).disabled.a.reason).toBe('Error: boom');
    expect(readState(root).disabled.a.at).toEqual(expect.any(String));

    disableAddon(root, 'b');
    expect(readState(root).disabled.b.reason).toBe('');

    enableAddon(root, 'a');
    expect(readState(root).disabled.a).toBeUndefined();

    recordInstall(root, 'b', { source: 'catalog', repo: 'https://x/b.git', ref: 'v1.0.0' });
    expect(readState(root).installed.b).toMatchObject({ source: 'catalog', ref: 'v1.0.0' });

    forgetAddon(root, 'b');
    expect(readState(root)).toEqual({ disabled: {}, installed: {} });
  });

  test('writes atomically, without leftovers', () => {
    writeState(root, { disabled: {}, installed: {} });
    expect(fs.readdirSync(addonPaths(root).dataDir)).toEqual(['state.json']);
  });
});

describe('discoverAddons', () => {
  let root;
  beforeEach(() => {
    root = makeRoot();
  });
  afterEach(() => removeRoot(root));

  test('no addons folder, no add-ons', () => {
    expect(discoverAddons(root)).toEqual([]);
  });

  test('ignores dot folders and plain files', () => {
    writeFile(root, 'addons/.data/state.json', {});
    writeFile(root, 'addons/catalog.json', { addons: [] });
    writeFile(root, 'addons/README.md', '#');
    expect(discoverAddons(root)).toEqual([]);
  });

  test('a working copy linked into addons/ is an add-on, a link to a file or to nothing is not', () => {
    const elsewhere = makeRoot('racehubos-linked-');
    try {
      const copy = makeAddon(elsewhere, 'linked');
      fs.mkdirSync(path.join(root, 'addons'));
      fs.symlinkSync(copy, path.join(root, 'addons/linked'), 'dir');
      fs.symlinkSync(writeFile(elsewhere, 'notes.txt'), path.join(root, 'addons/notes'));
      fs.symlinkSync(path.join(elsewhere, 'gone'), path.join(root, 'addons/gone'));
      expect(discoverAddons(root).map((addon) => [addon.id, addon.valid])).toEqual([['linked', true]]);
    } finally {
      removeRoot(elsewhere);
    }
  });

  test('describes a complete add-on', () => {
    const dir = makeAddon(root, 'planner', {
      files: {
        'package.json': '{}',
        'server/index.js': 'export default () => {}',
        'web/index.jsx': 'export default {}',
        'web/locales/en.json': '{}',
        'overrides/packages/frontend/src/App.jsx': '',
      },
    });
    const [addon] = discoverAddons(root);
    expect(addon).toEqual({
      id: 'planner',
      dir,
      manifest: { id: 'planner', name: 'planner', version: '0.1.0', order: DEFAULT_ORDER },
      errors: [],
      valid: true,
      enabled: true,
      disabledReason: null,
      installed: null,
      serverEntry: path.join(dir, 'server/index.js'),
      webEntry: path.join(dir, 'web/index.jsx'),
      localesDir: path.join(dir, 'web/locales'),
      overridesDir: path.join(dir, 'overrides'),
      hasPackageJson: true,
    });
  });

  test('a bare add-on has no entries', () => {
    makeAddon(root, 'bare');
    expect(discoverAddons(root)[0]).toMatchObject({
      serverEntry: null,
      webEntry: null,
      localesDir: null,
      overridesDir: null,
      hasPackageJson: false,
    });
  });

  test('accepts web/index.js as web entry', () => {
    const dir = makeAddon(root, 'js', { files: { 'web/index.js': '' } });
    expect(discoverAddons(root)[0].webEntry).toBe(path.join(dir, 'web/index.js'));
  });

  test('a folder without manifest is listed as invalid', () => {
    writeFile(root, 'addons/empty/web/index.jsx', '');
    expect(discoverAddons(root)[0]).toMatchObject({
      id: 'empty',
      valid: false,
      enabled: false,
      errors: ['missing racehubos-addon.json'],
    });
  });

  test('a manifest that is not JSON is listed as invalid', () => {
    writeFile(root, 'addons/broken/racehubos-addon.json', '{');
    const [addon] = discoverAddons(root);
    expect(addon.valid).toBe(false);
    expect(addon.errors[0]).toMatch(/^racehubos-addon.json is not valid JSON/);
  });

  test('an invalid manifest is listed with its errors', () => {
    makeAddon(root, 'wrong', { manifest: { id: 'other' } });
    expect(discoverAddons(root)[0].errors).toEqual(['id "other" must match the folder name "wrong"']);
  });

  test('reports disabled and installed add-ons', () => {
    makeAddon(root, 'off');
    disableAddon(root, 'off', 'crashed');
    recordInstall(root, 'off', { source: 'link', repo: 'r', ref: 'main' });
    expect(discoverAddons(root)[0]).toMatchObject({
      enabled: false,
      disabledReason: 'crashed',
      installed: expect.objectContaining({ source: 'link' }),
    });
  });

  test('sorts by order, then id', () => {
    makeAddon(root, 'b');
    makeAddon(root, 'a');
    makeAddon(root, 'z', { manifest: { order: 1 } });
    makeAddon(root, 'c', { manifest: { order: 200 } });
    expect(discoverAddons(root).map((addon) => addon.id)).toEqual(['z', 'a', 'b', 'c']);
  });

  test('enabledAddons keeps valid, enabled add-ons only', () => {
    makeAddon(root, 'ok');
    makeAddon(root, 'off');
    makeAddon(root, 'bad', { manifest: { version: 'x' } });
    disableAddon(root, 'off');
    expect(enabledAddons(root).map((addon) => addon.id)).toEqual(['ok']);
  });
});

describe('compareAddons', () => {
  test('an add-on without manifest takes the default order', () => {
    const invalid = { id: 'a', manifest: null };
    expect(compareAddons(invalid, { id: 'b', manifest: { order: DEFAULT_ORDER } })).toBe(-1);
    expect(compareAddons({ id: 'b', manifest: { order: 1 } }, invalid)).toBeLessThan(0);
    expect(compareAddons(invalid, { ...invalid })).toBe(0);
    expect(compareAddons({ id: 'b', manifest: null }, invalid)).toBe(1);
  });
});

describe('overrides', () => {
  const leaderboard = 'packages/frontend/src/components/race/Leaderboard.jsx';
  let root;
  let core;

  beforeEach(() => {
    root = makeRoot();
    core = writeFile(root, leaderboard, 'export default function Leaderboard() {}');
    makeAddon(root, 'sector-timing', {
      manifest: { order: 100 },
      files: { [`overrides/${leaderboard}`]: "export * from '@base'\nimport Base from '@base'" },
    });
    makeAddon(root, 'pit-advice', {
      manifest: { order: 200 },
      files: {
        [`overrides/${leaderboard}`]: "import Base from '@base'",
        'overrides/packages/frontend/src/Missing.jsx': '',
      },
    });
    makeAddon(root, 'pages-only', { files: { 'web/index.jsx': '' } });
  });
  afterEach(() => removeRoot(root));

  const setup = () => {
    const addons = enabledAddons(root);
    const { stacks, orphans } = buildOverrideStacks(root, addons);
    return { addons, stacks, orphans, resolver: createOverrideResolver({ addons, stacks }) };
  };
  const layer = (id) => toPosix(path.join(root, 'addons', id, 'overrides', leaderboard));

  test('stacks the layers in add-on order', () => {
    const { stacks } = setup();
    expect([...stacks.keys()]).toEqual([toPosix(core)]);
    expect(stacks.get(toPosix(core))).toEqual([
      { id: 'sector-timing', file: layer('sector-timing') },
      { id: 'pit-advice', file: layer('pit-advice') },
    ]);
  });

  test('an override of a file the core does not have is an orphan', () => {
    expect(setup().orphans).toEqual([
      {
        id: 'pit-advice',
        file: toPosix(path.join(root, 'addons/pit-advice/overrides/packages/frontend/src/Missing.jsx')),
        target: 'packages/frontend/src/Missing.jsx',
      },
    ]);
  });

  test('the app gets the top of the stack', () => {
    const { resolver } = setup();
    expect(resolver.top(core)).toBe(layer('pit-advice'));
    expect(resolver.top(toPosix(core))).toBe(layer('pit-advice'));
    expect(resolver.top(path.join(root, 'packages/frontend/src/App.jsx'))).toBeNull();
  });

  test('@base is the layer below, the core file at the bottom', () => {
    const { resolver } = setup();
    expect(resolver.base(layer('pit-advice'))).toBe(layer('sector-timing'));
    expect(resolver.base(layer('sector-timing'))).toBe(toPosix(core));
    expect(resolver.base(core)).toBeNull();
  });

  test('@addon/ is the root of the importing add-on', () => {
    const { resolver } = setup();
    expect(resolver.addonRoot(layer('pit-advice'))).toBe(toPosix(path.join(root, 'addons/pit-advice')));
    expect(resolver.addonRoot(path.join(root, 'addons/pages-only/web/index.jsx'))).toBe(
      toPosix(path.join(root, 'addons/pages-only'))
    );
    expect(resolver.addonRoot(core)).toBeNull();
  });

  test('an add-on whose id prefixes another is not confused with it', () => {
    makeAddon(root, 'pit');
    const { resolver } = setup();
    expect(resolver.addonRoot(layer('pit-advice'))).toBe(toPosix(path.join(root, 'addons/pit-advice')));
  });

  test('isLayer', () => {
    const { resolver } = setup();
    expect(resolver.isLayer(layer('sector-timing'))).toBe(true);
    expect(resolver.isLayer(core)).toBe(false);
  });

  test('a disabled add-on leaves the stack', () => {
    disableAddon(root, 'pit-advice');
    const { resolver } = setup();
    expect(resolver.top(core)).toBe(layer('sector-timing'));
  });

  test('every layer here wraps @base: no replacement', () => {
    expect(findReplacements(setup().stacks)).toEqual([]);
  });

  test('a layer without @base replaces the file and hides the layers below', () => {
    fs.writeFileSync(layer('pit-advice'), 'export default function Leaderboard() {}');
    expect(findReplacements(setup().stacks)).toEqual([
      { core: toPosix(core), id: 'pit-advice', hides: ['sector-timing'] },
    ]);
  });

  test('compares real paths: a linked repository root or add-on folder', () => {
    const elsewhere = makeRoot('racehubos-linked-');
    const link = `${root}-link`;
    try {
      const copy = makeAddon(elsewhere, 'linked', {
        manifest: { order: 300 },
        files: { [`overrides/${leaderboard}`]: "export * from '@base'" },
      });
      fs.symlinkSync(copy, path.join(root, 'addons/linked'), 'dir');
      fs.symlinkSync(root, link, 'dir');

      const addons = enabledAddons(link);
      const { stacks } = buildOverrideStacks(link, addons);
      const resolver = createOverrideResolver({ addons, stacks });
      const linkedLayer = toPosix(path.join(copy, 'overrides', leaderboard));

      expect([...stacks.keys()]).toEqual([toPosix(core)]);
      expect(resolver.top(core)).toBe(linkedLayer);
      expect(resolver.base(linkedLayer)).toBe(layer('pit-advice'));
      expect(resolver.addonRoot(linkedLayer)).toBe(toPosix(copy));
    } finally {
      fs.rmSync(link, { force: true });
      removeRoot(elsewhere);
    }
  });

  test('a lone replacement hides only the core file', () => {
    const stacks = new Map([['/core.jsx', [{ id: 'a', file: '/a.jsx' }]]]);
    expect(findReplacements(stacks, () => 'export default 1')).toEqual([{ core: '/core.jsx', id: 'a', hides: [] }]);
  });
});

describe('realPosix', () => {
  let root;
  beforeEach(() => {
    root = makeRoot();
  });
  afterEach(() => removeRoot(root));

  test('follows links', () => {
    const file = writeFile(root, 'real/file.js');
    fs.symlinkSync(path.join(root, 'real'), path.join(root, 'link'), 'dir');
    expect(realPosix(path.join(root, 'link/file.js'))).toBe(toPosix(file));
  });

  test('a path that does not exist stays as it is', () => {
    expect(realPosix(path.join(root, 'missing.js'))).toBe(toPosix(path.join(root, 'missing.js')));
  });
});

describe('importsBase', () => {
  test.each([
    "import Base from '@base'",
    'export * from "@base"',
    "export { default } from '@base'",
    "const m = await import( '@base' )",
    "import '@base'",
    "import Base from'@base'",
  ])('recognises %s', (source) => {
    expect(importsBase(source)).toBe(true);
  });

  test.each([
    "import x from '@base/other'",
    '// wrap @base here',
    "import Base from '@basement'",
    "const s = 'from @base'",
  ])('ignores %s', (source) => {
    expect(importsBase(source)).toBe(false);
  });
});
