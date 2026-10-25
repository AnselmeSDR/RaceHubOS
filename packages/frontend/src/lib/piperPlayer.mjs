import { browserVoice, selectLocalVoice, speechLanguage } from './piperSelection.mjs'
export function createSpeechPlayer({ api = '', env = globalThis, onState = () => {} } = {}) {
  let active = null
  function cancel() {
    if (!active) return
    const job = active
    active = null
    job.controller.abort()
    job.audio?.pause()
    if (job.url) env.URL.revokeObjectURL(job.url)
    if (job.browser) env.speechSynthesis?.cancel()
    onState('idle')
  }
  function speak(text, { language, selection = '', voices = [], rate = 0.95, volume = 1, force = false } = {}) {
    if (typeof text !== 'string' || !text.trim() || text.length > 400) return null
    if (!force && (active || env.speechSynthesis?.speaking)) return null
    cancel()
    const lang = speechLanguage(language),
      job = { controller: new env.AbortController(), onend: null, audio: null, url: null, browser: false }
    active = job
    const finish = () => {
      if (active !== job) return
      if (job.url) env.URL.revokeObjectURL(job.url)
      active = null
      onState('done')
      job.onend?.()
    }
    const fallback = () => {
      if (active !== job || job.browser) return
      if (job.url) {
        env.URL.revokeObjectURL(job.url)
        job.url = null
      }
      if (!env.speechSynthesis || !env.SpeechSynthesisUtterance) {
        active = null
        onState('unavailable')
        Promise.resolve().then(() => job.onend?.())
        return
      }
      const utterance = new env.SpeechSynthesisUtterance(text)
      utterance.lang = { de: 'de-DE', en: 'en-US', fr: 'fr-FR' }[lang]
      utterance.rate = rate
      utterance.volume = volume
      const voice = browserVoice(env.speechSynthesis.getVoices(), selection, lang)
      if (voice) utterance.voice = voice
      utterance.onend = finish
      utterance.onerror = finish
      job.browser = true
      onState(selection.startsWith('_piper') ? 'fallback' : 'browser')
      env.speechSynthesis.speak(utterance)
    }
    const voice = selectLocalVoice(voices, selection, lang)
    if (!voice) {
      fallback()
      return job
    }
    onState('loading')
    env
      .fetch(`${api}/api/voice/speak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          language: lang,
          voiceId: '_piper:' + voice.id,
          rate: Math.min(1.2, Math.max(0.8, rate)),
        }),
        signal: job.controller.signal,
      })
      .then(async (response) => {
        if (!response.ok) throw new Error('Local synthesis unavailable')
        const blob = await response.blob()
        if (active !== job) return
        job.url = env.URL.createObjectURL(blob)
        job.audio = new env.Audio(job.url)
        job.audio.volume = Math.min(1, Math.max(0, volume))
        job.audio.onended = finish
        job.audio.onerror = fallback
        await job.audio.play()
        if (active === job) onState('local')
      })
      .catch((error) => {
        if (error.name !== 'AbortError' && active === job) fallback()
      })
    return job
  }
  return { speak, cancel }
}
