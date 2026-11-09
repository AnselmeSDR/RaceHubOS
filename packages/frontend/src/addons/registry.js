import { Puzzle } from 'lucide-react'

/**
 * What the enabled add-ons bring to the interface — docs/ADDONS.md § Web side.
 * `addons` comes from `virtual:racehubos-addons`: [{ id, manifest, web, locales }].
 */

export const ADDONS_PATH = 'addons'

const trimSlashes = (value) => String(value ?? '').replace(/^\/+|\/+$/g, '')

/** `/addons/<id>` followed by a path relative to it. */
export function addonPath(id, relative = '') {
  const rest = trimSlashes(relative)
  return `/${ADDONS_PATH}/${id}${rest ? `/${rest}` : ''}`
}

/**
 * Every add-on route, mounted under /addons/<id>/.
 * A malformed route is skipped with a warning instead of breaking the app.
 *
 * @returns {Array<{ key: string, addonId: string, path: string, Component: Function, layout: boolean }>}
 */
export function addonRoutes(addons, warn = console.warn) {
  return addons.flatMap((addon) =>
    (addon.web?.routes ?? []).flatMap((route) => {
      if (!route || typeof route.path !== 'string' || !route.component) {
        warn(`[addon:${addon.id}] ignored route: it needs a "path" string and a "component"`, route)
        return []
      }
      const sub = trimSlashes(route.path)
      return [
        {
          key: `${addon.id}:${sub}`,
          addonId: addon.id,
          path: addonPath(addon.id, sub).slice(1),
          Component: route.component,
          layout: route.layout !== false,
        },
      ]
    })
  )
}

/** Sidebar entries of the add-ons, in the shape of the core ones (lib/navItems.js). */
export function addonNavItems(addons, warn = console.warn) {
  return addons.flatMap((addon) =>
    (addon.web?.nav ?? []).flatMap((item) => {
      if (!item || typeof item.labelKey !== 'string') {
        warn(`[addon:${addon.id}] ignored sidebar entry: it needs a "labelKey"`, item)
        return []
      }
      return [
        {
          to: addonPath(addon.id, item.to),
          labelKey: item.labelKey,
          ns: addon.id,
          Icon: item.Icon ?? Puzzle,
          adminOnly: !!item.adminOnly,
          addon: addon.id,
        },
      ]
    })
  )
}

/**
 * Loads each add-on's translations into the namespace named after it.
 * An add-on can't take over a core namespace: its texts are then left out, loudly.
 *
 * @param {import('i18next').i18n} i18n
 * @param {string[]} coreNamespaces
 * @returns {string[]} ids whose translations were refused
 */
export function registerAddonLocales(i18n, addons, coreNamespaces, error = console.error) {
  const refused = []
  for (const addon of addons) {
    const languages = Object.entries(addon.locales ?? {})
    if (languages.length === 0) continue
    if (coreNamespaces.includes(addon.id)) {
      error(`[addon:${addon.id}] translations not loaded: "${addon.id}" is a core namespace, rename the add-on`)
      refused.push(addon.id)
      continue
    }
    for (const [lang, resources] of languages) {
      i18n.addResourceBundle(lang, addon.id, resources, true, true)
    }
  }
  return refused
}
