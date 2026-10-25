export function speechLanguage(language) {
  const lang = String(language || 'fr').split(/[-_]/)[0]
  return ['de', 'en', 'fr'].includes(lang) ? lang : 'fr'
}
export function selectLocalVoice(voices, selection, language) {
  const lang = speechLanguage(language)
  if (selection === '_piper-auto') return voices.find((v) => v.language === lang) || null
  const id =
    selection === '_piper-thorsten'
      ? 'de_DE-thorsten-medium'
      : selection.startsWith('_piper:')
        ? selection.slice(7)
        : null
  return voices.find((v) => v.id === id && v.language === lang) || null
}
export function browserVoice(voices, selection, language) {
  const lang = speechLanguage(language)
  return (
    voices.find((v) => v.voiceURI === selection && v.lang.toLowerCase().startsWith(lang)) ||
    voices.find((v) => v.lang.toLowerCase().startsWith(lang)) ||
    null
  )
}

export function normalizeVoiceIds(value) {
  if (typeof value !== 'string') return value || {}
  if (value === '_piper-auto') return { de: value, en: value, fr: value }
  return { [value === '_piper-thorsten' ? 'de' : 'fr']: value }
}
