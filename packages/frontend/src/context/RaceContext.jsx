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
  const [elapsed, setElapsed] = useState(0)
  const [remaining, setRemaining] = useState(null)

  // Free practice state
  const [currentTrackId, setCurrentTrackId] = useState(null)
  const [controllerConfigs, setControllerConfigs] = useState([])
  const [freePracticeBoard, setFreePracticeBoard] = useState({})

  // Socket reference
  const socketRef = useRef(null)
  const [socketConnected, setSocketConnected] = useState(false)

  // Refs for current values (to avoid stale closures)
  const stateRef = useRef(state)
  const trackIdRef = useRef(currentTrackId)
  const configsRef = useRef(controllerConfigs)

  useEffect(() => { stateRef.current = state }, [state])
  useEffect(() => { trackIdRef.current = currentTrackId }, [currentTrackId])
  useEffect(() => { configsRef.current = controllerConfigs }, [controllerConfigs])

  // Initialize socket connection
  useEffect(() => {
    const socket = io(WS_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000
    })
    socketRef.current = socket

    socket.on('connect', () => {
      setSocketConnected(true)
      refreshState()
    })

    socket.on('disconnect', () => {
      setSocketConnected(false)
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

    // Ignore simulator events - handled by Home.jsx (/simulator page)
    socket.on('race:status', () => {})

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

  // Start qualifying session
  const startQualifying = useCallback(async (params) => {
    // Optimistic update
    setState(RACE_STATES.PENDING)
    const data = await apiCall('/qualifying/start', 'POST', params)
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

  // Start (green flag)
  const start = useCallback(async () => {
    setState(RACE_STATES.RUNNING)
    const data = await apiCall('/start', 'POST')
    if (data.success === false) {
      await refreshState()
    }
    return data
  }, [apiCall, refreshState])

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

  const value = {
    // State
    state,
    session,
    leaderboard,
    config,
    cuConnected,
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

    // Actions
    startQualifying,
    startRace,
    start,
    pause,
    resume,
    finish,
    stop,
    dismiss,
    refreshState,
    updateConfig,

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
