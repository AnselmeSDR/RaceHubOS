import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams } from 'react-router-dom'

// Components
import ChampionshipHeader from '../components/championship/ChampionshipHeader'
import SessionSection from '../components/championship/SessionSection'
import SessionConfigModal from '../components/championship/SessionConfigModal'
import StandingsTabs from '../components/championship/StandingsTabs'
import SessionLeaderboard from '../components/race/SessionLeaderboard'
import { DataFreshnessIndicator } from '../components/ui'
import ChampionshipConfigModal from '../components/championship/ChampionshipConfigModal'

// Context
import { useDevice } from '../context/DeviceContext'
import { useSession } from '../context/SessionContext'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export default function ChampionshipDetail() {
  const { id } = useParams()

  // Device context
  const {
    startRace: triggerCuStart,
  } = useDevice()

  // Session context
  const {
    entries: sessionEntries,
    lastServerTime,
    finishingSession,
    loadSession,
    startSession,
    pauseSession,
    resumeSession,
    stopSession,
    resetSession,
  } = useSession()

  // Data state
  const [championship, setChampionship] = useState(null)
  const [sessions, setSessions] = useState([])
  const [drivers, setDrivers] = useState([])
  const [cars, setCars] = useState([])
  const [tracks, setTracks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // UI state
  const [selectedSessionId, setSelectedSessionId] = useState(() => {
    return localStorage.getItem(`championship_${id}_session`) || null
  })
  const [standingsTab, setStandingsTab] = useState('practice')
  const [practiceSortBy, setPracticeSortBy] = useState('laps')

  // Modal state
  const [showChampionshipConfig, setShowChampionshipConfig] = useState(false)
  const [configSession, setConfigSession] = useState(null)

  // Standings data
  const [standings, setStandings] = useState({
    practice: [],
    qualif: [],
    race: []
  })

  // Persist selected session
  useEffect(() => {
    if (selectedSessionId) {
      localStorage.setItem(`championship_${id}_session`, selectedSessionId)
    } else {
      localStorage.removeItem(`championship_${id}_session`)
    }
  }, [id, selectedSessionId])

  // Fetch championship
  const fetchChampionship = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/championships/${id}`)
      const data = await res.json()
      if (data.success) {
        setChampionship(data.data)
      }
    } catch (err) {
      console.error('Error fetching championship:', err)
      setError(err.message)
    }
  }, [id])

  // Fetch sessions
  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/sessions?championshipId=${id}`)
      const data = await res.json()
      if (data.success) {
        setSessions(data.data)
        // Auto-select first session if none selected
        if (!selectedSessionId && data.data.length > 0) {
          setSelectedSessionId(data.data[0].id)
        }
      }
    } catch (err) {
      console.error('Error fetching sessions:', err)
    }
  }, [id, selectedSessionId])

  // Fetch drivers, cars, tracks
  const fetchData = useCallback(async () => {
    try {
      const [driversRes, carsRes, tracksRes] = await Promise.all([
        fetch(`${API_URL}/api/drivers`),
        fetch(`${API_URL}/api/cars`),
        fetch(`${API_URL}/api/tracks`)
      ])
      const [driversData, carsData, tracksData] = await Promise.all([
        driversRes.json(),
        carsRes.json(),
        tracksRes.json()
      ])
      if (driversData.success) setDrivers(driversData.data)
      if (carsData.success) setCars(carsData.data)
      if (tracksData.success) setTracks(tracksData.data)
    } catch (err) {
      console.error('Error fetching data:', err)
    }
  }, [])

  // Fetch standings
  const fetchStandings = useCallback(async () => {
    try {
      const [practiceRes, qualifRes, raceRes] = await Promise.all([
        fetch(`${API_URL}/api/championships/${id}/standings?type=practice`),
        fetch(`${API_URL}/api/championships/${id}/standings?type=qualif`),
        fetch(`${API_URL}/api/championships/${id}/standings?type=race`)
      ])
      const [practiceData, qualifData, raceData] = await Promise.all([
        practiceRes.json(),
        qualifRes.json(),
        raceRes.json()
      ])
      setStandings({
        practice: practiceData.standings || [],
        qualif: qualifData.standings || [],
        race: raceData.standings || []
      })
    } catch (err) {
      console.error('Error fetching standings:', err)
    }
  }, [id])

  // Initial load
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      await Promise.all([
        fetchChampionship(),
        fetchSessions(),
        fetchData(),
        fetchStandings()
      ])
      setLoading(false)
    }
    load()
  }, [fetchChampionship, fetchSessions, fetchData, fetchStandings])

  // Load session into SyncService when selected (only if it exists in sessions list)
  useEffect(() => {
    if (selectedSessionId && sessions.length > 0) {
      const sessionExists = sessions.some(s => s.id === selectedSessionId)
      if (sessionExists) {
        loadSession(selectedSessionId)
      } else {
        // Session was deleted, clear selection
        setSelectedSessionId(sessions[0]?.id || null)
      }
    }
  }, [selectedSessionId, sessions, loadSession])

  // Listen for events
  useEffect(() => {
    const handleStandingsChanged = () => fetchStandings()
    const handleSessionChange = () => {
      fetchSessions()
      fetchStandings()
    }

    window.addEventListener('championship:standings_changed', handleStandingsChanged)
    window.addEventListener('session:finished', handleSessionChange)
    window.addEventListener('session:status_changed', handleSessionChange)

    return () => {
      window.removeEventListener('championship:standings_changed', handleStandingsChanged)
      window.removeEventListener('session:finished', handleSessionChange)
      window.removeEventListener('session:status_changed', handleSessionChange)
    }
  }, [fetchSessions, fetchStandings])

  // Selected session
  const selectedSession = useMemo(() => {
    return sessions.find(s => s.id === selectedSessionId) || null
  }, [sessions, selectedSessionId])

  // Sync standings tab with selected session type
  useEffect(() => {
    if (selectedSession?.type) {
      setStandingsTab(selectedSession.type)
    }
  }, [selectedSession?.type])

  // Handlers
  const handleSelectSession = useCallback((session) => {
    setSelectedSessionId(session.id)
  }, [])

  const handleSessionConfig = useCallback((session) => {
    setConfigSession(session)
  }, [])

  const handleStartSession = useCallback(async () => {
    if (!selectedSession) return
    const result = await startSession(selectedSession.id)
    if (result.success) fetchSessions()
  }, [selectedSession, startSession, fetchSessions])

  const handlePauseSession = useCallback(async () => {
    if (!selectedSession) return
    const result = await pauseSession(selectedSession.id)
    if (result.success) fetchSessions()
  }, [selectedSession, pauseSession, fetchSessions])

  const handleResumeSession = useCallback(async () => {
    if (!selectedSession) return
    const result = await resumeSession(selectedSession.id)
    if (result.success) fetchSessions()
  }, [selectedSession, resumeSession, fetchSessions])

  const handleStopSession = useCallback(async () => {
    if (!selectedSession) return
    const result = await stopSession(selectedSession.id)
    if (result.success) {
      fetchSessions()
      fetchStandings()
    }
  }, [selectedSession, stopSession, fetchSessions, fetchStandings])

  // Session config handlers
  const handleSaveSessionConfig = useCallback(async (data) => {
    if (!configSession) return

    try {
      await fetch(`${API_URL}/api/sessions/${configSession.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          maxDuration: data.maxDuration,
          maxLaps: data.maxLaps,
          gracePeriod: data.gracePeriod
        })
      })

      if (data.status !== configSession.status) {
        await fetch(`${API_URL}/api/sessions/${configSession.id}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: data.status })
        })
      }

      if (data.drivers?.length > 0) {
        await fetch(`${API_URL}/api/sessions/${configSession.id}/drivers`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ drivers: data.drivers })
        })
      }

      fetchSessions()
      setConfigSession(null)
    } catch (err) {
      console.error('Error saving session config:', err)
    }
  }, [configSession, fetchSessions])

  const handleDeleteSession = useCallback(async (sessionId) => {
    try {
      await fetch(`${API_URL}/api/sessions/${sessionId}`, { method: 'DELETE' })
      fetchSessions()
      fetchStandings()
      if (selectedSessionId === sessionId) {
        setSelectedSessionId(null)
      }
    } catch (err) {
      console.error('Error deleting session:', err)
    }
  }, [fetchSessions, fetchStandings, selectedSessionId])

  const handleResetSession = useCallback(async (sessionId) => {
    const result = await resetSession(sessionId)
    if (result.success) {
      fetchSessions()
      fetchStandings()
    }
  }, [resetSession, fetchSessions, fetchStandings])

  const handleSessionsChange = useCallback(() => {
    fetchSessions()
    fetchStandings()
  }, [fetchSessions, fetchStandings])

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500" />
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-red-500">Erreur: {error}</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Championship Header */}
      <ChampionshipHeader
        championship={championship}
        sessions={sessions}
        selectedSession={selectedSession}
        onSelectSession={handleSelectSession}
        onConfig={() => setShowChampionshipConfig(true)}
      />

      {/* Main content */}
      <div className="p-4 lg:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column: Session + Leaderboard */}
          <div className="lg:col-span-2 space-y-4">
            {/* Data freshness indicator */}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Session en cours
              </h2>
              {selectedSession?.status === 'active' && (
                <DataFreshnessIndicator lastServerTime={lastServerTime} />
              )}
            </div>

            {/* Session Section */}
            <SessionSection
              session={selectedSession}
              sessions={sessions}
              drivers={drivers}
              cars={cars}
              onStart={handleStartSession}
              onPause={handlePauseSession}
              onResume={handleResumeSession}
              onStop={handleStopSession}
              onTriggerCuStart={triggerCuStart}
              onConfig={handleSessionConfig}
            />

            {/* Finishing countdown */}
            {finishingSession && finishingSession.sessionId === selectedSessionId && (
              <div className="bg-orange-100 border border-orange-300 rounded-lg p-4 text-center">
                <div className="text-orange-800 font-bold text-lg animate-pulse">
                  DERNIER TOUR
                </div>
              </div>
            )}

            {/* Leaderboard */}
            {selectedSession && (
              <SessionLeaderboard
                entries={sessionEntries}
                sortBy={selectedSession.type === 'practice' ? practiceSortBy :
                  selectedSession.type === 'qualif' ? 'bestLap' : 'race'}
                onSortChange={selectedSession.type === 'practice' ? setPracticeSortBy : undefined}
                sessionType={selectedSession.type}
              />
            )}
          </div>

          {/* Right column: Standings */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Classement General
            </h2>
            <StandingsTabs
              standings={standings}
              drivers={drivers}
              activeTab={standingsTab}
              onTabChange={setStandingsTab}
            />
          </div>
        </div>
      </div>

      {/* Modals */}
      {configSession && (
        <SessionConfigModal
          session={configSession}
          drivers={drivers}
          cars={cars}
          sessionDrivers={configSession.drivers || []}
          open={!!configSession}
          onClose={() => setConfigSession(null)}
          onSave={handleSaveSessionConfig}
          onDelete={handleDeleteSession}
          onReset={handleResetSession}
        />
      )}

      {showChampionshipConfig && (
        <ChampionshipConfigModal
          championship={championship}
          sessions={sessions}
          tracks={tracks}
          open={showChampionshipConfig}
          onClose={() => setShowChampionshipConfig(false)}
          onSave={(updated) => setChampionship(updated)}
          onSessionsChange={handleSessionsChange}
        />
      )}
    </div>
  )
}
