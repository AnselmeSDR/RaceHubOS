import fs from 'fs'
import path from 'path'
import {
  ADDON_SPECIFIER,
  addonPaths,
  BASE_SPECIFIER,
  buildOverrideStacks,
  createOverrideResolver,
  enabledAddons,
  isBareSpecifier,
  realPosix,
  toPosix,
} from '@racehubos/shared/addons'

/**
 * Builds the enabled add-ons into the app — docs/ADDONS.md § How it works inside the core.
 *
 * - `virtual:racehubos-addons`: every add-on with web code or translations
 * - `@addon/…`: the importing add-on's own folder
 * - overrides: an import of an overridden core file gets the top of its stack,
 *   `@base` inside a layer gets the layer below, and a relative import inside a layer
 *   starts from the core file's folder
 * - a package an add-on doesn't carry comes from the core, even for an add-on linked from elsewhere
 * - Tailwind scans each add-on folder: `addons/` is ignored by git, which Tailwind would skip
 * - Vitest's module cache is kept apart for each set of enabled add-ons
 * - the dev server follows the add-ons enabled, disabled, installed or removed meanwhile
 */

export const VIRTUAL_ID = 'virtual:racehubos-addons'
const RESOLVED_VIRTUAL_ID = '\0' + VIRTUAL_ID

// Provided by the core and kept to a single copy: a second React breaks hooks
export const SHARED_PACKAGES = [
  'react',
  'react-dom',
  'react-router-dom',
  'i18next',
  'react-i18next',
  'socket.io-client',
  'lucide-react',
]

/** `web/locales/<lang>.json` files of an add-on: { [lang]: file }. */
export function localeFiles(localesDir) {
  if (!localesDir) return {}
  return Object.fromEntries(
    fs
      .readdirSync(localesDir)
      .filter((name) => name.endsWith('.json'))
      .sort()
      .map((name) => [name.slice(0, -'.json'.length), path.join(localesDir, name)])
  )
}

/** Source of the virtual module: `export default [{ id, manifest, web, locales }]`. */
export function virtualModuleCode(addons) {
  const imports = []
  const entries = []

  addons
    .filter((addon) => addon.webEntry || addon.localesDir)
    .forEach((addon, index) => {
      let web = 'null'
      if (addon.webEntry) {
        imports.push(`import * as web${index} from ${JSON.stringify(toPosix(addon.webEntry))}`)
        web = `web${index}.default ?? null`
      }
      const locales = Object.entries(localeFiles(addon.localesDir)).map(([lang, file], fileIndex) => {
        const name = `locale${index}_${fileIndex}`
        imports.push(`import ${name} from ${JSON.stringify(toPosix(file))}`)
        return `${JSON.stringify(lang)}: ${name}`
      })
      entries.push(
        `  { id: ${JSON.stringify(addon.id)}, manifest: ${JSON.stringify(addon.manifest)}, ` +
          `web: ${web}, locales: { ${locales.join(', ')} } }`
      )
    })

  return `${imports.join('\n')}\nexport default [\n${entries.join(',\n')}\n]\n`
}

/** A module id without its query (`?v=…`, `?import`). */
const fileOf = (id) => id.split('?')[0]

// Marks the core file under a stack: by its plain URL, resolved again on its own (Vitest's module
// cache does, so does a browser asking a fresh server), it would be the top layer and wrap itself
const BASE_QUERY = 'racehubos-base'
const isBelowStack = (id) => new URLSearchParams(id.split('?')[1]).has(BASE_QUERY)

/**
 * @param {{ rootDir: string }} options repository root
 */
export default function racehubosAddons({ rootDir }) {
  let addons = []
  let hasOverrides = false
  let resolver = createOverrideResolver({ addons, stacks: new Map() })
  let cssEntry = null
  // Where a package import resolves from when the add-on has no copy of its own
  const coreImporter = path.join(rootDir, 'packages/frontend/src/main.jsx')

  let cacheKey = ''
  let stopWatching = () => {}

  const discover = () => {
    addons = enabledAddons(rootDir)
    const { stacks } = buildOverrideStacks(rootDir, addons)
    hasOverrides = stacks.size > 0
    resolver = createOverrideResolver({ addons, stacks })
    cacheKey = JSON.stringify({
      base: BASE_QUERY,
      addons: addons.map((addon) => realPosix(addon.dir)),
      stacks: [...stacks],
    })
  }

  return {
    name: 'racehubos-addons',
    enforce: 'pre',

    config() {
      discover()
      // An add-on linked from elsewhere is served too
      const repository = `${realPosix(rootDir)}/`
      const outside = addons.map((addon) => realPosix(addon.dir)).filter((dir) => !`${dir}/`.startsWith(repository))
      return {
        resolve: { dedupe: SHARED_PACKAGES },
        server: { fs: { allow: [rootDir, ...outside] } },
      }
    },

    // Every transform depends on the enabled add-ons: Vitest's module cache must not serve one made for others
    configureVitest({ defineCacheKeyGenerator }) {
      defineCacheKeyGenerator(() => cacheKey)
    },

    // An add-on enabled, disabled, installed or removed: production builds the app again, here the
    // next page load gets the new set (the Add-ons page reloads once the backend is back)
    configureServer(server) {
      if (server.config.server.watch === null) return
      const { stateFile } = addonPaths(rootDir)
      // Polled: works before the file exists, and across its atomic replacement
      const changed = (current, previous) => {
        if (current.mtimeMs === previous.mtimeMs) return
        discover()
        for (const environment of Object.values(server.environments)) environment.moduleGraph.invalidateAll()
      }
      fs.watchFile(stateFile, { interval: 500, persistent: false }, changed)
      stopWatching = () => fs.unwatchFile(stateFile, changed)
    },

    closeBundle() {
      stopWatching()
    },

    configResolved(config) {
      cssEntry = realPosix(path.join(config.root, 'src/index.css'))
    },

    async resolveId(source, importer, options) {
      if (source === VIRTUAL_ID) return RESOLVED_VIRTUAL_ID
      if (!importer || importer.startsWith('\0')) return null
      const from = fileOf(importer)

      if (source === BASE_SPECIFIER) {
        const below = resolver.base(from)
        if (!below) this.error(`"@base" can only be imported from an override (in ${from})`)
        return resolver.isLayer(below) ? below : `${below}?${BASE_QUERY}`
      }

      if (source.startsWith(ADDON_SPECIFIER)) {
        const root = resolver.addonRoot(from)
        if (!root) this.error(`"${source}" can only be imported from an add-on (in ${from})`)
        const target = path.posix.join(root, source.slice(ADDON_SPECIFIER.length))
        return this.resolve(target, importer, { ...options, skipSelf: true })
      }

      // Any other import: if it lands on an overridden core file, the app gets the top layer
      const packageInAddon = isBareSpecifier(source) && resolver.addonRoot(from) !== null
      if (!hasOverrides && !packageInAddon) return null
      // A relative import in an override starts from the core file's folder, as if the override sat in its place
      const core = source.startsWith('.') ? resolver.core(from) : null
      let resolved = await this.resolve(source, core ?? importer, { ...options, skipSelf: true })
      // Not in the add-on's own packages: the core's (a linked add-on sits outside the repository)
      if (!resolved && packageInAddon)
        resolved = await this.resolve(source, coreImporter, { ...options, skipSelf: true })
      if (!resolved || resolved.external || isBelowStack(resolved.id)) return resolved
      const [file, query] = resolved.id.split('?')
      const top = resolver.top(file)
      return top ? { ...resolved, id: query ? `${top}?${query}` : top } : resolved
    },

    transform(code, id) {
      if (fileOf(id) !== cssEntry || addons.length === 0) return null
      const sources = addons.map((addon) => `@source ${JSON.stringify(realPosix(addon.dir))};`)
      return { code: `${code}\n/* add-ons (docs/ADDONS.md) */\n${sources.join('\n')}\n`, map: null }
    },

    load(id) {
      if (id === RESOLVED_VIRTUAL_ID) return virtualModuleCode(addons)
      return null
    },
  }
}
