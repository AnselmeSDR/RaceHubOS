import { register } from 'node:module';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import {
  ADDON_SPECIFIER,
  BASE_SPECIFIER,
  buildOverrideStacks,
  createOverrideResolver,
  enabledAddons,
} from '@racehubos/shared/addons';

/**
 * Node side of the add-on imports, the same rules as the Vite plugin — docs/ADDONS.md § How it works inside the core.
 *
 * - `@base` in an override → the layer below it, or the core file
 * - `@addon/…` → the importing add-on's own folder
 * - a relative import in an override → from the core file's folder, as if the override sat in its place
 * - any import landing on an overridden core file → the top of its stack
 *
 * Registered by `preload.js` (`node --import`) before the server's first import.
 */

const isRelative = (specifier) => specifier.startsWith('./') || specifier.startsWith('../');
const fileOf = (url) => (url?.startsWith('file:') ? fileURLToPath(url) : null);

/** Enabled add-ons, their override stacks and the resolver over them. */
export function loadOverrides(rootDir) {
  const addons = enabledAddons(rootDir);
  const { stacks } = buildOverrideStacks(rootDir, addons);
  return { addons, stacks, resolver: createOverrideResolver({ addons, stacks }) };
}

/** The `resolve` hook over a resolver (see createOverrideResolver). */
export function createResolveHook(resolver) {
  const toTop = (resolved) => {
    const file = fileOf(resolved.url);
    const top = file && resolver.top(file);
    return top ? { ...resolved, url: pathToFileURL(top).href } : resolved;
  };

  return async function resolve(specifier, context, nextResolve) {
    const importer = fileOf(context.parentURL);
    const where = `(in ${importer ?? context.parentURL})`;

    if (specifier === BASE_SPECIFIER) {
      const below = importer && resolver.base(importer);
      if (!below) throw new Error(`"@base" can only be imported from an override ${where}`);
      return { url: pathToFileURL(below).href, shortCircuit: true };
    }

    if (specifier.startsWith(ADDON_SPECIFIER)) {
      const root = importer && resolver.addonRoot(importer);
      if (!root) throw new Error(`"${specifier}" can only be imported from an add-on ${where}`);
      const target = path.posix.join(root, specifier.slice(ADDON_SPECIFIER.length));
      return toTop(await nextResolve(pathToFileURL(target).href, context));
    }

    const core = importer && isRelative(specifier) ? resolver.core(importer) : null;
    const from = core ? { ...context, parentURL: pathToFileURL(core).href } : context;
    return toTop(await nextResolve(specifier, from));
  };
}

let hook = null;

/** Runs in the hooks thread, with the data given to `register`. */
export function initialize({ rootDir }) {
  hook = createResolveHook(loadOverrides(rootDir).resolver);
}

export function resolve(specifier, context, nextResolve) {
  return hook(specifier, context, nextResolve);
}

/**
 * Registers the hooks when at least one add-on is enabled: without add-ons, imports
 * don't pay for a trip through the hooks thread.
 *
 * @returns {boolean} whether the hooks were registered
 */
export function registerAddonHooks(rootDir) {
  if (enabledAddons(rootDir).length === 0) return false;
  register('./hooks.js', import.meta.url, { data: { rootDir } });
  return true;
}
