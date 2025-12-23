import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'

// New unified components
import ChampionshipHeader from '../components/championship/ChampionshipHeader'
import SessionSection from '../components/championship/SessionSection'
import SessionConfigModal from '../components/championship/SessionConfigModal'
import StandingsTabs from '../components/championship/StandingsTabs'
import SessionLeaderboard from '../components/race/SessionLeaderboard'
import { DataFreshnessIndicator } from '../components/ui'

// Modals
import ChampionshipConfigModal from '../components/championship/ChampionshipConfigModal'

// Context and hooks
import { useRace } from '../context/RaceContext'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export default function ChampionshipDetail() {
    const { id } = useParams()

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

    // Standings data (fetched from API)
    const [standings, setStandings] = useState({
        practice: [],
        qualif: [],
        race: []
    })

    // Get WebSocket state and session actions from RaceContext
    const {
        freePracticeBoard,
        lastServerTime,
        finishingSession,
        cuStatus,
        triggerCuStart,
        setCurrentTrackId,
        setControllerConfigs,
        sessionLeaderboard,
        socketConnected,
        // Session actions
        startSessionById,
        pauseSessionById,
        resumeSessionById,
        stopSessionById
    } = useRace()

    // Local timer - only counts when CU is racing (cuStatus.start === 0)
    const [localElapsed, setLocalElapsed] = useState(0)
    const raceStartTimeRef = useRef(null)
    const savedElapsedRef = useRef(0)

    // Persist selected session
    useEffect(() => {
        if (selectedSessionId) {
            localStorage.setItem(`championship_${id}_session`, selectedSessionId)
        } else {
            localStorage.removeItem(`championship_${id}_session`)
        }
    }, [id, selectedSessionId])

    // Fetch championship data
    const fetchChampionship = useCallback(async () => {
        try {
            const res = await fetch(`${API_URL}/api/championships/${id}`)
            const data = await res.json()
            if (data.success) {
                setChampionship(data.data)
                // Set track for free practice
                if (data.data.trackId) {
                    setCurrentTrackId(data.data.trackId)
                }
            }
        } catch (err) {
            console.error('Error fetching championship:', err)
            setError(err.message)
        }
    }, [id, setCurrentTrackId])

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

    // Fetch drivers, cars and tracks
    const fetchDriversCarsAndTracks = useCallback(async () => {
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
            console.error('Error fetching drivers/cars/tracks:', err)
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

    // Initial data load
    useEffect(() => {
        const loadData = async () => {
            setLoading(true)
            await Promise.all([
                fetchChampionship(),
                fetchSessions(),
                fetchDriversCarsAndTracks(),
                fetchStandings()
            ])
            setLoading(false)
        }
        loadData()
    }, [fetchChampionship, fetchSessions, fetchDriversCarsAndTracks, fetchStandings])

    // Listen for standings_changed events
    useEffect(() => {
        const handleStandingsChanged = () => {
            fetchStandings()
        }
        window.addEventListener('standings_changed', handleStandingsChanged)
        return () => window.removeEventListener('standings_changed', handleStandingsChanged)
    }, [fetchStandings])

    // Listen for session status changes (finished, etc.)
    useEffect(() => {
        const handleSessionChange = () => {
            fetchSessions()
        }
        window.addEventListener('session_finished', handleSessionChange)
        window.addEventListener('session_status_changed', handleSessionChange)
        return () => {
            window.removeEventListener('session_finished', handleSessionChange)
            window.removeEventListener('session_status_changed', handleSessionChange)
        }
    }, [fetchSessions])

    // Selected session
    const selectedSession = useMemo(() => {
        return sessions.find(s => s.id === selectedSessionId) || null
    }, [sessions, selectedSessionId])

    // Timer management - only count when CU is racing (cuStatus.start === 0)
    const isRacing = selectedSession?.status === 'active' && cuStatus?.start === 0

    useEffect(() => {
        if (!isRacing) {
            // Save current elapsed time as base for next start
            if (raceStartTimeRef.current) {
                savedElapsedRef.current = localElapsed
                raceStartTimeRef.current = null
            }
            return
        }

        // Start timer when racing begins
        if (!raceStartTimeRef.current) {
            raceStartTimeRef.current = Date.now()
        }

        const interval = setInterval(() => {
            const now = Date.now()
            const raceElapsed = Math.floor((now - raceStartTimeRef.current) / 1000)
            setLocalElapsed(savedElapsedRef.current + raceElapsed)
        }, 1000)

        return () => clearInterval(interval)
    }, [isRacing, localElapsed])

    // Reset timer when session changes or finishes
    useEffect(() => {
        if (!selectedSession || selectedSession.status === 'finished' || selectedSession.status === 'draft' || selectedSession.status === 'ready') {
            setLocalElapsed(0)
            savedElapsedRef.current = 0
            raceStartTimeRef.current = null
        }
    }, [selectedSession?.id, selectedSession?.status])

    // Update controller configs when session changes
    useEffect(() => {
        if (selectedSession?.drivers) {
            const configs = selectedSession.drivers.map(sd => ({
                controller: sd.controller,
                driver: drivers.find(d => d.id === sd.driverId),
                car: cars.find(c => c.id === sd.carId)
            }))
            setControllerConfigs(configs)
        }
    }, [selectedSession, drivers, cars, setControllerConfigs])

    // Transform freePracticeBoard to SessionLeaderboard entries
    const practiceEntries = useMemo(() => {
        if (!selectedSession || selectedSession.type !== 'practice') return []
        if (!selectedSession.drivers) return []

        const allBestLaps = Object.values(freePracticeBoard)
            .map(d => d.bestLap)
            .filter(t => t && t > 0)
        const fastestLap = allBestLaps.length > 0 ? Math.min(...allBestLaps) : null

        return selectedSession.drivers.map(sd => {
            const data = freePracticeBoard[sd.controller] || {}
            const driver = drivers.find(d => d.id === sd.driverId)
            const car = cars.find(c => c.id === sd.carId)
            if (!driver) return null

            return {
                id: `practice-${sd.controller}`,
                controller: sd.controller,
                driver,
                car,
                stats: {
                    laps: data.lapCount || 0,
                    bestLap: data.bestLap || null,
                    lastLap: data.lastLap || null,
                    gap: null
                },
                hasFastestLap: fastestLap && data.bestLap === fastestLap
            }
        }).filter(Boolean)
    }, [selectedSession, freePracticeBoard, drivers, cars])

    // Transform session leaderboard data to SessionLeaderboard entries
    // Merge static session.drivers with real-time sessionLeaderboard
    const sessionEntries = useMemo(() => {
        if (!selectedSession || selectedSession.type === 'practice') return []
        if (!selectedSession.drivers) return []

        // Find the best lap time across all drivers for highlighting
        // Use real-time data if available, otherwise use persisted session data
        const allBestLaps = sessionLeaderboard.length > 0
            ? sessionLeaderboard.map(p => p.bestLapTime).filter(t => t && t > 0)
            : selectedSession.drivers.map(sd => sd.bestLapTime).filter(t => t && t > 0)
        const fastestLap = allBestLaps.length > 0 ? Math.min(...allBestLaps) : null

        const entries = selectedSession.drivers.map(sd => {
            const driver = drivers.find(d => d.id === sd.driverId)
            const car = cars.find(c => c.id === sd.carId)
            if (!driver) return null

            // Get real-time data from sessionLeaderboard (compare as strings)
            const realTimeData = sessionLeaderboard.find(p => String(p.controller) === String(sd.controller))

            return {
                id: sd.id,
                controller: sd.controller,
                driver,
                car,
                stats: {
                    laps: realTimeData?.lapCount || sd.totalLaps || 0,
                    bestLap: realTimeData?.bestLapTime || sd.bestLapTime || null,
                    lastLap: realTimeData?.lastLapTime || sd.lastLapTime || null,
                    totalTime: sd.totalTime || 0,
                    gap: realTimeData?.gap ?? null // Gap from backend
                },
                position: realTimeData?.position || sd.position || null,
                hasFastestLap: fastestLap && (realTimeData?.bestLapTime || sd.bestLapTime) === fastestLap,
                isDNF: sd.isDNF
            }
        }).filter(Boolean)

        // Sort by position from backend (already sorted and with gap calculated)
        entries.sort((a, b) => {
            const posA = a.position || 99
            const posB = b.position || 99
            return posA - posB
        })

        return entries
    }, [selectedSession, drivers, cars, sessionLeaderboard])

    // Get entries based on session type
    const leaderboardEntries = selectedSession?.type === 'practice' ? practiceEntries : sessionEntries

    // Calculate max laps completed
    const maxLapsCompleted = useMemo(() => {
        if (selectedSession?.type === 'practice') {
            return Math.max(0, ...Object.values(freePracticeBoard).map(d => d.lapCount || 0))
        }
        // Use real-time data if available, fallback to session data
        if (sessionLeaderboard.length > 0) {
            return Math.max(0, ...sessionLeaderboard.map(p => p.lapCount || 0))
        }
        return Math.max(0, ...(selectedSession?.drivers?.map(d => d.totalLaps || 0) || [0]))
    }, [selectedSession, freePracticeBoard, sessionLeaderboard])

    // Handle session selection
    const handleSelectSession = useCallback((session) => {
        setSelectedSessionId(session.id)
    }, [])


    // Handle session config
    const handleSessionConfig = useCallback((session) => {
        setConfigSession(session)
    }, [])

    // Handle championship config
    const handleChampionshipConfig = useCallback(() => {
        setShowChampionshipConfig(true)
    }, [])

    // Handle save championship config
    const handleSaveChampionshipConfig = useCallback((updatedChampionship) => {
        setChampionship(updatedChampionship)
    }, [])

    // Session control handlers using RaceContext
    const handleStartSession = useCallback(async () => {
        if (!selectedSession) return
        const result = await startSessionById(selectedSession.id)
        if (result.success) {
            fetchSessions()
        }
    }, [selectedSession, startSessionById, fetchSessions])

    const handlePauseSession = useCallback(async () => {
        if (!selectedSession) return
        const result = await pauseSessionById(selectedSession.id)
        if (result.success) {
            fetchSessions()
        }
    }, [selectedSession, pauseSessionById, fetchSessions])

    const handleResumeSession = useCallback(async () => {
        if (!selectedSession) return
        const result = await resumeSessionById(selectedSession.id)
        if (result.success) {
            fetchSessions()
        }
    }, [selectedSession, resumeSessionById, fetchSessions])

    const handleStopSession = useCallback(async () => {
        if (!selectedSession) return
        const result = await stopSessionById(selectedSession.id)
        if (result.success) {
            fetchSessions()
            fetchStandings()
        }
    }, [selectedSession, stopSessionById, fetchSessions, fetchStandings])

    // Handle save session config
    const handleSaveSessionConfig = useCallback(async (data) => {
        if (!configSession) return

        try {
            // Update session
            const res = await fetch(`${API_URL}/api/sessions/${configSession.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: data.name,
                    duration: data.duration,
                    maxLaps: data.maxLaps
                })
            })

            if (res.ok) {
                // Update status if changed
                if (data.status !== configSession.status) {
                    await fetch(`${API_URL}/api/sessions/${configSession.id}/status`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status: data.status })
                    })
                }

                // Update drivers
                if (data.drivers && data.drivers.length > 0) {
                    await fetch(`${API_URL}/api/sessions/${configSession.id}/drivers`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ drivers: data.drivers })
                    })
                }

                fetchSessions()
            }
        } catch (err) {
            console.error('Error saving session config:', err)
            throw err
        }
    }, [configSession, fetchSessions])

    // Handle delete session
    const handleDeleteSession = useCallback(async (sessionId) => {
        try {
            const res = await fetch(`${API_URL}/api/sessions/${sessionId}`, {
                method: 'DELETE'
            })
            if (res.ok) {
                fetchSessions()
                fetchStandings()
                if (selectedSessionId === sessionId) {
                    setSelectedSessionId(null)
                }
            }
        } catch (err) {
            console.error('Error deleting session:', err)
            throw err
        }
    }, [fetchSessions, fetchStandings, selectedSessionId])

    // Handle reset session
    const handleResetSession = useCallback(async (sessionId) => {
        try {
            const res = await fetch(`${API_URL}/api/sessions/${sessionId}/reset`, {
                method: 'POST'
            })
            if (res.ok) {
                fetchSessions()
                fetchStandings()
            }
        } catch (err) {
            console.error('Error resetting session:', err)
            throw err
        }
    }, [fetchSessions, fetchStandings])

    // Handle sessions change (from config modal)
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
                onConfig={handleChampionshipConfig}
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
                            elapsedTime={localElapsed}
                            maxLapsCompleted={maxLapsCompleted}
                            cuStatus={cuStatus}
                            socketConnected={socketConnected}
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
                                <div className="text-orange-600 text-sm">
                                    {finishingSession.remainingSeconds}s restantes
                                </div>
                            </div>
                        )}

                        {/* Leaderboard */}
                        {selectedSession && (
                            <SessionLeaderboard
                                entries={leaderboardEntries}
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
                    onSave={handleSaveChampionshipConfig}
                    onSessionsChange={handleSessionsChange}
                />
            )}
        </div>
    )
}
