import fs from 'fs';
import path from 'path';

/**
 * Overrides — docs/ADDONS.md § Changing existing code.
 *
 * `addons/<id>/overrides/<repo path>` takes the place of `<repo path>`. Several add-ons
 * can override the same file: they form a stack, the app sees the top, and `@base`
 * inside a layer is the layer just below it (the core file at the bottom).
 *
 * Paths are compared in absolute posix form (`C:/x/y` on Windows): that is what Vite
 * uses for module ids, and what `pathToFileURL` accepts on every platform. They are also
 * real paths: Vite and Node name a module after its target when a folder is a link
 * (an add-on linked into addons/, /var → /private/var on macOS).
 */

export const BASE_SPECIFIER = '@base';
export const ADDON_SPECIFIER = '@addon/';

export function toPosix(file) {
  return path.resolve(file).split(path.sep).join('/');
}

/** `toPosix` of the real path, links followed; the path itself when it does not exist. */
export function realPosix(file) {
  try {
    return toPosix(fs.realpathSync(file));
  } catch {
    return toPosix(file);
  }
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  });
}

/**
 * @param {string} rootDir repository root
 * @param {Array<{ id: string, overridesDir: string|null }>} addons enabled add-ons, in stack order
 * @returns {{ stacks: Map<string, Array<{ id: string, file: string }>>, orphans: Array<{ id, file, target }> }}
 *   `stacks`: core file → its layers, lowest first. `orphans`: overrides of files the core doesn't have.
 */
export function buildOverrideStacks(rootDir, addons) {
  const stacks = new Map();
  const orphans = [];

  for (const addon of addons) {
    if (!addon.overridesDir) continue;
    for (const file of walk(addon.overridesDir)) {
      const target = path.relative(addon.overridesDir, file);
      const core = path.join(rootDir, target);
      if (!fs.existsSync(core)) {
        orphans.push({ id: addon.id, file: realPosix(file), target: target.split(path.sep).join('/') });
        continue;
      }
      const key = realPosix(core);
      if (!stacks.has(key)) stacks.set(key, []);
      stacks.get(key).push({ id: addon.id, file: realPosix(file) });
    }
  }

  return { stacks, orphans };
}

/**
 * Answers the three questions both resolvers (Vite, Node) ask.
 *
 * @param {{ addons: Array<{ id: string, dir: string }>, stacks: Map }} options
 */
export function createOverrideResolver({ addons, stacks }) {
  const layers = new Map();
  for (const [core, stack] of stacks) {
    stack.forEach((layer, index) => layers.set(layer.file, { core, index }));
  }
  const roots = addons.map((addon) => realPosix(addon.dir) + '/');

  return {
    /** The file the app gets for `file`: the top of its stack, or null when nothing overrides it. */
    top(file) {
      const stack = stacks.get(toPosix(file));
      return stack ? stack[stack.length - 1].file : null;
    },

    /** What `@base` means inside `importer`: the layer below, or null if `importer` is no override. */
    base(importer) {
      const layer = layers.get(toPosix(importer));
      if (!layer) return null;
      return layer.index === 0 ? layer.core : stacks.get(layer.core)[layer.index - 1].file;
    },

    /** The add-on folder `importer` belongs to, for `@addon/…`, or null. */
    addonRoot(importer) {
      const file = toPosix(importer);
      const root = roots.find((candidate) => file.startsWith(candidate));
      return root ? root.slice(0, -1) : null;
    },

    isLayer(file) {
      return layers.has(toPosix(file));
    },
  };
}

// `import x from '@base'`, `export * from '@base'`, `import('@base')`, `import '@base'`
const BASE_IMPORT = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)['"]@base['"]/;

export function importsBase(source) {
  return BASE_IMPORT.test(source);
}

/**
 * Layers that never import `@base`: they replace the file and hide every layer below.
 *
 * @returns {Array<{ core: string, id: string, hides: string[] }>} `hides`: add-on ids hidden below
 */
export function findReplacements(stacks, read = (file) => fs.readFileSync(file, 'utf-8')) {
  const replacements = [];
  for (const [core, stack] of stacks) {
    stack.forEach((layer, index) => {
      if (importsBase(read(layer.file))) return;
      replacements.push({ core, id: layer.id, hides: stack.slice(0, index).map((below) => below.id) });
    });
  }
  return replacements;
}
