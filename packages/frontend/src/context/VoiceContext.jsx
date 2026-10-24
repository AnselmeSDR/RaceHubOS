import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import i18n from '../i18n'
import { speechLocale } from '../lib/speech'

const API_URL = import.meta.env.VITE_API_URL || ''

const VoiceContext = createContext(null)

export function VoiceProvider({ children }) {
  const [bestLapEnabled, setBestLapEnabled] = useState(true)
  const [podiumEnabled, setPodiumEnabled] = useState(true)
  const [minLaps, setMinLaps] = useState(3)
  // Chosen voice per interface language; a language without one uses its default voice
  const [voiceIds, setVoiceIds] = useState({})
  const { i18n: { resolvedLanguage } } = useTranslation()

  // Refs for access from socket listeners
  const bestLapEnabledRef = useRef(bestLapEnabled)
  bestLapEnabledRef.current = bestLapEnabled
  const podiumEnabledRef = useRef(podiumEnabled)
  podiumEnabledRef.current = podiumEnabled
  const minLapsRef = useRef(minLaps)
  minLapsRef.current = minLaps
  const voiceIdsRef = useRef(voiceIds)
  voiceIdsRef.current = voiceIds

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
      if (!d.success || d.data === null) return
      // Before 1.25.0 a single voice was stored, always a French one
      setVoiceIds(typeof d.data === 'string' ? { fr: d.data } : d.data)
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

  // Saves the voice for the current interface language only
  const saveVoiceId = useCallback((voiceURI) => {
    const value = { ...voiceIdsRef.current, [i18n.resolvedLanguage]: voiceURI }
    if (!voiceURI) delete value[i18n.resolvedLanguage]
    setVoiceIds(value)
    fetch(`${API_URL}/api/preferences/bestLapVoice:voiceId`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    }).catch(() => {})
  }, [])

  // Voice chosen for the interface language; none lets the browser pick its
  // default voice for that language (utterance.lang)
  const getVoice = useCallback(() => {
    const voiceURI = voiceIdsRef.current[i18n.resolvedLanguage]
    if (!voiceURI) return null
    return speechSynthesis.getVoices().find(v => v.voiceURI === voiceURI) || null
  }, [])

  // Speak text with current settings
  const speak = useCallback((text, { rate = 1.1, volume = 0.9, force = false } = {}) => {
    try {
      if (!force && speechSynthesis.speaking) return null
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = speechLocale(i18n.resolvedLanguage)
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
    const number = (value) => value.toLocaleString(i18n.resolvedLanguage, { minimumFractionDigits: 3, maximumFractionDigits: 3 })
    const s = ms / 1000
    if (s >= 60) {
      const min = Math.floor(s / 60)
      return i18n.t('voice:minutes', { count: min, seconds: number(s % 60) })
    }
    return i18n.t('voice:seconds', { value: number(s) })
  }, [])

  return (
    <VoiceContext.Provider value={{
      bestLapEnabled, saveBestLapEnabled,
      podiumEnabled, savePodiumEnabled,
      minLaps, saveMinLaps,
      voiceId: voiceIds[resolvedLanguage] || '', saveVoiceId,
      bestLapEnabledRef, podiumEnabledRef, minLapsRef,
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
