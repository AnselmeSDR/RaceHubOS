// Announcements are spoken in the interface language, English for any other
const SPEECH_LOCALES = { fr: 'fr-FR', en: 'en-US', de: 'de-DE' }

/** Speech synthesis locale for an interface language. */
export function speechLocale(language) {
  return SPEECH_LOCALES[language] ?? SPEECH_LOCALES.en
}

/** Every browser voice, those speaking this interface language first. */
export function voicesByLanguage(language) {
  const other = (v) => (v.lang.startsWith(language) ? 0 : 1)
  return [...speechSynthesis.getVoices()].sort(
    (a, b) => other(a) - other(b) || a.lang.localeCompare(b.lang) || a.name.localeCompare(b.name)
  )
}
