import { useState, useEffect, useCallback, useMemo } from 'react'

const API_URL = import.meta.env.VITE_API_URL || ''

/**
 * CU (Control Unit) status hook with polling
 * @param {object} options - Configuration options
 * @returns {object} { connected, status, raceState, modes, loading, error, refetch }
 */
export function useCuStatus(options = {}) {
  const {
    pollingInterval = 2000,
    enabled = true
  } = options

  const [connected, setConnected] = useState(false)
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/bluetooth/status`)
      const data = await res.json()
      setConnected(data.connected || false)
      setStatus(data.lastStatus || null)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!enabled) return

    fetchStatus()
    const interval = setInterval(fetchStatus, pollingInterval)
    return () => clearInterval(interval)
  }, [enabled, pollingInterval, fetchStatus])

  // Compute race state from status.start
  const raceState = useMemo(() => {
    if (!status) return { text: 'Unknown', color: 'gray', code: null }

    const start = status.start
    if (start === 0) return { text: 'Racing', color: 'green', code: 'RACING' }
    if (start >= 1 && start <= 5) return { text: `Lights ${start}/5`, color: 'yellow', code: 'LIGHTS' }
    if (start === 6) return { text: 'False Start', color: 'red', code: 'FALSE_START' }
    if (start === 7) return { text: 'Go!', color: 'green', code: 'GO' }
    if (start >= 8) return { text: 'Stopped', color: 'red', code: 'STOPPED' }
    return { text: `State ${start}`, color: 'gray', code: 'UNKNOWN' }
  }, [status])

  // Compute active modes from status.mode flags
  const modes = useMemo(() => {
    if (!status?.mode) return []
    const m = []
    if (status.mode & 1) m.push('Fuel')
    if (status.mode & 2) m.push('Real')
    if (status.mode & 4) m.push('Pit')
    if (status.mode & 8) m.push('Laps')
    return m
  }, [status])

  // Computed states for easy conditionals
  const isRacing = status?.start === 0
  const isInLights = status?.start >= 1 && status?.start <= 5
  const isStopped = status?.start >= 8
  const isReady = connected && !isRacing

  return {
    connected,
    status,
    raceState,
    modes,
    loading,
    error,
    refetch: fetchStatus,
    // Computed states
    isRacing,
    isInLights,
    isStopped,
    isReady
  }
}

export default useCuStatus
