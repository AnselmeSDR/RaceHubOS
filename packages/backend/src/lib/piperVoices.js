export function selectPiperVoice(voices, language, id = '_piper-auto') {
  const lang = String(language || '').split(/[-_]/)[0];
  const wanted = id === '_piper-thorsten' ? 'de_DE-thorsten-medium' : id.replace(/^_piper:/, '');
  return voices.find((voice) => voice.language === lang && (id === '_piper-auto' || voice.id === wanted)) || null;
}
