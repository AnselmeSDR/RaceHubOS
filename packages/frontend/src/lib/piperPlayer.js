import { selectLocalVoice } from './piperSelection'

/** Only the explicitly selected Piper path uses this player. Browser speech stays on main's path. */
export function createSpeechPlayer({ api = '', env = globalThis, browserSpeak, onState = () => {} } = {}) {
  let active = null
  function stopAudio(job) {
    job.audio?.pause()
    if (job.source) {
      job.source.onended = null
      try {
        job.source.stop()
      } catch {
        /* Already ended. */
      }
      job.source.disconnect?.()
    }
    const context = job.context
    job.context = null
    if (context) Promise.resolve(context.close()).catch(() => {})
  }
  function cancel() {
    if (!active) return
    const job = active
    active = null
    clearTimeout(job.timer)
    job.controller.abort()
    stopAudio(job)
    if (job.url) env.URL.revokeObjectURL(job.url)
    if (job.browser) env.speechSynthesis?.cancel()
    onState('idle')
  }
  function speak(
    text,
    { language, selection, voices = [], rate = 1.1, volume = 0.9, force = false, preview = false } = {}
  ) {
    if (!force && (active || env.speechSynthesis?.speaking)) return null
    cancel()
    const job = {
      controller: new env.AbortController(),
      onend: null,
      onerror: null,
      audio: null,
      url: null,
      browser: false,
    }
    active = job
    const finish = (error) => {
      if (active !== job) return
      clearTimeout(job.timer)
      stopAudio(job)
      if (job.url) env.URL.revokeObjectURL(job.url)
      active = null
      onState('done')
      if (error && job.onerror) job.onerror(error)
      else job.onend?.()
    }
    const fallback = () => {
      if (active !== job || job.browser) return
      clearTimeout(job.timer)
      stopAudio(job)
      if (job.url) {
        env.URL.revokeObjectURL(job.url)
        job.url = null
      }
      job.browser = true
      onState('fallback')
      const utterance = browserSpeak(text, { rate, volume, force })
      if (utterance) {
        utterance.onend = () => finish()
        utterance.onerror = finish
      } else Promise.resolve().then(() => finish(new Error('Browser speech unavailable')))
    }
    const voice = selectLocalVoice(voices, selection, language)
    if (!voice || typeof text !== 'string' || !text.trim() || text.length > 400) {
      fallback()
      return job
    }
    // Resume Web Audio during the click, so delayed synthesis retains permission
    // to play in Firefox too. Ordinary browser announcements are unchanged.
    const Context = env.AudioContext || env.webkitAudioContext
    if (preview && Context) {
      try {
        job.context = new Context()
        job.resumed = Promise.resolve(job.context.resume()).catch((error) => {
          job.contextError = error
        })
      } catch (error) {
        job.contextError = error
      }
    } else if (preview) {
      job.audio = new env.Audio(
        'data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAIlYAAESsAAACABAAZGF0YQIAAAAAAA=='
      )
      Promise.resolve(job.audio.play()).catch(() => {})
    }
    onState('loading')
    job.timer = setTimeout(() => {
      job.controller.abort()
      fallback()
    }, 35000)
    env
      .fetch(`${api}/api/voice/speak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, language, voiceId: '_piper:' + voice.id, rate }),
        signal: job.controller.signal,
      })
      .then(async (response) => {
        if (!response.ok) throw new Error('Local synthesis unavailable')
        const blob = await response.blob()
        if (active !== job || job.browser) return
        clearTimeout(job.timer)
        if (job.contextError) throw job.contextError
        if (job.context) {
          const context = job.context
          await job.resumed
          if (job.contextError) throw job.contextError
          const buffer = await context.decodeAudioData(await blob.arrayBuffer())
          if (active !== job || job.browser) return
          const source = context.createBufferSource()
          const gain = context.createGain()
          gain.gain.value = Math.min(1, Math.max(0, volume))
          source.buffer = buffer
          source.connect(gain)
          gain.connect(context.destination)
          job.source = source
          source.onended = () => finish()
          source.start()
          onState('local')
          return
        }
        job.url = env.URL.createObjectURL(blob)
        if (job.audio) job.audio.src = job.url
        else job.audio = new env.Audio(job.url)
        job.audio.volume = Math.min(1, Math.max(0, volume))
        job.audio.onended = () => finish()
        job.audio.onerror = fallback
        await job.audio.play()
        if (active === job && !job.browser) onState('local')
      })
      .catch(() => {
        if (active === job) fallback()
      })
    return job
  }
  return {
    speak,
    cancel,
    get speaking() {
      return !!active
    },
  }
}
