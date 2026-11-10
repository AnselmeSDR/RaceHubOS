import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { RUNNING_SESSION_STATUSES, SessionStatus, SessionType } from '@racehubos/shared'
import { fastestLapOf, maxLapsOf, toLeaderboardEntries } from '../lib/leaderboardEntries'
import { useApp } from './AppContext'
import { useVoice } from './VoiceContext'
import { announceFinish, bestLapLine } from './session/announcements'
import * as requests from './session/sessionRequests'
import { EMPTY_TIMING, heartbeatTiming, leaderboardIn, loadedTiming } from './session/sessionTiming'
import { useIsStale } from './session/useIsStale'
import { useSessionSocket } from './session/useSessionSocket'

const SessionContext = createContext(null)

export function SessionProvider({ children }) {
  const { setSessionActive } = useApp()
  const voice = useVoice()

  const [session, setSession] = useState(null)
  const [leaderboard, setLeaderboard] = useState([])
  const [timing, setTiming] = useState(EMPTY_TIMING)
  const [finishingSession, setFinishingSession] = useState(null)
  const [sessionResults, setSessionResults] = useState(null)
  const [lastServerTime, setLastServerTime] = useState(null)
  const isStale = useIsStale(lastServerTime)

  // The session on screen once rendered: loading another one first clears what is shown
  const shownIdRef = useRef(null)
  useEffect(() => {
    shownIdRef.current = session?.id ?? null
  }, [session?.id])

  // ==================== Server events ====================

  useSessionSocket({
    'session:leaderboard': (data) => {
      const received = leaderboardIn(data)
      if (received) setLeaderboard(received)
    },
    'race:session': setSession,
    'session:status_changed': (data) => {
      if (data.sessionId && data.status) {
        setSession((prev) => (prev?.id === data.sessionId ? { ...prev, status: data.status } : prev))
      }
      if (data.timestamp) setLastServerTime(data.timestamp)
    },
    'session:finishing': ({ sessionId, endsAt, gracePeriodMs, reason }) =>
      setFinishingSession({ sessionId, endsAt, gracePeriodMs, reason }),
    'session:finished': (data) => {
      setSession((prev) => {
        if (prev?.id !== data.sessionId) return prev
        const drivers = data.leaderboard?.length > 0 ? data.leaderboard : prev.drivers
        return { ...prev, status: SessionStatus.FINISHED, drivers }
      })
      setFinishingSession(null)
      // The final leaderboard stays shown
      if (Array.isArray(data.leaderboard)) setLeaderboard(data.leaderboard)
      setSessionResults({ sessionId: data.sessionId, championshipId: data.championshipId, reason: data.reason })
      // No podium for a balancing session
      if (data.sessionType !== SessionType.BALANCING) announceFinish(voice, data)
    },
    'positions:updated': (positions) => {
      if (Array.isArray(positions)) setLeaderboard(positions)
    },
    'session:heartbeat': (data) => {
      setLastServerTime(new Date().toISOString())
      setTiming((prev) => heartbeatTiming(prev, data))
      // The heartbeat's leaderboard resyncs a page just reloaded
      if (Array.isArray(data.leaderboard)) setLeaderboard(data.leaderboard)
    },
    'session:bestlap': (data) => {
      if (data.sessionType === SessionType.BALANCING) return
      const line = bestLapLine(voice, data)
      if (line) voice.speak(line)
    },
  })

  // ==================== Session API ====================

  const fetchSession = useCallback(async (sessionId) => {
    try {
      const body = await requests.getSession(sessionId)
      if (!body.success) return null
      setSession(body.data)
      return body.data
    } catch (error) {
      console.error('[SessionContext] Error fetching session:', error)
      return null
    }
  }, [])

  // The latest free session (no championship) of this type on this track, created when there is none
  const findOrCreateFreeSession = useCallback(async ({ trackId, type, autoCreate = true }) => {
    try {
      const found = await requests.findFreeSession(trackId, type)
      if (found || !autoCreate) {
        setSession(found)
        return found
      }
      const created = await requests.createFreeSession(trackId, type)
      if (created) setSession(created)
      return created
    } catch (error) {
      console.error('[SessionContext] Error finding/creating free session:', error)
      return null
    }
  }, [])

  const createSession = useCallback(async (params) => {
    try {
      const body = await requests.createSession(params)
      if (body.success) setSession(body.data)
      return body
    } catch (error) {
      console.error('[SessionContext] Error creating session:', error)
      return { success: false, error: error.message }
    }
  }, [])

  // The session, its clock and its leaderboard; the previous session's data is cleared on a switch
  const loadSession = useCallback(async (sessionId) => {
    if (!sessionId) return { success: false, error: 'No session ID' }

    if (shownIdRef.current !== sessionId) {
      setLeaderboard([])
      setTiming(EMPTY_TIMING)
    }

    try {
      const loaded = await requests.fetchSessionToLoad(sessionId)
      if (!loaded.ok) {
        console.warn('[SessionContext] Fetch session failed:', loaded.error)
        return { success: false, error: loaded.error }
      }
      const { session: sessionInfo } = loaded
      setSession(sessionInfo)
      setTiming((prev) => loadedTiming(prev, sessionInfo))
      if (!sessionInfo.startedAt) setFinishingSession(null)

      const stored = await requests.prepareSession(sessionInfo)
      if (stored) setLeaderboard(stored)
      return { success: true, session: sessionInfo }
    } catch (error) {
      console.error('[SessionContext] Error loading session:', error)
      return { success: false, error: error.message }
    }
  }, [])

  // start, pause, resume, stop, reset: the server answers with the session as it now is
  const runAction = useCallback(async (sessionId, action) => {
    try {
      const body = await requests.postSessionAction(sessionId, action)
      if (body.success) setSession(body.data)
      return body
    } catch (error) {
      console.error(`[SessionContext] Error on session ${action}:`, error)
      return { success: false, error: error.message }
    }
  }, [])

  const startSession = useCallback((sessionId) => runAction(sessionId, 'start'), [runAction])
  const pauseSession = useCallback((sessionId) => runAction(sessionId, 'pause'), [runAction])
  const resumeSession = useCallback((sessionId) => runAction(sessionId, 'resume'), [runAction])
  const stopSession = useCallback((sessionId) => runAction(sessionId, 'stop'), [runAction])

  const clearSessionData = useCallback(() => {
    setLeaderboard([])
    setTiming(EMPTY_TIMING)
    setFinishingSession(null)
    setSessionResults(null)
  }, [])

  const resetSession = useCallback(
    async (sessionId) => {
      const body = await runAction(sessionId, 'reset')
      if (body.success) clearSessionData()
      return body
    },
    [runAction, clearSessionData]
  )

  const clearSession = useCallback(() => {
    setSession(null)
    clearSessionData()
  }, [clearSessionData])

  const clearSessionResults = useCallback(() => setSessionResults(null), [])

  // ==================== Derived state ====================

  // A running session (balancing aside) takes the whole screen
  const ongoing = RUNNING_SESSION_STATUSES.includes(session?.status) && session?.type !== SessionType.BALANCING
  useEffect(() => {
    setSessionActive(ongoing)
  }, [ongoing, setSessionActive])

  // The live leaderboard, or the session's drivers before the first lap
  const sessionDrivers = session?.drivers
  const entries = useMemo(
    () => toLeaderboardEntries(leaderboard.length > 0 ? leaderboard : sessionDrivers || [], { liveDeltas: true }),
    [leaderboard, sessionDrivers]
  )
  const maxLapsCompleted = useMemo(() => maxLapsOf(leaderboard), [leaderboard])
  const fastestLap = useMemo(() => fastestLapOf(leaderboard), [leaderboard])

  const value = {
    session,
    setSession,
    leaderboard,
    entries,
    maxLapsCompleted,
    fastestLap,
    ...timing,
    finishingSession,
    sessionResults,

    lastServerTime,
    isStale,

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

    isActive: session?.status === SessionStatus.ACTIVE,
    isFinishing: session?.status === SessionStatus.FINISHING,
    isFinished: session?.status === SessionStatus.FINISHED,
  }

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession() {
  const context = useContext(SessionContext)
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider')
  }
  return context
}

export default SessionContext
