import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { Flag } from 'lucide-react'
import ChampionshipHeader from '../components/championship/ChampionshipHeader'
import ChampionshipBracket from '../components/championship/ChampionshipBracket'
import ChampionshipResults from '../components/championship/ChampionshipResults'
import SessionSection from '../components/championship/SessionSection'
import StandingsTabs from '../components/championship/StandingsTabs'
import SessionLeaderboard from '../components/race/SessionLeaderboard'
import StartingGrid from '../components/race/StartingGrid'
import { DataFreshnessIndicator } from '../components/ui'
import ChampionshipConfigModal from '../components/championship/ChampionshipConfigModal'
import { useDevice } from '../context/DeviceContext'
import { useSession } from '../context/SessionContext'
import { useApp } from '../context/AppContext'

const API_URL = import.meta.env.VITE_API_URL || ''

export default function ChampionshipDetail() {
  const { id } = useParams()
  const { startRace: triggerCuStart } = useDevice()
  const {
    entries: sessionEntries,
    maxLapsCompleted,
    lastServerTime,
    loadSession,
    startSession,
    pauseSession,
    resumeSession,
    stopSession,
    resetSession,
  } = useSession()

  const [championship, setChampionship] = useState(null)
  const [sessions, setSessions] = useState([])
  const [drivers, setDrivers] = useState([])
  const [cars, setCars] = useState([])
  const [tracks, setTracks] = useState([])
  const [loading, setLoading] = useState(true)

  const [selectedSessionId, setSelectedSessionId] = useState(() => localStorage.getItem(`championship_${id}_session`) || null)
  const [standingsTab, setStandingsTab] = useState('practice')
  const [practiceSortBy, setPracticeSortBy] = useState('laps')
  const [showChampionshipConfig, setShowChampionshipConfig] = useState(false)
  const [showBracket, setShowBracket] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [standings, setStandings] = useState({ practice: [], qualif: [], race: [] })
  const [viewedLeaderboard, setViewedLeaderboard] = useState(null) // leaderboard for non-active sessions

  useEffect(() => {
    if (selectedSessionId) localStorage.setItem(`championship_${id}_session`, selectedSessionId)
    else localStorage.removeItem(`championship_${id}_session`)
  }, [id, selectedSessionId])

  const { showStandings, toggleStandings } = useApp()

  const fetchChampionship = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/championships/${id}`)
      const data = await res.json()
      if (data.success) setChampionship(data.data)
    } catch (err) { console.error('Error:', err) }
  }, [id])

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/sessions?championshipId=${id}`)
      const data = await res.json()
      if (data.success) {
        setSessions(data.data)
        if (!selectedSessionId && data.data.length > 0) setSelectedSessionId(data.data[0].id)
      }
    } catch (err) { console.error('Error:', err) }
  }, [id, selectedSessionId])

  const fetchData = useCallback(async () => {
    try {
      const [d, c, t] = await Promise.all([
        fetch(`${API_URL}/api/drivers`).then(r => r.json()),
        fetch(`${API_URL}/api/cars`).then(r => r.json()),
        fetch(`${API_URL}/api/tracks`).then(r => r.json()),
      ])
      if (d.success) setDrivers(d.data)
      if (c.success) setCars(c.data)
      if (t.success) setTracks(t.data)
    } catch (err) { console.error('Error:', err) }
  }, [])

  const fetchStandings = useCallback(async () => {
    try {
      const [p, q, r] = await Promise.all([
        fetch(`${API_URL}/api/championships/${id}/standings?type=practice`).then(r => r.json()),
        fetch(`${API_URL}/api/championships/${id}/standings?type=qualif`).then(r => r.json()),
        fetch(`${API_URL}/api/championships/${id}/standings?type=race`).then(r => r.json()),
      ])
      setStandings({ practice: p.standings || [], qualif: q.standings || [], race: r.standings || [] })
    } catch (err) { console.error('Error:', err) }
  }, [id])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      await Promise.all([fetchChampionship(), fetchSessions(), fetchData(), fetchStandings()])
      setLoading(false)
    }
    load()
  }, [id])

  useEffect(() => {
    if (!selectedSessionId || sessions.length === 0) return
    const session = sessions.find(s => s.id === selectedSessionId)
    if (!session) { setSelectedSessionId(sessions[0]?.id || null); return }

    const isLive = ['active', 'paused', 'finishing'].includes(session.status)
    if (isLive) {
      // Active session: load into context for live updates
      loadSession(selectedSessionId)
      setViewedLeaderboard(null)
    } else {
      // Draft/finished: fetch leaderboard statically, don't touch live context
      fetch(`${API_URL}/api/sessions/${selectedSessionId}/leaderboard`)
        .then(r => r.json())
        .then(d => setViewedLeaderboard(d.success ? d.data : []))
        .catch(() => setViewedLeaderboard([]))
    }
  }, [selectedSessionId, sessions, loadSession])

  const fetchSessionsRef = useRef(fetchSessions)
  const fetchStandingsRef = useRef(fetchStandings)
  fetchSessionsRef.current = fetchSessions
  fetchStandingsRef.current = fetchStandings

  useEffect(() => {
    const refresh = () => { fetchSessionsRef.current(); fetchStandingsRef.current() }
    window.addEventListener('session:finished', refresh)
    window.addEventListener('session:status_changed', refresh)
    window.addEventListener('championship:races_assigned', refresh)
    return () => {
      window.removeEventListener('session:finished', refresh)
      window.removeEventListener('session:status_changed', refresh)
      window.removeEventListener('championship:races_assigned', refresh)
    }
  }, [])

  // For auto championships, only show participant drivers in session config
  const sessionDrivers = useMemo(() => {
    if (championship?.mode !== 'auto' || !championship.participants?.length) return drivers
    const participantIds = new Set(championship.participants.map(p => p.driverId))
    return drivers.filter(d => participantIds.has(d.id))
  }, [drivers, championship])

  const selectedSession = useMemo(() => sessions.find(s => s.id === selectedSessionId) || null, [sessions, selectedSessionId])

  // Use live entries for active sessions, static leaderboard for others
  const isLiveSession = ['active', 'paused', 'finishing'].includes(selectedSession?.status)

  // Transform raw leaderboard data to the same format as SessionContext entries
  const viewedEntries = useMemo(() => {
    if (!viewedLeaderboard?.length) return []
    const allBestLaps = viewedLeaderboard.map(p => p.bestLapTime).filter(t => t && t > 0)
    const fastestLapTime = allBestLaps.length > 0 ? Math.min(...allBestLaps) : null
    return viewedLeaderboard.map(p => ({
      id: p.id,
      controller: p.controller,
      driver: p.driver,
      car: p.car,
      gridPos: p.gridPos ?? null,
      stats: {
        laps: p.totalLaps || 0,
        bestLap: p.bestLapTime || null,
        lastLap: p.lastLapTime || null,
        totalTime: p.totalTime || 0,
        gap: p.gap ?? null,
      },
      position: p.position || 0,
      positionDelta: 0,
      hasFastestLap: fastestLapTime && p.bestLapTime === fastestLapTime,
      isDNF: p.isDNF || false,
      laps: p.laps || [],
    })).sort((a, b) => (a.position || 99) - (b.position || 99))
  }, [viewedLeaderboard])

  const displayEntries = isLiveSession ? sessionEntries : viewedEntries
  const displayMaxLaps = isLiveSession ? maxLapsCompleted : Math.max(0, ...viewedEntries.map(e => e.stats.laps))

  useEffect(() => {
    if (selectedSession?.type) setStandingsTab(selectedSession.type)
  }, [selectedSession?.type])

  const handleStartSession = useCallback(async () => {
    if (!selectedSession) return
    const r = await startSession(selectedSession.id)
    if (r.success) fetchSessions()
  }, [selectedSession, startSession, fetchSessions])

  const handlePauseSession = useCallback(async () => {
    if (!selectedSession) return
    const r = await pauseSession(selectedSession.id)
    if (r.success) fetchSessions()
  }, [selectedSession, pauseSession, fetchSessions])

  const handleResumeSession = useCallback(async () => {
    if (!selectedSession) return
    const r = await resumeSession(selectedSession.id)
    if (r.success) fetchSessions()
  }, [selectedSession, resumeSession, fetchSessions])

  const handleStopSession = useCallback(async () => {
    if (!selectedSession) return
    const r = await stopSession(selectedSession.id)
    if (r.success) { fetchSessions(); fetchStandings() }
  }, [selectedSession, stopSession, fetchSessions, fetchStandings])

  const handleSaveConfig = useCallback(async (data) => {
    if (!selectedSession) return
    try {
      if (data.name !== undefined || data.maxDuration !== undefined || data.maxLaps !== undefined || data.gracePeriod !== undefined) {
        await fetch(`${API_URL}/api/sessions/${selectedSession.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: data.name, maxDuration: data.maxDuration, maxLaps: data.maxLaps, gracePeriod: data.gracePeriod })
        })
      }
      if (data.status !== undefined && data.status !== selectedSession.status) {
        await fetch(`${API_URL}/api/sessions/${selectedSession.id}/status`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: data.status })
        })
      }
      if (data.drivers?.length > 0) {
        await fetch(`${API_URL}/api/sessions/${selectedSession.id}/drivers`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ drivers: data.drivers })
        })
      }
      fetchSessions()
      await loadSession(selectedSession.id)
    } catch (err) { console.error('Error:', err) }
  }, [selectedSession, fetchSessions, loadSession])

  const handleDeleteSession = useCallback(async (sessionId) => {
    try {
      await fetch(`${API_URL}/api/sessions/${sessionId}`, { method: 'DELETE' })
      fetchSessions(); fetchStandings()
      if (selectedSessionId === sessionId) setSelectedSessionId(null)
    } catch (err) { console.error('Error:', err) }
  }, [fetchSessions, fetchStandings, selectedSessionId])

  const handleResetSession = useCallback(async (sessionId) => {
    const r = await resetSession(sessionId)
    if (r.success) { fetchSessions(); fetchStandings() }
  }, [resetSession, fetchSessions, fetchStandings])

  const handleFinishChampionship = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/championships/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'finished' })
      })
      if (res.ok) {
        const data = await res.json()
        setChampionship(data.data)
      }
    } catch (err) { console.error('Error finishing championship:', err) }
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full size-10 border-b-2 border-yellow-500" />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header bar with session tabs */}
      <ChampionshipHeader
        championship={championship}
        sessions={sessions}
        selectedSession={selectedSession}
        onSelectSession={(s) => { setSelectedSessionId(s.id); setShowResults(false) }}
        onConfig={() => setShowChampionshipConfig(true)}
        showConfig={showChampionshipConfig}
        onFinish={handleFinishChampionship}
        showStandings={showStandings}
        onToggleStandings={toggleStandings}
        showBracket={showBracket}
        onToggleBracket={() => setShowBracket(v => !v)}
        showResults={showResults}
        onSelectResults={() => { setShowResults(true); setShowBracket(false) }}
      />

      {/* Main content */}
      <div className="flex-1 overflow-auto p-4">
        {/* Bracket view for auto championships */}
        {showBracket && championship?.mode === 'auto' && (
          <div className="mb-4 bg-card border border-border rounded-xl p-4">
            <ChampionshipBracket
              championshipId={id}
              onSessionSelect={(sessionId) => { setSelectedSessionId(sessionId); setShowBracket(false) }}
            />
          </div>
        )}

        {/* Results view */}
        {showResults ? (
          <ChampionshipResults championshipId={id} />
        ) : (
        <div className={`grid grid-cols-1 ${showStandings ? 'lg:grid-cols-3' : ''} gap-4`}>
          {/* Left: Session + Leaderboard */}
          <div className={`${showStandings ? 'lg:col-span-2' : ''} space-y-4`}>
            <SessionSection
              session={selectedSession}
              sessions={sessions}
              drivers={sessionDrivers}
              cars={cars}
              autoMode={championship?.mode === 'auto'}
              onStart={handleStartSession}
              onPause={handlePauseSession}
              onResume={handleResumeSession}
              onStop={handleStopSession}
              onTriggerCuStart={triggerCuStart}
              onSaveConfig={handleSaveConfig}
              onDelete={handleDeleteSession}
              onReset={handleResetSession}
            />

            {selectedSession && (
              displayMaxLaps === 0 && selectedSession.status !== 'finished' ? (
                <StartingGrid entries={displayEntries} />
              ) : (
                <SessionLeaderboard
                  entries={displayEntries}
                  expanded={!showStandings}
                  sortBy={selectedSession.type === 'practice' ? practiceSortBy : selectedSession.type === 'qualif' ? 'bestLap' : 'race'}
                  onSortChange={selectedSession.type === 'practice' ? setPracticeSortBy : undefined}
                  sessionType={selectedSession.type}
                  sessionStatus={selectedSession.status}
                />
              )
            )}
          </div>

          {/* Right: Standings */}
          {showStandings && (
            <div>
              <h2 className="text-sm font-semibold mb-3">Classement Général</h2>
              <StandingsTabs
                standings={standings}
                drivers={drivers}
                activeTab={standingsTab}
                onTabChange={setStandingsTab}
              />
            </div>
          )}
        </div>
        )}
      </div>

      {showChampionshipConfig && (
        <ChampionshipConfigModal
          championship={championship}
          sessions={sessions}
          tracks={tracks}
          drivers={drivers}
          open={showChampionshipConfig}
          onClose={() => setShowChampionshipConfig(false)}
          onSave={(updated) => setChampionship(updated)}
          onFinish={handleFinishChampionship}
          onSessionsChange={() => { fetchChampionship(); fetchSessions(); fetchStandings() }}
        />
      )}
    </div>
  )
}
