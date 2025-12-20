import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { io } from 'socket.io-client'
import {
    ArrowLeftIcon,
    TrophyIcon,
    MapPinIcon,
    ChevronDownIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    PlusIcon,
    ClockIcon,
    FlagIcon,
    XMarkIcon,
    PlayIcon,
    TrashIcon,
    StopIcon
} from '@heroicons/react/24/outline'
import Leaderboard from '../components/race/Leaderboard'
import LapTime from '../components/race/LapTime'
import ControllerConfigSection from '../components/race/freePractice/ControllerConfigSection'
import FreePracticeLeaderboard from '../components/race/freePractice/FreePracticeLeaderboard'
import { useControllerConfig } from '../hooks/useControllerConfig'
import { useRace } from '../context/RaceContext'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3000'

export default function ChampionshipDetail() {
    const { id } = useParams()
    const navigate = useNavigate()

    // Race context for free practice
    const {
        setCurrentTrackId,
        setControllerConfigs,
        freePracticeBoard,
        resetFreePracticeBoard
    } = useRace()

    const [championship, setChampionship] = useState(null)
    const [drivers, setDrivers] = useState([])
    const [cars, setCars] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [trackRecords, setTrackRecords] = useState({ free: [], qualifying: [], race: [] })

    // Session selection
    const [selectedSessionId, setSelectedSessionId] = useState(null)
    const [sessionDropdownOpen, setSessionDropdownOpen] = useState(false)

    // Standings tabs and panel
    const [standingsTab, setStandingsTab] = useState('libre')
    const [standingsPanelOpen, setStandingsPanelOpen] = useState(true)

    // Modal states
    const [showQualifModal, setShowQualifModal] = useState(false)
    const [showRaceModal, setShowRaceModal] = useState(false)
    const [qualifForm, setQualifForm] = useState({ name: '', duration: 10, maxLaps: 0 })
    const [raceForm, setRaceForm] = useState({ name: '', duration: 0, maxLaps: 20 })
    const [saving, setSaving] = useState(false)

    // Config section
    const [configExpanded, setConfigExpanded] = useState(false)
    const [pendingSessionConfigs, setPendingSessionConfigs] = useState({})

    // Real-time session data
    const [sessionDriverData, setSessionDriverData] = useState({}) // controller -> { laps, bestLap, lastLap, position }
    const socketRef = useRef(null)
    const {
        configs,
        loading: configLoading,
        fetchConfigs,
        updateSlot,
        isComplete,
        unconfiguredSlots
    } = useControllerConfig()

    useEffect(() => {
        loadData()
    }, [id])

    // Fetch controller configs and set up race context when championship track is available
    useEffect(() => {
        if (championship?.trackId) {
            fetchConfigs(championship.trackId)
            setCurrentTrackId(championship.trackId)
            fetchTrackRecords(championship.trackId)
        }
    }, [championship?.trackId, fetchConfigs, setCurrentTrackId])

    // Sync controller configs with race context
    useEffect(() => {
        setControllerConfigs(configs)
    }, [configs, setControllerConfigs])

    // Refresh track records periodically
    useEffect(() => {
        if (championship?.trackId) {
            const interval = setInterval(() => {
                fetchTrackRecords(championship.trackId)
            }, 3000)
            return () => clearInterval(interval)
        }
    }, [championship?.trackId])

    // Socket connection for real-time session updates
    useEffect(() => {
        const socket = io(WS_URL, {
            transports: ['websocket', 'polling'],
            reconnection: true
        })
        socketRef.current = socket

        // Listen for lap completions
        socket.on('lap:completed', (lapData) => {
            const controller = String(lapData.controller)
            setSessionDriverData(prev => {
                const existing = prev[controller] || { laps: 0, bestLap: null, lastLap: null, position: 99 }
                return {
                    ...prev,
                    [controller]: {
                        ...existing,
                        laps: existing.laps + 1,
                        bestLap: existing.bestLap === null ? lapData.lapTime : Math.min(existing.bestLap, lapData.lapTime),
                        lastLap: lapData.lapTime,
                        lastUpdate: Date.now()
                    }
                }
            })
        })

        // Listen for position updates
        socket.on('positions:updated', (positions) => {
            setSessionDriverData(prev => {
                const updated = { ...prev }
                positions.forEach(p => {
                    const controller = String(p.controller)
                    updated[controller] = {
                        ...(updated[controller] || {}),
                        laps: p.lapCount || updated[controller]?.laps || 0,
                        lastLap: p.lastLapTime || updated[controller]?.lastLap,
                        position: p.position
                    }
                })
                return updated
            })
        })

        return () => {
            socket.disconnect()
        }
    }, [])

    // Reset session driver data when session changes
    useEffect(() => {
        setSessionDriverData({})
    }, [selectedSessionId])

    async function fetchTrackRecords(trackId) {
        try {
            const response = await fetch(`${API_URL}/api/records/track/${trackId}`)
            if (!response.ok) {
                setTrackRecords({ free: [], qualifying: [], race: [] })
                return
            }
            const data = await response.json()
            setTrackRecords({
                free: data.data?.free || [],
                qualifying: data.data?.qualifying || [],
                race: data.data?.race || []
            })
        } catch {
            setTrackRecords({ free: [], qualifying: [], race: [] })
        }
    }

    async function loadData() {
        try {
            const [champRes, driversRes, carsRes] = await Promise.all([
                fetch(`${API_URL}/api/championships/${id}`),
                fetch(`${API_URL}/api/drivers`),
                fetch(`${API_URL}/api/cars`)
            ])
            const [champData, driversData, carsData] = await Promise.all([
                champRes.json(),
                driversRes.json(),
                carsRes.json()
            ])

            if (!champData.success) {
                setError('Championnat introuvable')
                return
            }

            setChampionship(champData.data)
            setDrivers(driversData.data || [])
            setCars(carsData.data || [])
        } catch (err) {
            console.error('Failed to load championship:', err)
            setError('Erreur lors du chargement')
        } finally {
            setLoading(false)
        }
    }

    // Compute session label (Q1, Q2, R1, R2, etc.)
    const getSessionLabel = (session, sessions) => {
        const sameType = sessions.filter(s => s.type === session.type)
        const index = sameType.findIndex(s => s.id === session.id) + 1
        const prefix = session.type === 'qualifying' ? 'Q' : 'R'
        return `${prefix}${index}`
    }

    // Sessions sorted by creation date
    const sortedSessions = useMemo(() => {
        return [...(championship?.sessions || [])].sort(
            (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
        )
    }, [championship?.sessions])

    // Selected session object
    const selectedSession = useMemo(() => {
        if (!selectedSessionId) return null
        return sortedSessions.find(s => s.id === selectedSessionId)
    }, [selectedSessionId, sortedSessions])

    // Auto-switch standings tab based on selected session type
    useEffect(() => {
        if (!selectedSession) {
            setStandingsTab('libre')
        } else if (selectedSession.type === 'qualifying') {
            setStandingsTab('qualif')
        } else if (selectedSession.type === 'race') {
            setStandingsTab('course')
        }
    }, [selectedSession])

    // Compute configs to display: session-specific or default, with pending changes applied
    const displayConfigs = useMemo(() => {
        if (selectedSession) {
            // Convert SessionDriver to config format, include pending changes
            const sessionConfigs = Array.from({ length: 6 }, (_, i) => {
                const controller = String(i + 1)
                const sd = selectedSession.drivers?.find(d => d.controller === controller)
                const pending = pendingSessionConfigs[controller]

                // Use pending values if they exist, otherwise use session driver values
                const driverId = pending?.driverId !== undefined ? pending.driverId : (sd?.driverId || null)
                const carId = pending?.carId !== undefined ? pending.carId : (sd?.carId || null)

                // Find driver/car objects for display
                const driver = driverId ? drivers.find(d => d.id === driverId) : null
                const car = carId ? cars.find(c => c.id === carId) : null

                return {
                    controller,
                    driverId,
                    carId,
                    driver: driver || sd?.driver || null,
                    car: car || sd?.car || null,
                    isActive: true
                }
            })
            return sessionConfigs
        }
        return configs
    }, [selectedSession, pendingSessionConfigs, configs, drivers, cars])

    // Check if displaying session config
    const isSessionConfig = !!selectedSession

    // Compute isComplete and unconfiguredSlots for display configs
    const displayIsComplete = useMemo(() => {
        return displayConfigs.filter(c => c.isActive).every(c => c.driverId && c.carId)
    }, [displayConfigs])

    const displayUnconfiguredSlots = useMemo(() => {
        return displayConfigs
            .filter(c => c.isActive && (!c.driverId || !c.carId))
            .map(c => c.controller)
    }, [displayConfigs])

    // Build leaderboard from session data with real-time updates
    const sessionLeaderboard = useMemo(() => {
        if (!selectedSession) return []
        // Build leaderboard from session drivers, merging with real-time data
        const entries = (selectedSession.drivers || []).map((sd, idx) => {
            const controller = String(sd.controller)
            const realTime = sessionDriverData[controller] || {}
            return {
                id: sd.id,
                position: realTime.position || sd.finalPos || sd.gridPos || idx + 1,
                driver: sd.driver,
                car: sd.car,
                controller: sd.controller,
                laps: realTime.laps || 0,
                bestLap: realTime.bestLap || null,
                lastLap: realTime.lastLap || null,
                gap: null
            }
        })

        // Sort by position (from real-time data) or by laps/bestLap for qualifying
        if (selectedSession.type === 'qualifying') {
            entries.sort((a, b) => {
                // Sort by best lap time (ascending)
                if (a.bestLap === null && b.bestLap === null) return 0
                if (a.bestLap === null) return 1
                if (b.bestLap === null) return -1
                return a.bestLap - b.bestLap
            })
        } else {
            entries.sort((a, b) => {
                // Sort by laps (descending), then by best lap (ascending)
                if (b.laps !== a.laps) return b.laps - a.laps
                if (a.bestLap === null && b.bestLap === null) return 0
                if (a.bestLap === null) return 1
                if (b.bestLap === null) return -1
                return a.bestLap - b.bestLap
            })
        }

        // Calculate gaps
        const leader = entries[0]
        entries.forEach((entry, idx) => {
            entry.position = idx + 1
            if (idx === 0 || !leader.bestLap) {
                entry.gap = null
            } else if (selectedSession.type === 'qualifying' && entry.bestLap) {
                entry.gap = entry.bestLap - leader.bestLap
            } else if (entry.laps < leader.laps) {
                entry.gap = `+${leader.laps - entry.laps} tour${leader.laps - entry.laps > 1 ? 's' : ''}`
            }
        })

        return entries
    }, [selectedSession, sessionDriverData])

    // Standings sorted for Qualif tab (by best time)
    const qualifStandings = useMemo(() => {
        if (!championship?.standings) return []
        return [...championship.standings]
            .filter(s => s.qualifBestTime !== null && s.qualifBestTime > 0)
            .sort((a, b) => a.qualifBestTime - b.qualifBestTime)
    }, [championship?.standings])

    // Standings sorted for Race tab (by total laps, then total time)
    const raceStandings = useMemo(() => {
        if (!championship?.standings) return []
        return [...championship.standings]
            .filter(s => s.raceTotalLaps > 0 || s.points > 0)
            .sort((a, b) => {
                if (b.raceTotalLaps !== a.raceTotalLaps) return b.raceTotalLaps - a.raceTotalLaps
                return a.raceTotalTime - b.raceTotalTime
            })
    }, [championship?.standings])

    // Build drivers array from current configs
    const getSessionDrivers = useCallback(() => {
        return configs
            .filter(c => c.driverId && c.carId)
            .map((c, idx) => ({
                driverId: c.driverId,
                carId: c.carId,
                controller: c.controller,
                gridPos: idx + 1
            }))
    }, [configs])

    // Create new qualifying session
    async function handleCreateQualif(e) {
        e.preventDefault()
        setSaving(true)
        try {
            const qualifCount = sortedSessions.filter(s => s.type === 'qualifying').length
            const sessionDrivers = getSessionDrivers()
            const res = await fetch(`${API_URL}/api/sessions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: qualifForm.name || `Q${qualifCount + 1}`,
                    type: 'qualifying',
                    trackId: championship.trackId,
                    championshipId: championship.id,
                    duration: qualifForm.duration > 0 ? qualifForm.duration : null,
                    maxLaps: qualifForm.maxLaps > 0 ? qualifForm.maxLaps : null,
                    drivers: sessionDrivers
                })
            })
            if (res.ok) {
                setShowQualifModal(false)
                setQualifForm({ name: '', duration: 10, maxLaps: 0 })
                loadData()
            }
        } catch (err) {
            console.error('Failed to create qualifying:', err)
        } finally {
            setSaving(false)
        }
    }

    // Create new race session
    async function handleCreateRace(e) {
        e.preventDefault()
        setSaving(true)
        try {
            const raceCount = sortedSessions.filter(s => s.type === 'race').length
            const sessionDrivers = getSessionDrivers()
            const res = await fetch(`${API_URL}/api/sessions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: raceForm.name || `R${raceCount + 1}`,
                    type: 'race',
                    trackId: championship.trackId,
                    championshipId: championship.id,
                    duration: raceForm.duration > 0 ? raceForm.duration : null,
                    maxLaps: raceForm.maxLaps > 0 ? raceForm.maxLaps : null,
                    drivers: sessionDrivers
                })
            })
            if (res.ok) {
                setShowRaceModal(false)
                setRaceForm({ name: '', duration: 0, maxLaps: 20 })
                loadData()
            }
        } catch (err) {
            console.error('Failed to create race:', err)
        } finally {
            setSaving(false)
        }
    }

    // Get driver info from standings
    const getDriverInfo = (driverId) => {
        return drivers.find(d => d.id === driverId) || { name: 'Unknown', color: '#6B7280' }
    }

    // Handler for default config changes (free practice)
    const handleConfigChange = useCallback((controller, data) => {
        updateSlot(controller, data.driverId, data.carId)
    }, [updateSlot])

    // Delete session
    async function handleDeleteSession(sessionId) {
        if (!confirm('Supprimer cette session ?')) return

        try {
            const res = await fetch(`${API_URL}/api/sessions/${sessionId}`, {
                method: 'DELETE'
            })
            if (res.ok) {
                setSelectedSessionId(null)
                loadData()
            }
        } catch (err) {
            console.error('Failed to delete session:', err)
        }
    }

    // Start session
    async function handleStartSession(sessionId) {
        try {
            const res = await fetch(`${API_URL}/api/sessions/${sessionId}/start`, {
                method: 'POST'
            })
            if (res.ok) {
                loadData()
            }
        } catch (err) {
            console.error('Failed to start session:', err)
        }
    }

    // Stop session
    async function handleStopSession(sessionId) {
        try {
            const res = await fetch(`${API_URL}/api/sessions/${sessionId}/stop`, {
                method: 'POST'
            })
            if (res.ok) {
                loadData()
            }
        } catch (err) {
            console.error('Failed to stop session:', err)
        }
    }

    // Reset pending configs when session changes
    useEffect(() => {
        setPendingSessionConfigs({})
    }, [selectedSessionId])

    // Handler for session config changes
    const handleSessionConfigChange = useCallback(async (controller, data) => {
        if (!selectedSession) return

        const controllerStr = String(controller)

        // Update pending configs
        const updatedPending = {
            ...pendingSessionConfigs,
            [controllerStr]: { driverId: data.driverId, carId: data.carId }
        }
        setPendingSessionConfigs(updatedPending)

        // Build new drivers array from displayConfigs with pending changes applied
        const newConfigs = displayConfigs.map(c => {
            const pending = updatedPending[c.controller]
            if (pending) {
                return { ...c, driverId: pending.driverId, carId: pending.carId }
            }
            return c
        })

        // Only save if the changed controller has BOTH driver and car
        const changedConfig = newConfigs.find(c => c.controller === controllerStr)
        if (!changedConfig?.driverId || !changedConfig?.carId) {
            return // Don't save yet, wait for complete config
        }

        const driversPayload = newConfigs
            .filter(c => c.driverId && c.carId)
            .map(c => ({
                controller: c.controller,
                driverId: c.driverId,
                carId: c.carId
            }))

        try {
            const res = await fetch(`${API_URL}/api/sessions/${selectedSession.id}/drivers`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ drivers: driversPayload })
            })
            if (res.ok) {
                setPendingSessionConfigs({}) // Clear pending on successful save
                loadData() // Reload to get updated session
            }
        } catch (err) {
            console.error('Failed to update session drivers:', err)
        }
    }, [selectedSession, displayConfigs, pendingSessionConfigs, loadData])

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500"></div>
            </div>
        )
    }

    if (error || !championship) {
        return (
            <div className="p-8">
                <button
                    onClick={() => navigate('/championships')}
                    className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
                >
                    <ArrowLeftIcon className="w-5 h-5" />
                    Retour
                </button>
                <div className="text-center text-gray-500 py-16">{error || 'Championnat introuvable'}</div>
            </div>
        )
    }

    const qualifCount = sortedSessions.filter(s => s.type === 'qualifying').length
    const raceCount = sortedSessions.filter(s => s.type === 'race').length

    return (
        <div className="h-full flex flex-col overflow-hidden">
            {/* Header */}
            <header className="bg-white border-b px-6 py-4 flex-shrink-0">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/championships')}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
                        </button>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                                <TrophyIcon className="w-5 h-5 text-yellow-600" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-gray-900">{championship.name}</h1>
                                <div className="flex items-center gap-1 text-sm text-gray-500">
                                    <MapPinIcon className="w-4 h-4" />
                                    {championship.track?.name || 'Circuit non defini'}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Session selector */}
                        <div className="relative">
                            <button
                                onClick={() => setSessionDropdownOpen(!sessionDropdownOpen)}
                                className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors min-w-[140px]"
                            >
                                <span className="text-gray-700">
                                    {selectedSession
                                        ? getSessionLabel(selectedSession, sortedSessions)
                                        : 'Free Practice'}
                                </span>
                                <ChevronDownIcon className="w-4 h-4 text-gray-500" />
                            </button>
                            {sessionDropdownOpen && (
                                <>
                                    <div
                                        className="fixed inset-0 z-10"
                                        onClick={() => setSessionDropdownOpen(false)}
                                    />
                                    <div className="absolute right-0 mt-1 bg-white border rounded-lg shadow-lg z-20 min-w-[180px]">
                                        <button
                                            onClick={() => {
                                                setSelectedSessionId(null)
                                                setSessionDropdownOpen(false)
                                            }}
                                            className={`w-full text-left px-4 py-2 hover:bg-gray-100 ${!selectedSessionId ? 'bg-yellow-50 text-yellow-700' : ''}`}
                                        >
                                            Free Practice
                                        </button>
                                        {sortedSessions.length > 0 && (
                                            <div className="border-t">
                                                {sortedSessions.map(session => (
                                                    <button
                                                        key={session.id}
                                                        onClick={() => {
                                                            setSelectedSessionId(session.id)
                                                            setSessionDropdownOpen(false)
                                                        }}
                                                        className={`w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 ${selectedSessionId === session.id ? 'bg-yellow-50 text-yellow-700' : ''}`}
                                                    >
                                                        {session.type === 'qualifying' ? (
                                                            <ClockIcon className="w-4 h-4 text-blue-500" />
                                                        ) : (
                                                            <FlagIcon className="w-4 h-4 text-green-500" />
                                                        )}
                                                        <span>{getSessionLabel(session, sortedSessions)}</span>
                                                        <span className="text-xs text-gray-400 ml-auto">
                                                            {session.status === 'finished' ? 'Termine' : session.status}
                                                        </span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Add session buttons */}
                        <button
                            onClick={() => setShowQualifModal(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                        >
                            <PlusIcon className="w-4 h-4" />
                            Qualif
                        </button>
                        <button
                            onClick={() => setShowRaceModal(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                        >
                            <PlusIcon className="w-4 h-4" />
                            Course
                        </button>
                    </div>
                </div>

                {/* Session counts */}
                <div className="flex items-center gap-4 mt-3 text-sm">
                    <div className="flex items-center gap-1.5">
                        <ClockIcon className="w-4 h-4 text-blue-500" />
                        <span className="text-gray-600">{qualifCount} qualif{qualifCount > 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <FlagIcon className="w-4 h-4 text-green-500" />
                        <span className="text-gray-600">{raceCount} course{raceCount > 1 ? 's' : ''}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        championship.status === 'active' ? 'bg-green-100 text-green-700' :
                        championship.status === 'finished' ? 'bg-gray-100 text-gray-700' :
                        'bg-yellow-100 text-yellow-700'
                    }`}>
                        {championship.status === 'active' ? 'En cours' :
                         championship.status === 'finished' ? 'Termine' : 'Planifie'}
                    </span>
                </div>
            </header>

            {/* Controller Configuration */}
            <ControllerConfigSection
                expanded={configExpanded}
                onToggle={() => setConfigExpanded(!configExpanded)}
                configs={displayConfigs}
                drivers={drivers}
                cars={cars}
                onConfigChange={isSessionConfig ? handleSessionConfigChange : handleConfigChange}
                configLoading={configLoading}
                isComplete={displayIsComplete}
                unconfiguredSlots={displayUnconfiguredSlots}
            />

            {/* Main content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left: Session Leaderboard or Free Practice */}
                {selectedSession ? (
                    <main className="flex-1 overflow-auto p-6 bg-gray-50">
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-semibold text-gray-900">
                                    {getSessionLabel(selectedSession, sortedSessions)} - {selectedSession.name || 'Session'}
                                </h2>
                                <div className="flex items-center gap-2">
                                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                                        selectedSession.status === 'finished' ? 'bg-blue-100 text-blue-700' :
                                        selectedSession.status === 'active' ? 'bg-green-100 text-green-700' :
                                        'bg-gray-100 text-gray-700'
                                    }`}>
                                        {selectedSession.status === 'finished' ? 'Terminé' :
                                         selectedSession.status === 'active' ? 'En cours' : selectedSession.status}
                                    </span>
                                    {selectedSession.status !== 'finished' && (
                                        selectedSession.status === 'active' ? (
                                            <button
                                                onClick={() => handleStopSession(selectedSession.id)}
                                                className="px-3 py-1.5 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 transition-colors"
                                            >
                                                Arrêter
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => handleStartSession(selectedSession.id)}
                                                className="px-3 py-1.5 bg-green-500 text-white text-sm font-medium rounded-lg hover:bg-green-600 transition-colors flex items-center gap-1"
                                            >
                                                <PlayIcon className="w-4 h-4" />
                                                Démarrer
                                            </button>
                                        )
                                    )}
                                    <button
                                        onClick={() => handleDeleteSession(selectedSession.id)}
                                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                        title="Supprimer la session"
                                    >
                                        <TrashIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            {sessionLeaderboard.length > 0 ? (
                                <Leaderboard
                                    leaderboard={sessionLeaderboard}
                                    sessionType={selectedSession.type}
                                />
                            ) : (
                                <div className="bg-white rounded-lg p-8 text-center text-gray-500">
                                    <FlagIcon className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                                    Aucun pilote inscrit
                                </div>
                            )}
                        </div>
                    </main>
                ) : (
                    <FreePracticeLeaderboard
                        freePracticeBoard={freePracticeBoard}
                        configs={configs}
                        onReset={resetFreePracticeBoard}
                    />
                )}

                {/* Toggle button for standings panel */}
                <button
                    onClick={() => setStandingsPanelOpen(!standingsPanelOpen)}
                    className="flex-shrink-0 w-6 bg-gray-100 hover:bg-gray-200 border-l border-r flex items-center justify-center transition-colors"
                    title={standingsPanelOpen ? 'Fermer le classement' : 'Ouvrir le classement'}
                >
                    {standingsPanelOpen ? (
                        <ChevronRightIcon className="w-4 h-4 text-gray-500" />
                    ) : (
                        <ChevronLeftIcon className="w-4 h-4 text-gray-500" />
                    )}
                </button>

                {/* Right: Standings Panel (collapsible) */}
                <aside className={`${standingsPanelOpen ? 'w-80' : 'w-0'} bg-white overflow-hidden flex flex-col flex-shrink-0 transition-all duration-300`}>

                    {standingsPanelOpen && (
                        <>
                            <div className="p-4 border-b">
                                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                                    <TrophyIcon className="w-5 h-5 text-yellow-500" />
                                    Classement
                                </h3>
                            </div>

                            {/* Tabs */}
                            <div className="flex border-b">
                                <button
                                    onClick={() => setStandingsTab('libre')}
                                    className={`flex-1 px-2 py-3 text-xs font-medium transition-colors ${
                                        standingsTab === 'libre'
                                            ? 'text-purple-600 border-b-2 border-purple-600'
                                            : 'text-gray-600 hover:text-gray-900'
                                    }`}
                                >
                                    <PlayIcon className="w-4 h-4 inline mr-0.5" />
                                    Libre
                                </button>
                                <button
                                    onClick={() => setStandingsTab('qualif')}
                                    className={`flex-1 px-2 py-3 text-xs font-medium transition-colors ${
                                        standingsTab === 'qualif'
                                            ? 'text-blue-600 border-b-2 border-blue-600'
                                            : 'text-gray-600 hover:text-gray-900'
                                    }`}
                                >
                                    <ClockIcon className="w-4 h-4 inline mr-0.5" />
                                    Qualif
                                </button>
                                <button
                                    onClick={() => setStandingsTab('course')}
                                    className={`flex-1 px-2 py-3 text-xs font-medium transition-colors ${
                                        standingsTab === 'course'
                                            ? 'text-green-600 border-b-2 border-green-600'
                                            : 'text-gray-600 hover:text-gray-900'
                                    }`}
                                >
                                    <FlagIcon className="w-4 h-4 inline mr-0.5" />
                                    Course
                                </button>
                            </div>

                            {/* Standings list */}
                            <div className="flex-1 overflow-auto p-3">
                                {standingsTab === 'libre' ? (
                                    trackRecords.free.length > 0 ? (
                                        <div className="space-y-2">
                                            {trackRecords.free.map((record, idx) => (
                                                <div
                                                    key={record.id}
                                                    className={`flex items-center gap-2 p-2 rounded-lg ${
                                                        idx === 0 ? 'bg-yellow-50 border border-yellow-200' :
                                                        idx === 1 ? 'bg-gray-50 border border-gray-200' :
                                                        idx === 2 ? 'bg-orange-50 border border-orange-200' :
                                                        'bg-gray-50'
                                                    }`}
                                                >
                                                    <span className={`w-5 text-center font-bold text-sm ${
                                                        idx === 0 ? 'text-yellow-600' :
                                                        idx === 1 ? 'text-gray-500' :
                                                        idx === 2 ? 'text-orange-600' :
                                                        'text-gray-700'
                                                    }`}>
                                                        {idx + 1}
                                                    </span>
                                                    <div
                                                        className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                                                        style={{ backgroundColor: record.driver?.color || '#6B7280' }}
                                                    >
                                                        {record.driver?.photo ? (
                                                            <img src={record.driver.photo} alt="" className="w-full h-full rounded-full object-cover" />
                                                        ) : (
                                                            record.driver?.name?.charAt(0) || '?'
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-medium text-gray-900 text-sm truncate">{record.driver?.name}</div>
                                                        <div className="text-xs text-gray-500 truncate">
                                                            {record.car?.brand} {record.car?.model}
                                                        </div>
                                                    </div>
                                                    <LapTime time={record.lapTime} size="sm" />
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center text-gray-500 py-8 text-sm">
                                            Aucun record
                                        </div>
                                    )
                                ) : standingsTab === 'qualif' ? (
                                    qualifStandings.length > 0 ? (
                                        <div className="space-y-2">
                                            {qualifStandings.map((standing, idx) => {
                                                const driver = getDriverInfo(standing.driverId)
                                                return (
                                                    <div
                                                        key={standing.id}
                                                        className={`flex items-center gap-2 p-2 rounded-lg ${
                                                            idx === 0 ? 'bg-yellow-50 border border-yellow-200' :
                                                            idx === 1 ? 'bg-gray-50 border border-gray-200' :
                                                            idx === 2 ? 'bg-orange-50 border border-orange-200' :
                                                            'bg-gray-50'
                                                        }`}
                                                    >
                                                        <span className={`w-5 text-center font-bold text-sm ${
                                                            idx === 0 ? 'text-yellow-600' :
                                                            idx === 1 ? 'text-gray-500' :
                                                            idx === 2 ? 'text-orange-600' :
                                                            'text-gray-700'
                                                        }`}>
                                                            {idx + 1}
                                                        </span>
                                                        <div
                                                            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                                                            style={{ backgroundColor: driver.color || '#6B7280' }}
                                                        >
                                                            {driver.photo ? (
                                                                <img src={driver.photo} alt="" className="w-full h-full rounded-full object-cover" />
                                                            ) : (
                                                                driver.name?.charAt(0) || '?'
                                                            )}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="font-medium text-gray-900 text-sm truncate">{driver.name}</div>
                                                        </div>
                                                        <LapTime time={standing.qualifBestTime} size="sm" />
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    ) : (
                                        <div className="text-center text-gray-500 py-8 text-sm">
                                            Aucun temps
                                        </div>
                                    )
                                ) : (
                                    raceStandings.length > 0 ? (
                                        <div className="space-y-2">
                                            {raceStandings.map((standing, idx) => {
                                                const driver = getDriverInfo(standing.driverId)
                                                return (
                                                    <div
                                                        key={standing.id}
                                                        className={`flex items-center gap-2 p-2 rounded-lg ${
                                                            idx === 0 ? 'bg-yellow-50 border border-yellow-200' :
                                                            idx === 1 ? 'bg-gray-50 border border-gray-200' :
                                                            idx === 2 ? 'bg-orange-50 border border-orange-200' :
                                                            'bg-gray-50'
                                                        }`}
                                                    >
                                                        <span className={`w-5 text-center font-bold text-sm ${
                                                            idx === 0 ? 'text-yellow-600' :
                                                            idx === 1 ? 'text-gray-500' :
                                                            idx === 2 ? 'text-orange-600' :
                                                            'text-gray-700'
                                                        }`}>
                                                            {idx + 1}
                                                        </span>
                                                        <div
                                                            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                                                            style={{ backgroundColor: driver.color || '#6B7280' }}
                                                        >
                                                            {driver.photo ? (
                                                                <img src={driver.photo} alt="" className="w-full h-full rounded-full object-cover" />
                                                            ) : (
                                                                driver.name?.charAt(0) || '?'
                                                            )}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="font-medium text-gray-900 text-sm truncate">{driver.name}</div>
                                                            <div className="text-xs text-gray-500">
                                                                {standing.raceTotalLaps} tours
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="font-bold text-gray-900 text-sm">{standing.points} pts</div>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    ) : (
                                        <div className="text-center text-gray-500 py-8 text-sm">
                                            Aucun résultat
                                        </div>
                                    )
                                )}
                            </div>
                        </>
                    )}
                </aside>
            </div>

            {/* Qualifying Modal */}
            {showQualifModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-gray-800">Nouvelle qualification</h2>
                            <button onClick={() => setShowQualifModal(false)} className="p-1 hover:bg-gray-100 rounded">
                                <XMarkIcon className="w-6 h-6 text-gray-500" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateQualif} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Nom (optionnel)
                                </label>
                                <input
                                    type="text"
                                    value={qualifForm.name}
                                    onChange={(e) => setQualifForm(f => ({ ...f, name: e.target.value }))}
                                    placeholder={`Q${qualifCount + 1}`}
                                    className="w-full px-4 py-2 border rounded-lg"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Duree (min)
                                    </label>
                                    <input
                                        type="number"
                                        value={qualifForm.duration}
                                        onChange={(e) => setQualifForm(f => ({ ...f, duration: parseInt(e.target.value) || 0 }))}
                                        min="0"
                                        className="w-full px-4 py-2 border rounded-lg"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Max tours
                                    </label>
                                    <input
                                        type="number"
                                        value={qualifForm.maxLaps}
                                        onChange={(e) => setQualifForm(f => ({ ...f, maxLaps: parseInt(e.target.value) || 0 }))}
                                        min="0"
                                        className="w-full px-4 py-2 border rounded-lg"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowQualifModal(false)}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                                >
                                    Annuler
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-6 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50"
                                >
                                    {saving ? 'Creation...' : 'Creer'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Race Modal */}
            {showRaceModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-gray-800">Nouvelle course</h2>
                            <button onClick={() => setShowRaceModal(false)} className="p-1 hover:bg-gray-100 rounded">
                                <XMarkIcon className="w-6 h-6 text-gray-500" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateRace} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Nom (optionnel)
                                </label>
                                <input
                                    type="text"
                                    value={raceForm.name}
                                    onChange={(e) => setRaceForm(f => ({ ...f, name: e.target.value }))}
                                    placeholder={`R${raceCount + 1}`}
                                    className="w-full px-4 py-2 border rounded-lg"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Duree (min)
                                    </label>
                                    <input
                                        type="number"
                                        value={raceForm.duration}
                                        onChange={(e) => setRaceForm(f => ({ ...f, duration: parseInt(e.target.value) || 0 }))}
                                        min="0"
                                        className="w-full px-4 py-2 border rounded-lg"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Max tours
                                    </label>
                                    <input
                                        type="number"
                                        value={raceForm.maxLaps}
                                        onChange={(e) => setRaceForm(f => ({ ...f, maxLaps: parseInt(e.target.value) || 0 }))}
                                        min="0"
                                        className="w-full px-4 py-2 border rounded-lg"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowRaceModal(false)}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                                >
                                    Annuler
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-6 py-2 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 disabled:opacity-50"
                                >
                                    {saving ? 'Creation...' : 'Creer'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
