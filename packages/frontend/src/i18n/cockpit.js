import { useTranslation } from 'react-i18next'
import i18n from './index'
import de from './locales/de/cockpit.json'
import { extensionTranslator } from './extensionMessages.mjs'

// Stable source messages also cover backend diagnostics and existing layout labels.
export function useExtensions() {
  useTranslation('cockpit')
}
export function locale() {
  return i18n.resolvedLanguage || 'de'
}
export const tx = extensionTranslator(de, (text, values) =>
  i18n.t(text, {
    ns: 'cockpit',
    keySeparator: false,
    nsSeparator: false,
    defaultValue: text,
    ...values,
  })
)
export const translateMessage = tx
