export function selectLocalVoice(voices, selection, language) {
  if (typeof selection !== 'string') return null
  const lang = String(language || '').split(/[-_]/)[0]
  if (selection === '_piper-auto') return voices.find((voice) => voice.language === lang) || null
  const id =
    selection === '_piper-thorsten'
      ? 'de_DE-thorsten-medium'
      : selection?.startsWith('_piper:')
        ? selection.slice(7)
        : null
  return voices.find((voice) => voice.id === id && voice.language === lang) || null
}

export function normalizeVoiceIds(value) {
  if (typeof value !== 'string') return value || {}
  if (value === '_piper-auto') return { de: value, en: value, fr: value }
  return { [value === '_piper-thorsten' ? 'de' : 'fr']: value }
}
