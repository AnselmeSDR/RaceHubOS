import { speechDuration } from '../lib/speechDuration.mjs'
import { createSpeechPlayer } from '../lib/piperPlayer.mjs'
import { browserVoice, normalizeVoiceIds } from '../lib/piperSelection.mjs'
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import i18n from '../i18n'

const API_URL = import.meta.env.VITE_API_URL || ''

const VoiceContext = createContext(null)

export function VoiceProvider({ children }) {
  const [bestLapEnabled, setBestLapEnabled] = useState(true)
  const [podiumEnabled, setPodiumEnabled] = useState(true)
  const [minLaps, setMinLaps] = useState(3)
  // Chosen voice per interface language; a language without one uses its default voice
  const [voiceIds, setVoiceIds] = useState({})
  const {
    i18n: { resolvedLanguage },
  } = useTranslation()

  const [localVoices, setLocalVoices] = useState([])
  const localVoicesRef = useRef([])
  const [voiceState, setVoiceState] = useState('idle')
  const playerRef = useRef(null)
  if (playerRef.current === null) playerRef.current = createSpeechPlayer({ api: API_URL, onState: setVoiceState })
  useEffect(() => {
    fetch(`${API_URL}/api/voice/status`)
      .then((r) => r.json())
      .then((d) => {
        localVoicesRef.current = Array.isArray(d.voices) ? d.voices : []
        setLocalVoices(localVoicesRef.current)
      })
      .catch(() => {})
    const stop = () => playerRef.current.cancel()
    i18n.on('languageChanged', stop)
    return () => {
      i18n.off('languageChanged', stop)
      stop()
    }
  }, [])

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
    fetch(`${API_URL}/api/preferences/bestLapVoice:enabled`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data !== null) setBestLapEnabled(d.data)
      })
      .catch(() => {})
    fetch(`${API_URL}/api/preferences/podiumVoice:enabled`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data !== null) setPodiumEnabled(d.data)
      })
      .catch(() => {})
    fetch(`${API_URL}/api/preferences/bestLapVoice:minLaps`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data !== null) setMinLaps(d.data)
      })
      .catch(() => {})
    fetch(`${API_URL}/api/preferences/bestLapVoice:voiceId`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.success || d.data === null) return
        // Before 1.25.0 a single voice was stored, always a French one
        setVoiceIds(normalizeVoiceIds(d.data))
      })
      .catch(() => {})
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

  const getVoice = useCallback(
    () =>
      browserVoice(
        window.speechSynthesis?.getVoices() || [],
        voiceIdsRef.current[i18n.resolvedLanguage] || '',
        i18n.resolvedLanguage
      ),
    []
  )
  const speak = useCallback(
    (text, options = {}) =>
      playerRef.current.speak(text, {
        language: i18n.resolvedLanguage,
        selection: voiceIdsRef.current[i18n.resolvedLanguage] || '',
        voices: localVoicesRef.current,
        ...options,
      }),
    []
  )

  const formatTimeVoice = useCallback((ms) => speechDuration(ms, i18n.resolvedLanguage), [])

  return (
    <VoiceContext.Provider
      value={{
        bestLapEnabled,
        saveBestLapEnabled,
        podiumEnabled,
        savePodiumEnabled,
        minLaps,
        saveMinLaps,
        voiceId: voiceIds[resolvedLanguage] || '',
        saveVoiceId,
        bestLapEnabledRef,
        podiumEnabledRef,
        minLapsRef,
        speak,
        getVoice,
        formatTimeVoice,
        localVoices,
        voiceState,
      }}
    >
      {children}
    </VoiceContext.Provider>
  )
}

export function useVoice() {
  const context = useContext(VoiceContext)
  if (!context) throw new Error('useVoice must be used within VoiceProvider')
  return context
}
