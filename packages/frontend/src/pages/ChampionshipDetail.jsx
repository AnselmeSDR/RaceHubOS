import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { io } from 'socket.io-client'
import {
    ArrowLeftIcon,
    ArrowPathIcon,
    ArrowUturnLeftIcon,
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
    StopIcon,
    BoltIcon,
    SignalIcon,
    SignalSlashIcon,
    PencilIcon,
    BeakerIcon
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

    // Session selection - restore from localStorage
    const [selectedSessionId, setSelectedSessionId] = useState(() => {
        const saved = localStorage.getItem(`championship_${id}_session`)
        return saved || null
    })
    const [sessionDropdownOpen, setSessionDropdownOpen] = useState(false)

    // Persist selected session to localStorage
    useEffect(() => {
        if (selectedSessionId) {
            localStorage.setItem(`championship_${id}_session`, selectedSessionId)
        } else {
            localStorage.removeItem(`championship_${id}_session`)
        }
    }, [id, selectedSessionId])

    // Standings tabs and panel
    const [standingsTab, setStandingsTab] = useState('libre')
    const [standingsPanelOpen, setStandingsPanelOpen] = useState(true)

    // Modal states
    const [showQualifModal, setShowQualifModal] = useState(false)
    const [showRaceModal, setShowRaceModal] = useState(false)
    const [editingSession, setEditingSession] = useState(null) // Session being edited
    const [qualifForm, setQualifForm] = useState({ name: '', duration: 10, maxLaps: 0 })
    const [raceForm, setRaceForm] = useState({ name: '', duration: 0, maxLaps: 20 })
    const [saving, setSaving] = useState(false)

    // Config section
    const [configExpanded, setConfigExpanded] = useState(false)
    const [pendingSessionConfigs, setPendingSessionConfigs] = useState({})

    // Real-time session data
    const [sessionDriverData, setSessionDriverData] = useState({}) // controller -> { laps, bestLap, lastLap, position }
    const [elapsedTime, setElapsedTime] = useState(0) // in seconds
    const socketRef = useRef(null)
    const raceStartTimeRef = useRef(null)
    const baseElapsedRef = useRef(0)

    // CU status
    const [cuConnected, setCuConnected] = useState(false)
    const [cuStatus, setCuStatus] = useState(null)
    const {
        configs,
        loading: configLoading,
        fetchConfigs,
        updateSlot
    } = useControllerConfig()

    const loadData = useCallback(async () => {
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
    }, [id])

    useEffect(() => {
        loadData()
    }, [loadData])

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
            const lapTime = lapData.lapTime
            if (!controller || lapTime === undefined || lapTime <= 0) {
                return
            }
            setSessionDriverData(prev => {
                const existing = prev[controller] || { laps: 0, bestLap: null, lastLap: null, position: 99 }
                // Check for null, undefined, NaN, or 0
                const hasBestLap = existing.bestLap != null && !isNaN(existing.bestLap) && existing.bestLap > 0
                const newBestLap = hasBestLap ? Math.min(existing.bestLap, lapTime) : lapTime
                return {
                    ...prev,
                    [controller]: {
                        ...existing,
                        laps: existing.laps + 1,
                        bestLap: newBestLap,
                        lastLap: lapTime,
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
                    const existing = updated[controller] || {}
                    // Only use bestLapTime from positions if it's valid
                    const newBestLap = (p.bestLapTime != null && !isNaN(p.bestLapTime) && p.bestLapTime > 0)
                        ? p.bestLapTime
                        : existing.bestLap
                    updated[controller] = {
                        ...existing,
                        laps: p.lapCount || existing.laps || 0,
                        lastLap: p.lastLapTime || existing.lastLap,
                        bestLap: newBestLap,
                        position: p.position
                    }
                })
                return updated
            })
        })

        // CU events
        socket.on('cu:connected', () => setCuConnected(true))
        socket.on('cu:disconnected', () => {
            setCuConnected(false)
            setCuStatus(null)
        })
        socket.on('cu:status', (data) => setCuStatus(data))

        // Session lifecycle events
        socket.on('session:finishing', ({ reason }) => {
            console.log(`🏁 Session finishing: ${reason}`)
            // Refresh session data to get new status
            loadData()
        })

        socket.on('session:auto-stopped', ({ reason }) => {
            console.log(`🛑 Session auto-stopped: ${reason}`)
            // Refresh session data
            loadData()
        })

        socket.on('session:restarted', ({ session }) => {
            console.log(`🔄 Session restarted: ${session.id}`)
            // Reset timer state
            raceStartTimeRef.current = null
            baseElapsedRef.current = 0
            setElapsedTime(0)
            setSessionDriverData({})
            // Refresh data
            loadData()
        })

        return () => {
            socket.disconnect()
        }
    }, [loadData])

    // Fetch CU status periodically
    useEffect(() => {
        const fetchCuStatus = async () => {
            try {
                const res = await fetch(`${API_URL}/api/bluetooth/status`)
                const data = await res.json()
                setCuConnected(data.connected)
                if (data.lastStatus) setCuStatus(data.lastStatus)
            } catch { /* ignore */ }
        }
        fetchCuStatus()
        const interval = setInterval(fetchCuStatus, 2000)
        return () => clearInterval(interval)
    }, [])

    // CU status helpers
    const getRaceState = () => {
        if (!cuStatus) return { text: 'Unknown', color: 'gray' }
        const start = cuStatus.start
        if (start === 0) return { text: 'Racing', color: 'green' }
        if (start >= 1 && start <= 5) return { text: `Lights ${start}/5`, color: 'yellow' }
        if (start === 6) return { text: 'False Start', color: 'red' }
        if (start === 7) return { text: 'Go!', color: 'green' }
        if (start >= 8) return { text: 'Stopped', color: 'red' }
        return { text: `State ${start}`, color: 'gray' }
    }

    const cuModes = useMemo(() => {
        if (!cuStatus) return []
        const modes = []
        if (cuStatus.mode & 1) modes.push('Fuel')
        if (cuStatus.mode & 2) modes.push('Real')
        if (cuStatus.mode & 4) modes.push('Pit')
        if (cuStatus.mode & 8) modes.push('Laps')
        return modes
    }, [cuStatus])

    // Reset session driver data when session changes
    useEffect(() => {
        setSessionDriverData({})
        setElapsedTime(0)
        raceStartTimeRef.current = null
        baseElapsedRef.current = 0
    }, [selectedSessionId])

    // Calculate max laps from session driver data
    const maxLapsCompleted = useMemo(() => {
        const laps = Object.values(sessionDriverData).map(d => d.laps || 0)
        return laps.length > 0 ? Math.max(...laps) : 0
    }, [sessionDriverData])

    // Format elapsed time as MM:SS
    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }

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

    // Compute session label (Q1, Q2, R1, R2, etc.)
    const getSessionLabel = (session, sessions) => {
        if (session.type === 'practice') return 'EL'
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

    // Find practice session
    const practiceSession = useMemo(() => {
        return sortedSessions.find(s => s.type === 'practice')
    }, [sortedSessions])

    // Validate saved session still exists, or auto-select practice session
    useEffect(() => {
        if (sortedSessions.length === 0) return

        if (selectedSessionId) {
            const exists = sortedSessions.some(s => s.id === selectedSessionId)
            if (!exists) {
                setSelectedSessionId(practiceSession?.id || null)
            }
        } else if (practiceSession) {
            // Auto-select practice session if none selected
            setSelectedSessionId(practiceSession.id)
        }
    }, [selectedSessionId, sortedSessions, practiceSession])

    // Selected session object
    const selectedSession = useMemo(() => {
        if (!selectedSessionId) return null
        return sortedSessions.find(s => s.id === selectedSessionId)
    }, [selectedSessionId, sortedSessions])

    // Timer for active session - only runs when CU is Racing (start === 0)
    const isRacing = cuStatus?.start === 0

    // Timer update - only when racing
    useEffect(() => {
        if (!isRacing) {
            // Save current elapsed time as base for next start
            if (raceStartTimeRef.current) {
                baseElapsedRef.current = elapsedTime
                raceStartTimeRef.current = null
            }
            return
        }

        // Start racing - set start time if not set
        if (!raceStartTimeRef.current) {
            raceStartTimeRef.current = Date.now()
        }

        const updateTimer = () => {
            const now = Date.now()
            const elapsed = Math.floor((now - raceStartTimeRef.current) / 1000) + baseElapsedRef.current
            setElapsedTime(elapsed)
        }

        updateTimer() // Initial update
        const interval = setInterval(updateTimer, 1000)

        return () => clearInterval(interval)
    }, [isRacing])

    // Calculate remaining time
    const remainingTime = useMemo(() => {
        if (!selectedSession?.duration) return null
        const totalSeconds = selectedSession.duration * 60
        const remaining = totalSeconds - elapsedTime
        return remaining > 0 ? remaining : 0
    }, [selectedSession?.duration, elapsedTime])

    // Auto-switch standings tab based on selected session type
    useEffect(() => {
        if (!selectedSession || selectedSession.type === 'practice') {
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
        // Build leaderboard from session drivers, merging with real-time data or stored laps
        const sessionLaps = selectedSession.laps || []
        const entries = (selectedSession.drivers || []).map((sd, idx) => {
            const controller = String(sd.controller)
            const realTime = sessionDriverData[controller] || {}

            // Calculate stats from stored laps (fallback for finished sessions or when no real-time data)
            let storedLaps = 0
            let storedBestLap = null
            let storedLastLap = null

            if (sessionLaps.length > 0) {
                const driverLaps = sessionLaps.filter(l => l.controller === controller)
                storedLaps = driverLaps.length
                if (driverLaps.length > 0) {
                    storedBestLap = Math.min(...driverLaps.map(l => l.lapTime))
                    storedLastLap = driverLaps[driverLaps.length - 1]?.lapTime
                }
            }

            // Prefer real-time data for active sessions, stored data for finished
            const isFinished = selectedSession.status === 'finished'
            return {
                id: sd.id,
                position: realTime.position || sd.finalPos || sd.gridPos || idx + 1,
                driver: sd.driver,
                car: sd.car,
                controller: sd.controller,
                laps: isFinished ? (storedLaps || realTime.laps || 0) : (realTime.laps || storedLaps || 0),
                bestLap: isFinished ? (storedBestLap || realTime.bestLap || null) : (realTime.bestLap || storedBestLap || null),
                lastLap: isFinished ? (storedLastLap || realTime.lastLap || null) : (realTime.lastLap || storedLastLap || null),
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

    // Edit qualifying session
    async function handleEditQualif(e) {
        e.preventDefault()
        if (!editingSession) return
        setSaving(true)
        try {
            const res = await fetch(`${API_URL}/api/sessions/${editingSession.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: qualifForm.name || null,
                    duration: qualifForm.duration > 0 ? qualifForm.duration : null,
                    maxLaps: qualifForm.maxLaps > 0 ? qualifForm.maxLaps : null
                })
            })
            if (res.ok) {
                setShowQualifModal(false)
                setEditingSession(null)
                setQualifForm({ name: '', duration: 10, maxLaps: 0 })
                loadData()
            }
        } catch (err) {
            console.error('Failed to edit qualifying:', err)
        } finally {
            setSaving(false)
        }
    }

    // Edit race session
    async function handleEditRace(e) {
        e.preventDefault()
        if (!editingSession) return
        setSaving(true)
        try {
            const res = await fetch(`${API_URL}/api/sessions/${editingSession.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: raceForm.name || null,
                    duration: raceForm.duration > 0 ? raceForm.duration : null,
                    maxLaps: raceForm.maxLaps > 0 ? raceForm.maxLaps : null
                })
            })
            if (res.ok) {
                setShowRaceModal(false)
                setEditingSession(null)
                setRaceForm({ name: '', duration: 0, maxLaps: 20 })
                loadData()
            }
        } catch (err) {
            console.error('Failed to edit race:', err)
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

    // Edit session - open modal with session data
    function handleEditSession(session) {
        const form = {
            name: session.name || '',
            duration: session.duration || 0,
            maxLaps: session.maxLaps || 0
        }
        if (session.type === 'qualifying') {
            setQualifForm(form)
            setEditingSession(session)
            setShowQualifModal(true)
        } else {
            setRaceForm(form)
            setEditingSession(session)
            setShowRaceModal(true)
        }
    }

    // Start session (puts CU in Lights 1)
    async function handleStartSession(sessionId) {
        try {
            // Reset real-time data before starting
            setSessionDriverData({})
            setElapsedTime(0)
            raceStartTimeRef.current = Date.now()
            baseElapsedRef.current = 0

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

    // Launch race countdown (START button on CU)
    async function handleLaunchRace() {
        try {
            await fetch(`${API_URL}/api/bluetooth/start-race`, {
                method: 'POST'
            })
        } catch (err) {
            console.error('Failed to launch race:', err)
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

    // Restart session (delete results and reset)
    async function handleRestartSession(sessionId) {
        try {
            const res = await fetch(`${API_URL}/api/sessions/${sessionId}/restart`, {
                method: 'POST'
            })
            if (res.ok) {
                // Reset all local state
                setSessionDriverData({})
                setElapsedTime(0)
                raceStartTimeRef.current = null
                baseElapsedRef.current = 0
                loadData()
            }
        } catch (err) {
            console.error('Failed to restart session:', err)
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

        // Build drivers payload - only include complete configs (driver + car)
        const driversPayload = newConfigs
            .filter(c => c.driverId && c.carId)
            .map(c => ({
                controller: c.controller,
                driverId: c.driverId,
                carId: c.carId
            }))

        // Only save if:
        // 1. The changed controller has BOTH driver and car (adding/updating)
        // 2. OR the changed controller had a driver before but now doesn't (removing)
        const changedConfig = newConfigs.find(c => c.controller === controllerStr)
        const existingDriver = selectedSession.drivers?.find(d => d.controller === controllerStr)
        const isRemoving = existingDriver && (!changedConfig?.driverId || !changedConfig?.carId)
        const isComplete = changedConfig?.driverId && changedConfig?.carId

        if (!isComplete && !isRemoving) {
            return // Don't save yet, wait for complete config
        }

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
                        {/* CU Status */}
                        <div className="flex items-center gap-2">
                            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                                cuConnected ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                            }`}>
                                <BoltIcon className="w-3.5 h-3.5" />
                                {cuConnected ? 'CU' : 'CU Off'}
                            </div>
                            {cuConnected && cuStatus && (
                                <>
                                    <div className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                                        getRaceState().color === 'green' ? 'bg-green-100 text-green-700' :
                                        getRaceState().color === 'yellow' ? 'bg-yellow-100 text-yellow-700' :
                                        getRaceState().color === 'red' ? 'bg-red-100 text-red-700' :
                                        'bg-gray-100 text-gray-600'
                                    }`}>
                                        {getRaceState().text}
                                    </div>
                                    {cuModes.length > 0 && (
                                        <div className="flex gap-1">
                                            {cuModes.map(m => (
                                                <span key={m} className="px-1.5 py-0.5 bg-gray-200 text-gray-600 text-[10px] rounded">
                                                    {m}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

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
                                        {sortedSessions.map(session => (
                                            <button
                                                key={session.id}
                                                onClick={() => {
                                                    setSelectedSessionId(session.id)
                                                    setSessionDropdownOpen(false)
                                                }}
                                                className={`w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 ${selectedSessionId === session.id ? 'bg-yellow-50 text-yellow-700' : ''}`}
                                            >
                                                {session.type === 'practice' ? (
                                                    <BeakerIcon className="w-4 h-4 text-purple-500" />
                                                ) : session.type === 'qualifying' ? (
                                                    <ClockIcon className="w-4 h-4 text-blue-500" />
                                                ) : (
                                                    <FlagIcon className="w-4 h-4 text-green-500" />
                                                )}
                                                <span>{getSessionLabel(session, sortedSessions)}</span>
                                                <span className="text-xs text-gray-400 ml-auto">
                                                    {session.status === 'finished' ? 'Terminé' : session.status}
                                                </span>
                                            </button>
                                        ))}
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
                                <div className="flex items-center gap-3">
                                    <h2 className="text-lg font-semibold text-gray-900">
                                        {getSessionLabel(selectedSession, sortedSessions)} - {selectedSession.name || 'Session'}
                                    </h2>
                                    {/* End conditions - live counters when active, badges otherwise */}
                                    <div className="flex items-center gap-2">
                                        {selectedSession.status === 'active' ? (
                                            <>
                                                {selectedSession.duration > 0 && (
                                                    <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold ${
                                                        remainingTime !== null && remainingTime <= 60
                                                            ? 'bg-red-500 text-white animate-pulse'
                                                            : 'bg-blue-500 text-white'
                                                    }`}>
                                                        <ClockIcon className="w-4 h-4" />
                                                        {remainingTime !== null ? formatTime(remainingTime) : formatTime(elapsedTime)}
                                                    </span>
                                                )}
                                                {selectedSession.maxLaps > 0 && (
                                                    <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold ${
                                                        maxLapsCompleted >= selectedSession.maxLaps
                                                            ? 'bg-red-500 text-white animate-pulse'
                                                            : 'bg-green-500 text-white'
                                                    }`}>
                                                        <ArrowPathIcon className="w-4 h-4" />
                                                        {maxLapsCompleted} / {selectedSession.maxLaps}
                                                    </span>
                                                )}
                                                {!selectedSession.duration && !selectedSession.maxLaps && (
                                                    <span className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 text-white rounded-lg text-sm font-bold">
                                                        <ClockIcon className="w-4 h-4" />
                                                        {formatTime(elapsedTime)}
                                                    </span>
                                                )}
                                            </>
                                        ) : (
                                            <>
                                                {selectedSession.duration > 0 && (
                                                    <span className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                                                        <ClockIcon className="w-3.5 h-3.5" />
                                                        {selectedSession.duration} min
                                                    </span>
                                                )}
                                                {selectedSession.maxLaps > 0 && (
                                                    <span className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                                                        <ArrowPathIcon className="w-3.5 h-3.5" />
                                                        {selectedSession.maxLaps} tours
                                                    </span>
                                                )}
                                                {!selectedSession.duration && !selectedSession.maxLaps && (
                                                    <span className="px-2 py-1 bg-gray-100 text-gray-500 rounded-full text-xs">
                                                        Pas de limite
                                                    </span>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                                        selectedSession.status === 'finished' ? 'bg-blue-100 text-blue-700' :
                                        selectedSession.status === 'finishing' ? 'bg-orange-100 text-orange-700 animate-pulse' :
                                        selectedSession.status === 'active' ? 'bg-green-100 text-green-700' :
                                        'bg-gray-100 text-gray-700'
                                    }`}>
                                        {selectedSession.status === 'finished' ? 'Terminé' :
                                         selectedSession.status === 'finishing' ? '🏁 Fin de session...' :
                                         selectedSession.status === 'active' ? 'En cours' : selectedSession.status}
                                    </span>
                                    {selectedSession.status === 'draft' || selectedSession.status === 'pending' ? (
                                        // Session not started - show "Démarrer"
                                        <button
                                            onClick={() => handleStartSession(selectedSession.id)}
                                            className="px-3 py-1.5 bg-green-500 text-white text-sm font-medium rounded-lg hover:bg-green-600 transition-colors flex items-center gap-1"
                                        >
                                            <PlayIcon className="w-4 h-4" />
                                            Démarrer
                                        </button>
                                    ) : selectedSession.status === 'finishing' ? (
                                        // Session finishing - show disabled "Fin..."
                                        <span className="px-3 py-1.5 bg-orange-500 text-white text-sm font-medium rounded-lg flex items-center gap-1">
                                            <FlagIcon className="w-4 h-4" />
                                            Attente fin...
                                        </span>
                                    ) : selectedSession.status === 'finished' ? (
                                        // Session finished - no action button
                                        null
                                    ) : cuStatus?.start >= 1 && cuStatus?.start <= 5 ? (
                                        // Session active, CU in lights - show "START"
                                        <button
                                            onClick={handleLaunchRace}
                                            className="px-3 py-1.5 bg-yellow-500 text-white text-sm font-bold rounded-lg hover:bg-yellow-600 transition-colors flex items-center gap-1 animate-pulse"
                                        >
                                            <PlayIcon className="w-4 h-4" />
                                            START
                                        </button>
                                    ) : (
                                        // Session active, CU racing or other - show "Arrêter"
                                        <button
                                            onClick={() => handleStopSession(selectedSession.id)}
                                            className="px-3 py-1.5 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 transition-colors"
                                        >
                                            Arrêter
                                        </button>
                                    )}
                                    {selectedSession.type !== 'practice' && (
                                        <button
                                            onClick={() => handleEditSession(selectedSession)}
                                            className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors"
                                            title="Modifier la session"
                                        >
                                            <PencilIcon className="w-4 h-4" />
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handleRestartSession(selectedSession.id)}
                                        className="p-1.5 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded transition-colors"
                                        title="Réinitialiser (supprimer les résultats)"
                                    >
                                        <ArrowUturnLeftIcon className="w-4 h-4" />
                                    </button>
                                    {selectedSession.type !== 'practice' && (
                                        <button
                                            onClick={() => handleDeleteSession(selectedSession.id)}
                                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                            title="Supprimer la session"
                                        >
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
                                    )}
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
                    <main className="flex-1 overflow-auto p-6 bg-gray-50">
                        <div>
                            {/* Free Practice Header */}
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <h2 className="text-lg font-semibold text-gray-900">
                                        Essais Libres
                                    </h2>
                                    {/* Live timer when racing */}
                                    {cuStatus?.start === 0 && (
                                        <span className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 text-white rounded-lg text-sm font-bold">
                                            <ClockIcon className="w-4 h-4" />
                                            {formatTime(elapsedTime)}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    {/* CU Control Buttons */}
                                    {cuStatus?.start >= 1 && cuStatus?.start <= 5 ? (
                                        <button
                                            onClick={handleLaunchRace}
                                            className="px-3 py-1.5 bg-yellow-500 text-white text-sm font-bold rounded-lg hover:bg-yellow-600 transition-colors flex items-center gap-1 animate-pulse"
                                        >
                                            <PlayIcon className="w-4 h-4" />
                                            START
                                        </button>
                                    ) : cuStatus?.start === 0 ? (
                                        <button
                                            onClick={async () => {
                                                try {
                                                    await fetch(`${API_URL}/api/bluetooth/esc`, { method: 'POST' })
                                                } catch (err) {
                                                    console.error('Failed to stop:', err)
                                                }
                                            }}
                                            className="px-3 py-1.5 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 transition-colors"
                                        >
                                            Arrêter
                                        </button>
                                    ) : (
                                        <button
                                            onClick={async () => {
                                                try {
                                                    await fetch(`${API_URL}/api/bluetooth/start-race`, { method: 'POST' })
                                                } catch (err) {
                                                    console.error('Failed to start:', err)
                                                }
                                            }}
                                            className="px-3 py-1.5 bg-green-500 text-white text-sm font-medium rounded-lg hover:bg-green-600 transition-colors flex items-center gap-1"
                                        >
                                            <PlayIcon className="w-4 h-4" />
                                            Démarrer
                                        </button>
                                    )}
                                    <button
                                        onClick={resetFreePracticeBoard}
                                        className="p-1.5 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded transition-colors"
                                        title="Réinitialiser les temps"
                                    >
                                        <ArrowUturnLeftIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Free Practice Leaderboard */}
                            <FreePracticeLeaderboard
                                freePracticeBoard={freePracticeBoard}
                                configs={configs}
                                onReset={resetFreePracticeBoard}
                            />
                        </div>
                    </main>
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
                            <h2 className="text-xl font-bold text-gray-800">
                                {editingSession ? 'Modifier qualification' : 'Nouvelle qualification'}
                            </h2>
                            <button onClick={() => { setShowQualifModal(false); setEditingSession(null) }} className="p-1 hover:bg-gray-100 rounded">
                                <XMarkIcon className="w-6 h-6 text-gray-500" />
                            </button>
                        </div>

                        <form onSubmit={editingSession ? handleEditQualif : handleCreateQualif} className="space-y-4">
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
                                    onClick={() => { setShowQualifModal(false); setEditingSession(null) }}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                                >
                                    Annuler
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-6 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50"
                                >
                                    {saving ? 'Sauvegarde...' : (editingSession ? 'Modifier' : 'Créer')}
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
                            <h2 className="text-xl font-bold text-gray-800">
                                {editingSession ? 'Modifier course' : 'Nouvelle course'}
                            </h2>
                            <button onClick={() => { setShowRaceModal(false); setEditingSession(null) }} className="p-1 hover:bg-gray-100 rounded">
                                <XMarkIcon className="w-6 h-6 text-gray-500" />
                            </button>
                        </div>

                        <form onSubmit={editingSession ? handleEditRace : handleCreateRace} className="space-y-4">
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
                                    onClick={() => { setShowRaceModal(false); setEditingSession(null) }}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                                >
                                    Annuler
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-6 py-2 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 disabled:opacity-50"
                                >
                                    {saving ? 'Sauvegarde...' : (editingSession ? 'Modifier' : 'Créer')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
