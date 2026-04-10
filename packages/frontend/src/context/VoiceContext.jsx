import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'

const API_URL = import.meta.env.VITE_API_URL || ''

const VoiceContext = createContext(null)

export function VoiceProvider({ children }) {
  const [bestLapEnabled, setBestLapEnabled] = useState(true)
  const [podiumEnabled, setPodiumEnabled] = useState(true)
  const [minLaps, setMinLaps] = useState(3)
  const [voiceId, setVoiceId] = useState('')

  // Refs for access from socket listeners
  const bestLapEnabledRef = useRef(bestLapEnabled)
  bestLapEnabledRef.current = bestLapEnabled
  const podiumEnabledRef = useRef(podiumEnabled)
  podiumEnabledRef.current = podiumEnabled
  const minLapsRef = useRef(minLaps)
  minLapsRef.current = minLaps
  const voiceIdRef = useRef(voiceId)
  voiceIdRef.current = voiceId

  // Load preferences
  useEffect(() => {
    fetch(`${API_URL}/api/preferences/bestLapVoice:enabled`).then(r => r.json()).then(d => {
      if (d.success && d.data !== null) setBestLapEnabled(d.data)
    }).catch(() => {})
    fetch(`${API_URL}/api/preferences/podiumVoice:enabled`).then(r => r.json()).then(d => {
      if (d.success && d.data !== null) setPodiumEnabled(d.data)
    }).catch(() => {})
    fetch(`${API_URL}/api/preferences/bestLapVoice:minLaps`).then(r => r.json()).then(d => {
      if (d.success && d.data !== null) setMinLaps(d.data)
    }).catch(() => {})
    fetch(`${API_URL}/api/preferences/bestLapVoice:voiceId`).then(r => r.json()).then(d => {
      if (d.success && d.data !== null) setVoiceId(d.data)
    }).catch(() => {})
  }, [])

  // Save helpers
  const saveBestLapEnabled = useCallback((value) => {
    setBestLapEnabled(value)
    fetch(`${API_URL}/api/preferences/bestLapVoice:enabled`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    }).catch(() => {})
  }, [])

  const savePodiumEnabled = useCallback((value) => {
    setPodiumEnabled(value)
    fetch(`${API_URL}/api/preferences/podiumVoice:enabled`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    }).catch(() => {})
  }, [])

  const saveMinLaps = useCallback((value) => {
    const num = Math.max(1, Math.min(20, parseInt(value) || 3))
    setMinLaps(num)
    fetch(`${API_URL}/api/preferences/bestLapVoice:minLaps`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: num }),
    }).catch(() => {})
  }, [])

  const saveVoiceId = useCallback((value) => {
    setVoiceId(value)
    fetch(`${API_URL}/api/preferences/bestLapVoice:voiceId`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    }).catch(() => {})
  }, [])

  // Get selected voice object
  const getVoice = useCallback(() => {
    if (!voiceIdRef.current) return null
    return speechSynthesis.getVoices().find(v => v.voiceURI === voiceIdRef.current) || null
  }, [])

  // Speak text with current settings
  const speak = useCallback((text, { rate = 1.1, volume = 0.9, force = false } = {}) => {
    try {
      if (!force && speechSynthesis.speaking) return null
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'fr-FR'
      utterance.rate = rate
      utterance.volume = volume
      const voice = getVoice()
      if (voice) utterance.voice = voice
      speechSynthesis.speak(utterance)
      return utterance
    } catch {
      return null
    }
  }, [getVoice])

  // Format time for speech
  const formatTimeVoice = useCallback((ms) => {
    if (!ms) return ''
    const s = ms / 1000
    if (s >= 60) {
      const min = Math.floor(s / 60)
      const sec = (s % 60).toFixed(3).replace('.', ',')
      return `${min} minute${min > 1 ? 's' : ''} ${sec}`
    }
    return `${s.toFixed(3).replace('.', ',')} secondes`
  }, [])

  return (
    <VoiceContext.Provider value={{
      bestLapEnabled, saveBestLapEnabled,
      podiumEnabled, savePodiumEnabled,
      minLaps, saveMinLaps,
      voiceId, saveVoiceId,
      bestLapEnabledRef, podiumEnabledRef, minLapsRef, voiceIdRef,
      speak, getVoice, formatTimeVoice,
    }}>
      {children}
    </VoiceContext.Provider>
  )
}

export function useVoice() {
  const context = useContext(VoiceContext)
  if (!context) throw new Error('useVoice must be used within VoiceProvider')
  return context
}
