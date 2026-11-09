import fs from 'fs'
import path from 'path'
import {
  ADDON_SPECIFIER,
  BASE_SPECIFIER,
  buildOverrideStacks,
  createOverrideResolver,
  enabledAddons,
  toPosix,
} from '@racehubos/shared/addons'

/**
 * Builds the enabled add-ons into the app — docs/ADDONS.md § How it works inside the core.
 *
 * - `virtual:racehubos-addons`: every add-on with web code or translations
 * - `@addon/…`: the importing add-on's own folder
 * - overrides: an import of an overridden core file gets the top of its stack,
 *   and `@base` inside a layer gets the layer below
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

/**
 * @param {{ rootDir: string }} options repository root
 */
export default function racehubosAddons({ rootDir }) {
  let addons = []
  let hasOverrides = false
  let resolver = createOverrideResolver({ addons, stacks: new Map() })

  const discover = () => {
    addons = enabledAddons(rootDir)
    const { stacks } = buildOverrideStacks(rootDir, addons)
    hasOverrides = stacks.size > 0
    resolver = createOverrideResolver({ addons, stacks })
  }

  return {
    name: 'racehubos-addons',
    enforce: 'pre',

    config() {
      discover()
      return {
        resolve: { dedupe: SHARED_PACKAGES },
        server: { fs: { allow: [rootDir] } },
      }
    },

    async resolveId(source, importer, options) {
      if (source === VIRTUAL_ID) return RESOLVED_VIRTUAL_ID
      if (!importer || importer.startsWith('\0')) return null
      const from = fileOf(importer)

      if (source === BASE_SPECIFIER) {
        const below = resolver.base(from)
        if (!below) this.error(`"@base" can only be imported from an override (in ${from})`)
        return below
      }

      if (source.startsWith(ADDON_SPECIFIER)) {
        const root = resolver.addonRoot(from)
        if (!root) this.error(`"${source}" can only be imported from an add-on (in ${from})`)
        const target = path.posix.join(root, source.slice(ADDON_SPECIFIER.length))
        return this.resolve(target, importer, { ...options, skipSelf: true })
      }

      // Any other import: if it lands on an overridden core file, the app gets the top layer
      if (!hasOverrides) return null
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true })
      if (!resolved || resolved.external) return resolved
      const [file, query] = resolved.id.split('?')
      const top = resolver.top(file)
      return top ? { ...resolved, id: query ? `${top}?${query}` : top } : resolved
    },

    load(id) {
      if (id === RESOLVED_VIRTUAL_ID) return virtualModuleCode(addons)
      return null
    },
  }
}
