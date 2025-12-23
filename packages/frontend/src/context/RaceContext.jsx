import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { io } from 'socket.io-client'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3000'

// Race states
export const RACE_STATES = {
  IDLE: 'IDLE',
  PENDING: 'PENDING',
  RUNNING: 'RUNNING',
  PAUSED: 'PAUSED',
  RESULTS: 'RESULTS'
}

const RaceContext = createContext(null)

export function RaceProvider({ children }) {
  // Core state
  const [state, setState] = useState(RACE_STATES.IDLE)
  const [session, setSession] = useState(null)
  const [leaderboard, setLeaderboard] = useState([])
  const [config, setConfig] = useState({}) // Controller configurations (1-6)
  const [cuConnected, setCuConnected] = useState(false)
  const [cuStatus, setCuStatus] = useState({ start: 8 }) // { start: 0-8, fuel, ... } - 8 = stopped by default
  const [elapsed, setElapsed] = useState(0)
  const [remaining, setRemaining] = useState(null)

  // Free practice state
  const [currentTrackId, setCurrentTrackId] = useState(null)
  const [controllerConfigs, setControllerConfigs] = useState([])
  const [freePracticeBoard, setFreePracticeBoard] = useState({})

  // Championship session state
  const [lastServerTime, setLastServerTime] = useState(null)
  const [isStale, setIsStale] = useState(false)
  const [finishingSession, setFinishingSession] = useState(null) // { sessionId, endsAt, remainingSeconds }
  const [sessionResults, setSessionResults] = useState(null) // Latest finished session results
  const [sessionLeaderboard, setSessionLeaderboard] = useState([]) // Real-time leaderboard for Q/R sessions

  // Socket reference
  const socketRef = useRef(null)
  const [socketConnected, setSocketConnected] = useState(false)

  // Refs for current values (to avoid stale closures)
  const stateRef = useRef(state)
  const trackIdRef = useRef(currentTrackId)
  const configsRef = useRef(controllerConfigs)
  const refreshStateRef = useRef(null)

  useEffect(() => { stateRef.current = state }, [state])
  useEffect(() => { trackIdRef.current = currentTrackId }, [currentTrackId])
  useEffect(() => { configsRef.current = controllerConfigs }, [controllerConfigs])

  // API helper
  const apiCall = useCallback(async (endpoint, method = 'GET', body = null) => {
    try {
      const options = {
        method,
        headers: { 'Content-Type': 'application/json' }
      }
      if (body) {
        options.body = JSON.stringify(body)
      }
      const response = await fetch(`${API_URL}/api/race${endpoint}`, options)
      const data = await response.json()
      return data
    } catch (error) {
      console.error(`[RaceContext] API error (${endpoint}):`, error)
      return { success: false, error: error.message }
    }
  }, [])

  // Refresh current state from backend
  const refreshState = useCallback(async () => {
    const data = await apiCall('/status')
    if (data.success !== false) {
      if (data.state) setState(data.state)
      if (data.session) setSession(data.session)
      if (data.leaderboard) setLeaderboard(data.leaderboard)
      if (data.config) setConfig(data.config)
      if (data.cuConnected !== undefined) setCuConnected(data.cuConnected)
      if (data.elapsed !== undefined) setElapsed(data.elapsed)
      if (data.remaining !== undefined) setRemaining(data.remaining)
    }
    return data
  }, [apiCall])

  // Keep ref updated for socket callback
  useEffect(() => { refreshStateRef.current = refreshState }, [refreshState])

  // Check data freshness every 500ms
  useEffect(() => {
    const interval = setInterval(() => {
      if (!lastServerTime) {
        setIsStale(false)
        return
      }
      const age = Date.now() - new Date(lastServerTime).getTime()
      setIsStale(age > 2000) // stale if > 2s without update
    }, 500)
    return () => clearInterval(interval)
  }, [lastServerTime])

  // Initialize socket connection
  useEffect(() => {
    const socket = io(WS_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      timeout: 60000,        // Connection timeout
      pingTimeout: 60000,    // Match server config
      pingInterval: 25000    // Match server config
    })
    socketRef.current = socket

    socket.on('connect', () => {
      console.log('[Socket] Connected')
      setSocketConnected(true)
      refreshStateRef.current?.()
    })

    socket.on('disconnect', (reason) => {
      console.warn('[Socket] Disconnected:', reason)
      setSocketConnected(false)
    })

    socket.on('reconnect', (attemptNumber) => {
      console.log('[Socket] Reconnected after', attemptNumber, 'attempts')
    })

    socket.on('reconnect_error', (error) => {
      console.error('[Socket] Reconnect error:', error.message)
    })

    // Race state events
    socket.on('race:state', (data) => {
      if (data.state) setState(data.state)
      if (data.elapsed !== undefined) setElapsed(data.elapsed)
      if (data.remaining !== undefined) setRemaining(data.remaining)
    })

    // Leaderboard updates
    socket.on('race:leaderboard', (data) => {
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

    // CU connection status
    socket.on('cu:connected', () => {
      setCuConnected(true)
    })

    socket.on('cu:disconnected', () => {
      setCuConnected(false)
    })

    // CU status updates (start state: 0=racing, 1-5=lights, 6=false start, 7=go, 8+=stopped)
    socket.on('cu:status', (status) => {
      setCuStatus(status)
    })

    // Ignore simulator events - handled by Home.jsx (/simulator page)
    socket.on('race:status', () => {})

    // Championship session events
    socket.on('session_status_changed', (data) => {
      // Update session status in state
      if (data.sessionId && data.status) {
        setSession(prev => prev?.id === data.sessionId ? { ...prev, status: data.status } : prev)
      }
      if (data.serverTime) setLastServerTime(data.serverTime)
    })

    socket.on('session_finishing', (data) => {
      // Trigger countdown, display "LAST LAP"
      setFinishingSession({
        sessionId: data.sessionId,
        championshipId: data.championshipId,
        endsAt: data.endsAt,
        remainingSeconds: data.remainingSeconds,
        reason: data.reason
      })
      if (data.serverTime) setLastServerTime(data.serverTime)
    })

    socket.on('session_finished', (data) => {
      // Update session, display results
      setSession(prev => prev?.id === data.sessionId ? { ...prev, status: 'finished' } : prev)
      setFinishingSession(null)
      setSessionResults({
        sessionId: data.sessionId,
        championshipId: data.championshipId,
        type: data.type,
        results: data.results
      })
      if (data.serverTime) setLastServerTime(data.serverTime)
      // Notify components to refetch sessions
      window.dispatchEvent(new CustomEvent('session_finished', { detail: data }))
    })

    socket.on('session_status_changed', (data) => {
      // Notify components to refetch sessions when status changes
      window.dispatchEvent(new CustomEvent('session_status_changed', { detail: data }))
    })

    socket.on('practice_reset', (data) => {
      // Clear practice leaderboard
      if (data.sessionId) {
        setFreePracticeBoard({})
      }
      if (data.serverTime) setLastServerTime(data.serverTime)
    })

    socket.on('standings_changed', (data) => {
      // This event notifies that standings need to be refetched
      // Components listening should refetch standings via API
      // We emit a custom event that components can subscribe to
      window.dispatchEvent(new CustomEvent('standings_changed', { detail: data }))
    })

    // Real-time leaderboard updates for Q/R sessions
    socket.on('positions:updated', (positions) => {
      if (Array.isArray(positions)) {
        setSessionLeaderboard(positions)
      }
    })

    socket.on('heartbeat', (data) => {
      // Update timer, calculate freshness
      if (data.serverTime) setLastServerTime(data.serverTime)
      if (data.data) {
        // Convert from milliseconds to seconds
        if (data.data.elapsedTime !== undefined) setElapsed(Math.floor(data.data.elapsedTime / 1000))
        if (data.data.remainingTime !== undefined) setRemaining(Math.floor(data.data.remainingTime / 1000))
      }
    })

    // Free practice lap events - record laps even when not on /race page
    const handleLapEvent = async (lapData) => {
      // Only record in free practice mode (IDLE state)
      if (stateRef.current !== RACE_STATES.IDLE) return

      const controller = String(lapData.controller || lapData.carId || lapData.address + 1)
      const lapTime = lapData.lapTime || lapData.time

      if (!lapTime || lapTime <= 0) return

      // Update local leaderboard with position tracking
      setFreePracticeBoard(prev => {
        const existing = prev[controller] || { laps: 0, bestLap: null, lastLap: null, totalTime: 0, position: 99 }

        // Create updated entry
        const updated = {
          ...prev,
          [controller]: {
            ...existing,
            laps: existing.laps + 1,
            bestLap: existing.bestLap === null ? lapTime : Math.min(existing.bestLap, lapTime),
            lastLap: lapTime,
            totalTime: existing.totalTime + lapTime,
            lastUpdate: Date.now()
          }
        }

        // Calculate new positions
        const sorted = Object.entries(updated)
          .sort((a, b) => {
            if (b[1].laps !== a[1].laps) return b[1].laps - a[1].laps
            if (!a[1].bestLap) return 1
            if (!b[1].bestLap) return -1
            return a[1].bestLap - b[1].bestLap
          })

        // Update positions and calculate deltas
        sorted.forEach(([ctrl, data], index) => {
          const newPosition = index + 1
          const oldPosition = data.position || newPosition
          updated[ctrl] = {
            ...data,
            position: newPosition,
            prevPosition: oldPosition,
            positionDelta: oldPosition - newPosition, // positive = gained, negative = lost
            positionChanged: oldPosition !== newPosition ? Date.now() : data.positionChanged
          }
        })

        return updated
      })

      // Save to database if we have track and config
      const trackId = trackIdRef.current
      const configs = configsRef.current
      const config = configs.find(c => String(c.controller) === controller)

      if (trackId && config?.driverId && config?.carId) {
        try {
          await fetch(`${API_URL}/api/laps/free`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              trackId,
              driverId: config.driverId,
              carId: config.carId,
              controller,
              lapTime
            })
          })
        } catch {
          // Silently fail
        }
      }
    }

    socket.on('race:lap', handleLapEvent)
    socket.on('cu:timer', handleLapEvent)

    return () => {
      socket.disconnect()
    }
  }, [])

  // Start qualifying session
  const startQualifying = useCallback(async (params) => {
    // Optimistic update
    setState(RACE_STATES.PENDING)
    const data = await apiCall('/qualif/start', 'POST', params)
    if (data.success === false) {
      // Revert on failure
      await refreshState()
    }
    return data
  }, [apiCall, refreshState])

  // Start race session
  const startRace = useCallback(async (params) => {
    // Optimistic update
    setState(RACE_STATES.PENDING)
    const data = await apiCall('/race/start', 'POST', params)
    if (data.success === false) {
      await refreshState()
    }
    return data
  }, [apiCall, refreshState])

  // Start (green flag) - legacy
  const start = useCallback(async () => {
    setState(RACE_STATES.RUNNING)
    const data = await apiCall('/start', 'POST')
    if (data.success === false) {
      await refreshState()
    }
    return data
  }, [apiCall, refreshState])

  // Trigger CU start (sends START signal to CU - toggles lights/racing)
  const triggerCuStart = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/bluetooth/start-race`, { method: 'POST' })
      return await response.json()
    } catch (error) {
      console.error('[RaceContext] Error triggering CU start:', error)
      return { success: false, error: error.message }
    }
  }, [])

  // Pause
  const pause = useCallback(async () => {
    setState(RACE_STATES.PAUSED)
    const data = await apiCall('/pause', 'POST')
    if (data.success === false) {
      await refreshState()
    }
    return data
  }, [apiCall, refreshState])

  // Resume
  const resume = useCallback(async () => {
    setState(RACE_STATES.RUNNING)
    const data = await apiCall('/resume', 'POST')
    if (data.success === false) {
      await refreshState()
    }
    return data
  }, [apiCall, refreshState])

  // Finish (checkered flag)
  const finish = useCallback(async () => {
    setState(RACE_STATES.RESULTS)
    const data = await apiCall('/finish', 'POST')
    if (data.success === false) {
      await refreshState()
    }
    return data
  }, [apiCall, refreshState])

  // Stop (abort)
  const stop = useCallback(async () => {
    setState(RACE_STATES.IDLE)
    const data = await apiCall('/stop', 'POST')
    if (data.success === false) {
      await refreshState()
    }
    return data
  }, [apiCall, refreshState])

  // Dismiss results and go back to idle
  const dismiss = useCallback(async () => {
    setState(RACE_STATES.IDLE)
    setSession(null)
    setLeaderboard([])
    setElapsed(0)
    setRemaining(null)
    const data = await apiCall('/dismiss', 'POST')
    return data
  }, [apiCall])

  // Update controller config
  const updateConfig = useCallback((controller, configData) => {
    setConfig(prev => ({
      ...prev,
      [controller]: { ...prev[controller], ...configData }
    }))
  }, [])

  // Reset free practice board
  const resetFreePracticeBoard = useCallback(() => {
    setFreePracticeBoard({})
  }, [])

  // Clear session results (after viewing)
  const clearSessionResults = useCallback(() => {
    setSessionResults(null)
  }, [])

  // Clear finishing session state
  const clearFinishingSession = useCallback(() => {
    setFinishingSession(null)
  }, [])

  // ==================== Session API Methods ====================
  // These methods use /api/sessions/:id endpoints (aligned with SyncService)

  // Start a session by ID
  const startSessionById = useCallback(async (sessionId) => {
    try {
      const response = await fetch(`${API_URL}/api/sessions/${sessionId}/start`, { method: 'POST' })
      const data = await response.json()
      if (data.success) {
        setSession(data.data)
        setState(RACE_STATES.RUNNING)
      }
      return data
    } catch (error) {
      console.error('[RaceContext] Error starting session:', error)
      return { success: false, error: error.message }
    }
  }, [])

  // Pause active session
  const pauseSessionById = useCallback(async (sessionId) => {
    try {
      const response = await fetch(`${API_URL}/api/sessions/${sessionId}/pause`, { method: 'POST' })
      const data = await response.json()
      if (data.success) {
        setSession(data.data)
        setState(RACE_STATES.PAUSED)
      }
      return data
    } catch (error) {
      console.error('[RaceContext] Error pausing session:', error)
      return { success: false, error: error.message }
    }
  }, [])

  // Resume paused session
  const resumeSessionById = useCallback(async (sessionId) => {
    try {
      const response = await fetch(`${API_URL}/api/sessions/${sessionId}/resume`, { method: 'POST' })
      const data = await response.json()
      if (data.success) {
        setSession(data.data)
        setState(RACE_STATES.RUNNING)
      }
      return data
    } catch (error) {
      console.error('[RaceContext] Error resuming session:', error)
      return { success: false, error: error.message }
    }
  }, [])

  // Stop session (finish)
  const stopSessionById = useCallback(async (sessionId) => {
    try {
      const response = await fetch(`${API_URL}/api/sessions/${sessionId}/stop`, { method: 'POST' })
      const data = await response.json()
      if (data.success) {
        setSession(data.data)
        setState(RACE_STATES.RESULTS)
      }
      return data
    } catch (error) {
      console.error('[RaceContext] Error stopping session:', error)
      return { success: false, error: error.message }
    }
  }, [])

  // Restart session (reset data, back to ready)
  const restartSessionById = useCallback(async (sessionId) => {
    try {
      const response = await fetch(`${API_URL}/api/sessions/${sessionId}/restart`, { method: 'POST' })
      const data = await response.json()
      if (data.success) {
        setSession(data.data)
        setState(RACE_STATES.PENDING)
      }
      return data
    } catch (error) {
      console.error('[RaceContext] Error restarting session:', error)
      return { success: false, error: error.message }
    }
  }, [])

  const value = {
    // State
    state,
    session,
    leaderboard,
    config,
    cuConnected,
    cuStatus,
    elapsed,
    remaining,
    socketConnected,

    // Free practice state
    currentTrackId,
    setCurrentTrackId,
    controllerConfigs,
    setControllerConfigs,
    freePracticeBoard,
    resetFreePracticeBoard,

    // Championship session state
    lastServerTime,
    isStale,
    finishingSession,
    sessionResults,
    sessionLeaderboard,
    clearSessionResults,
    clearFinishingSession,

    // Actions (legacy /api/race endpoints)
    startQualifying,
    startRace,
    start,
    triggerCuStart,
    pause,
    resume,
    finish,
    stop,
    dismiss,
    refreshState,
    updateConfig,

    // Session actions (/api/sessions/:id endpoints)
    startSessionById,
    pauseSessionById,
    resumeSessionById,
    stopSessionById,
    restartSessionById,

    // Constants
    RACE_STATES
  }

  return (
    <RaceContext.Provider value={value}>
      {children}
    </RaceContext.Provider>
  )
}

// Custom hook for consuming the context
export function useRace() {
  const context = useContext(RaceContext)
  if (!context) {
    throw new Error('useRace must be used within a RaceProvider')
  }
  return context
}

export default RaceContext
