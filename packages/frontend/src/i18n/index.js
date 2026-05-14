import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

export const LANGUAGES = [
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'English' },
]

// Auto-import every locale file: locales/<lang>/<namespace>.json
// Adding a new file (or a new language folder) is picked up automatically.
const modules = import.meta.glob('./locales/*/*.json', { eager: true })

const resources = {}
const namespaces = new Set()

for (const path in modules) {
  const [, lang, ns] = path.match(/\.\/locales\/([^/]+)\/([^/]+)\.json$/)
  resources[lang] ??= {}
  resources[lang][ns] = modules[path].default
  namespaces.add(ns)
}

export const NAMESPACES = [...namespaces]

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    ns: NAMESPACES,
    defaultNS: 'common',
    fallbackNS: 'common',
    fallbackLng: 'fr',
    supportedLngs: LANGUAGES.map(l => l.code),
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'racehubos-lang',
      caches: ['localStorage'],
    },
  })

export default i18n
