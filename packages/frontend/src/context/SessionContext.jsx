import { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { io } from 'socket.io-client'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3000'

export const SESSION_STATUS = {
  DRAFT: 'draft',
  READY: 'ready',
  ACTIVE: 'active',
  FINISHING: 'finishing',
  FINISHED: 'finished',
}

const SessionContext = createContext(null)

export function SessionProvider({ children }) {
  // Current session
  const [session, setSession] = useState(null)
  const [leaderboard, setLeaderboard] = useState([])

  // Timing
  const [elapsed, setElapsed] = useState(0)
  const [remaining, setRemaining] = useState(null)
  const [gracePeriodRemaining, setGracePeriodRemaining] = useState(null)
  const [pauseDuration, setPauseDuration] = useState(null)
  const [totalPauseDuration, setTotalPauseDuration] = useState(0)
  const [pauses, setPauses] = useState([])
  const [startedAt, setStartedAt] = useState(null)

  // Session lifecycle
  const [finishingSession, setFinishingSession] = useState(null)
  const [sessionResults, setSessionResults] = useState(null)

  // Data freshness
  const [lastServerTime, setLastServerTime] = useState(null)
  const [isStale, setIsStale] = useState(false)

  // Socket ref
  const socketRef = useRef(null)

  // Check data freshness
  useEffect(() => {
    const interval = setInterval(() => {
      if (!lastServerTime) {
        setIsStale(false)
        return
      }
      const age = Date.now() - new Date(lastServerTime).getTime()
      setIsStale(age > 2000)
    }, 500)
    return () => clearInterval(interval)
  }, [lastServerTime])

  // Initialize socket
  useEffect(() => {
    const socket = io(WS_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    })
    socketRef.current = socket

    // Leaderboard updates
    socket.on('session:leaderboard', (data) => {
      if (Array.isArray(data)) {
        setLeaderboard(data)
      } else if (data.leaderboard && Array.isArray(data.leaderboard)) {
        setLeaderboard(data.leaderboard)
      }
    })

    // Session updates
    socket.on('race:session', (data) => {
      setSession(data)
    })

    // Session status changes
    socket.on('session:status_changed', (data) => {
      if (data.sessionId && data.status) {
        setSession(prev => prev?.id === data.sessionId ? { ...prev, status: data.status } : prev)
      }
      if (data.timestamp) setLastServerTime(data.timestamp)
      window.dispatchEvent(new CustomEvent('session:status_changed', { detail: data }))
    })

    // Session finishing
    socket.on('session:finishing', (data) => {
      setFinishingSession({
        sessionId: data.sessionId,
        endsAt: data.endsAt,
        gracePeriodMs: data.gracePeriodMs,
        reason: data.reason,
      })
    })

    // Session finished
    socket.on('session:finished', (data) => {
      setSession(prev => prev?.id === data.sessionId ? { ...prev, status: 'finished' } : prev)
      setFinishingSession(null)
      // Keep final leaderboard
      if (data.leaderboard && Array.isArray(data.leaderboard)) {
        setLeaderboard(data.leaderboard)
      }
      setSessionResults({
        sessionId: data.sessionId,
        championshipId: data.championshipId,
        reason: data.reason,
      })
      window.dispatchEvent(new CustomEvent('session:finished', { detail: data }))
    })

    // Real-time positions
    socket.on('positions:updated', (positions) => {
      if (Array.isArray(positions)) {
        setLeaderboard(positions)
      }
    })

    // Heartbeat (timing updates + leaderboard)
    socket.on('session:heartbeat', (data) => {
      setLastServerTime(new Date().toISOString())
      if (data.elapsedTime !== undefined) setElapsed(Math.floor(data.elapsedTime / 1000))
      if (data.remainingTime !== undefined) setRemaining(Math.floor(data.remainingTime / 1000))
      if (data.gracePeriodRemaining !== undefined) {
        setGracePeriodRemaining(data.gracePeriodRemaining > 0 ? Math.ceil(data.gracePeriodRemaining / 1000) : null)
      }
      setPauseDuration(data.pauseDuration ? Math.floor(data.pauseDuration / 1000) : null)
      setTotalPauseDuration(data.totalPauseDuration ? Math.floor(data.totalPauseDuration / 1000) : 0)
      setPauses(data.pauses || [])
      if (data.startedAt) setStartedAt(data.startedAt)
      // Update leaderboard from heartbeat (ensures data sync on refresh)
      if (data.leaderboard && Array.isArray(data.leaderboard)) {
        setLeaderboard(data.leaderboard)
      }
    })

    // Championship events
    socket.on('championship:standings_changed', (data) => {
      window.dispatchEvent(new CustomEvent('championship:standings_changed', { detail: data }))
    })

    return () => {
      socket.disconnect()
    }
  }, [])

  // ==================== Session API ====================

  // Fetch session by ID
  const fetchSession = useCallback(async (sessionId) => {
    try {
      const response = await fetch(`${API_URL}/api/sessions/${sessionId}`)
      const data = await response.json()
      if (data.success) {
        setSession(data.data)
        return data.data
      }
      return null
    } catch (error) {
      console.error('[SessionContext] Error fetching session:', error)
      return null
    }
  }, [])

  // Find or create free session (no championship)
  const findOrCreateFreeSession = useCallback(async ({ trackId, type, autoCreate = true }) => {
    try {
      const searchParams = new URLSearchParams({
        trackId,
        type,
        championshipId: 'null'
      })
      const searchRes = await fetch(`${API_URL}/api/sessions?${searchParams}`)
      const searchData = await searchRes.json()

      if (searchData.success && searchData.data?.length > 0) {
        // Return most recent session (sorted by createdAt desc)
        const sorted = [...searchData.data].sort((a, b) =>
          new Date(b.createdAt) - new Date(a.createdAt)
        )
        const latestSession = sorted[0]
        setSession(latestSession)
        return latestSession
      }

      // Create new session only if autoCreate is true
      if (!autoCreate) {
        setSession(null)
        return null
      }

      const createRes = await fetch(`${API_URL}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackId, type, name: `${type} libre` })
      })
      const createData = await createRes.json()

      if (createData.success) {
        setSession(createData.data)
        return createData.data
      }

      return null
    } catch (error) {
      console.error('[SessionContext] Error finding/creating free session:', error)
      return null
    }
  }, [])

  // Create a new session
  const createSession = useCallback(async (params) => {
    try {
      const { championshipId, ...sessionParams } = params
      const url = championshipId
        ? `${API_URL}/api/championships/${championshipId}/sessions`
        : `${API_URL}/api/sessions`

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sessionParams),
      })
      const data = await response.json()

      if (data.success) {
        setSession(data.data)
      }
      return data
    } catch (error) {
      console.error('[SessionContext] Error creating session:', error)
      return { success: false, error: error.message }
    }
  }, [])

  // Load session - fetch data and optionally load into SyncService
  const loadSession = useCallback(async (sessionId) => {
    if (!sessionId) return { success: false, error: 'No session ID' }

    // Clear previous session data immediately
    setLeaderboard([])
    setElapsed(0)
    setRemaining(null)
    setGracePeriodRemaining(null)
    setStartedAt(null)
    setPauses([])

    try {
      // First, get session data
      const sessionRes = await fetch(`${API_URL}/api/sessions/${sessionId}`)
      const sessionData = await sessionRes.json()

      if (!sessionRes.ok || !sessionData.success) {
        console.warn('[SessionContext] Fetch session failed:', sessionData.error)
        return { success: false, error: sessionData.error }
      }

      const sessionInfo = sessionData.data
      setSession(sessionInfo)

      // Initialize timing state from session data
      if (sessionInfo.startedAt) setStartedAt(sessionInfo.startedAt)
      if (sessionInfo.pauses) {
        const pausesData = typeof sessionInfo.pauses === 'string' ? JSON.parse(sessionInfo.pauses) : sessionInfo.pauses
        setPauses(pausesData)

        // Calculate total pause duration from pauses array
        const totalPause = pausesData.reduce((sum, p) => {
          if (p.end) return sum + (p.end - p.start)
          return sum
        }, 0)
        setTotalPauseDuration(Math.floor(totalPause / 1000))
      }

      // For finished sessions, use drivers as leaderboard
      if (sessionInfo.status === 'finished' && sessionInfo.drivers) {
        const isRace = sessionInfo.type === 'race'
        const sorted = [...sessionInfo.drivers].sort((a, b) => (a.position || 99) - (b.position || 99))
        const leader = sorted[0]

        const leaderboardData = sorted.map((sd, idx) => {
          let gap = null
          if (idx > 0 && leader) {
            if (isRace) {
              const lapDiff = (leader.totalLaps || 0) - (sd.totalLaps || 0)
              gap = lapDiff > 0 ? lapDiff : (sd.totalTime || 0) - (leader.totalTime || 0)
            } else {
              if (leader.bestLapTime && sd.bestLapTime) {
                gap = sd.bestLapTime - leader.bestLapTime
              }
            }
          }
          return {
            id: sd.id,
            controller: sd.controller,
            driverId: sd.driverId,
            carId: sd.carId,
            driver: sd.driver,
            car: sd.car,
            position: sd.position || 0,
            totalLaps: sd.totalLaps || 0,
            totalTime: sd.totalTime || 0,
            bestLapTime: sd.bestLapTime || null,
            lastLapTime: sd.lastLapTime || null,
            gap,
            isDNF: sd.isDNF || false,
          }
        })
        setLeaderboard(leaderboardData)
        return { success: true, session: sessionInfo }
      }

      // For active/ready sessions, load into SyncService
      if (['ready', 'active', 'paused'].includes(sessionInfo.status)) {
        await fetch(`${API_URL}/api/sync/load-session/${sessionId}`, { method: 'POST' })
      }

      return { success: true, session: sessionInfo }
    } catch (error) {
      console.error('[SessionContext] Error loading session:', error)
      return { success: false, error: error.message }
    }
  }, [])

  // Start session
  const startSession = useCallback(async (sessionId) => {
    try {
      const response = await fetch(`${API_URL}/api/sessions/${sessionId}/start`, {
        method: 'POST',
      })
      const data = await response.json()

      if (data.success) {
        setSession(data.data)
      }
      return data
    } catch (error) {
      console.error('[SessionContext] Error starting session:', error)
      return { success: false, error: error.message }
    }
  }, [])

  // Pause session
  const pauseSession = useCallback(async (sessionId) => {
    try {
      const response = await fetch(`${API_URL}/api/sessions/${sessionId}/pause`, {
        method: 'POST',
      })
      const data = await response.json()

      if (data.success) {
        setSession(data.data)
      }
      return data
    } catch (error) {
      console.error('[SessionContext] Error pausing session:', error)
      return { success: false, error: error.message }
    }
  }, [])

  // Resume session
  const resumeSession = useCallback(async (sessionId) => {
    try {
      const response = await fetch(`${API_URL}/api/sessions/${sessionId}/resume`, {
        method: 'POST',
      })
      const data = await response.json()

      if (data.success) {
        setSession(data.data)
      }
      return data
    } catch (error) {
      console.error('[SessionContext] Error resuming session:', error)
      return { success: false, error: error.message }
    }
  }, [])

  // Stop session
  const stopSession = useCallback(async (sessionId) => {
    try {
      const response = await fetch(`${API_URL}/api/sessions/${sessionId}/stop`, {
        method: 'POST',
      })
      const data = await response.json()

      if (data.success) {
        setSession(data.data)
      }
      return data
    } catch (error) {
      console.error('[SessionContext] Error stopping session:', error)
      return { success: false, error: error.message }
    }
  }, [])

  // Reset session
  const resetSession = useCallback(async (sessionId) => {
    try {
      const response = await fetch(`${API_URL}/api/sessions/${sessionId}/reset`, {
        method: 'POST',
      })
      const data = await response.json()

      if (data.success) {
        setSession(data.data)
        setLeaderboard([])
      }
      return data
    } catch (error) {
      console.error('[SessionContext] Error resetting session:', error)
      return { success: false, error: error.message }
    }
  }, [])

  // Clear current session
  const clearSession = useCallback(() => {
    setSession(null)
    setLeaderboard([])
    setElapsed(0)
    setRemaining(null)
    setGracePeriodRemaining(null)
    setStartedAt(null)
    setPauses([])
    setSessionResults(null)
    setFinishingSession(null)
  }, [])

  // Clear session results
  const clearSessionResults = useCallback(() => {
    setSessionResults(null)
  }, [])

  // ==================== Helpers ====================

  const isActive = session?.status === 'active'
  const isFinishing = session?.status === 'finishing'
  const isFinished = session?.status === 'finished'

  // ==================== Computed Data ====================

  // Transform leaderboard to entries with computed fields
  // Falls back to session drivers if leaderboard is empty
  const entries = useMemo(() => {
    const source = leaderboard.length > 0 ? leaderboard : (session?.drivers || [])
    if (source.length === 0) return []

    // Find fastest lap
    const allBestLaps = source.map(p => p.bestLapTime).filter(t => t && t > 0)
    const fastestLap = allBestLaps.length > 0 ? Math.min(...allBestLaps) : null

    return source.map(p => ({
      id: p.id,
      controller: p.controller,
      driver: p.driver,
      car: p.car,
      stats: {
        laps: p.totalLaps || 0,
        bestLap: p.bestLapTime || null,
        lastLap: p.lastLapTime || null,
        totalTime: p.totalTime || 0,
        gap: p.gap ?? null
      },
      position: p.position || null,
      hasFastestLap: fastestLap && p.bestLapTime === fastestLap,
      isDNF: p.isDNF || false
    })).sort((a, b) => (a.position || 99) - (b.position || 99))
  }, [leaderboard, session])

  // Max laps completed
  const maxLapsCompleted = useMemo(() => {
    return Math.max(0, ...leaderboard.map(p => p.totalLaps || 0))
  }, [leaderboard])

  // Fastest lap time
  const fastestLap = useMemo(() => {
    const times = leaderboard.map(p => p.bestLapTime).filter(t => t && t > 0)
    return times.length > 0 ? Math.min(...times) : null
  }, [leaderboard])

  const value = {
    // Session state
    session,
    setSession,
    leaderboard,
    entries,
    maxLapsCompleted,
    fastestLap,
    elapsed,
    remaining,
    gracePeriodRemaining,
    pauseDuration,
    totalPauseDuration,
    pauses,
    startedAt,
    finishingSession,
    sessionResults,

    // Data freshness
    lastServerTime,
    isStale,

    // Session actions
    fetchSession,
    findOrCreateFreeSession,
    createSession,
    loadSession,
    startSession,
    pauseSession,
    resumeSession,
    stopSession,
    resetSession,
    clearSession,
    clearSessionResults,

    // Helpers
    isActive,
    isFinishing,
    isFinished,

    // Constants
    SESSION_STATUS,
  }

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  )
}

export function useSession() {
  const context = useContext(SessionContext)
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider')
  }
  return context
}

export default SessionContext
