import i18n from '../i18n'

// Formatting only: timing and stored milliseconds remain unchanged.
export function formatDecimal(value, digits = 3) {
  return Number(value).toLocaleString(i18n.resolvedLanguage || 'de', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    useGrouping: false,
  })
}
