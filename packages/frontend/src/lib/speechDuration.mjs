import { speechLanguage } from './piperSelection.mjs'
export function speechDuration(ms, language) {
  if (!Number.isFinite(ms) || ms <= 0) return ''
  const lang = speechLanguage(language),
    minutes = Math.floor(ms / 60000)
  const seconds = new Intl.NumberFormat(lang, { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(
    (ms % 60000) / 1000
  )
  const units = {
    de: ['Minute', 'Minuten', 'Sekunden'],
    en: ['minute', 'minutes', 'seconds'],
    fr: ['minute', 'minutes', 'secondes'],
  }[lang]
  return `${minutes ? `${minutes} ${units[minutes === 1 ? 0 : 1]} ` : ''}${seconds} ${units[2]}`
}
