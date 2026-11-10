import { localized } from '@racehubos/shared'

/** An add-on's name in the interface language; its id when the manifest is unreadable. */
export function addonName(addon, lang) {
  return localized(addon.manifest?.name ?? addon.name, lang) || addon.id
}

export function addonDescription(addon, lang) {
  return localized(addon.manifest?.description ?? addon.description, lang)
}
