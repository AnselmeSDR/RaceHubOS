import { ArrowLeftIcon, ArrowPathIcon, BoltIcon, ChartBarIcon, ClockIcon, CogIcon, FlagIcon, MapPinIcon, StopIcon, TrashIcon, TrophyIcon, UsersIcon } from '@heroicons/react/24/outline'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import io from 'socket.io-client'
import ErrorMessage from '../components/ErrorMessage'
import PhaseControl from '../components/PhaseControl'
import SessionForm from '../components/SessionForm'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3000'

export default function SessionDetail () {
    const { id } = useParams()
    const navigate = useNavigate()
    const [session, setSession] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [leaderboard, setLeaderboard] = useState([])
    const [showEditForm, setShowEditForm] = useState(false)
    const [socket, setSocket] = useState(null)
    const [liveData, setLiveData] = useState({})
    const [activePhaseTab, setActivePhaseTab] = useState('practice')
    const [cuConnected, setCuConnected] = useState(false)
    const [cuStatus, setCuStatus] = useState(null)
    const [elapsedTime, setElapsedTime] = useState(0)
    const [phaseLeaderboards, setPhaseLeaderboards] = useState({
        practice: [],
        qualifying: [],
        race: []
    })

    useEffect(() => {
        loadSession()
        loadAllLeaderboards()

        // Initialize WebSocket
        const newSocket = io(WS_URL)
        setSocket(newSocket)

        // Listen for live updates
        newSocket.on('lap_completed', (data) => {
            if (data.sessionId === id) {
                loadAllLeaderboards()
            }
        })

        newSocket.on('session_update', (data) => {
            if (data.id === id) {
                setSession(prev => ({ ...prev, ...data }))
            }
        })

        // Listen for auto-stop
        newSocket.on('phase:auto-stopped', (data) => {
            if (data.sessionId === id) {
                alert(`Phase ${data.phase} terminée automatiquement: ${data.reason}`)
                loadSession()
                loadAllLeaderboards()
            }
        })

        // CU connection status
        newSocket.on('cu:connected', () => {
            setCuConnected(true)
        })

        newSocket.on('cu:disconnected', () => {
            setCuConnected(false)
        })

        newSocket.on('cu:status', (status) => {
            setCuConnected(status.connected !== false)
            setCuStatus(status)
        })

        // Real-time lap completed from CU
        newSocket.on('lap:completed', (data) => {
            if (data.sessionId === id) {
                console.log('🏁 Lap completed:', data)
                loadAllLeaderboards()
            }
        })

        // Phase events
        newSocket.on('phase:started', (data) => {
            if (data.sessionId === id) {
                loadSession()
            }
        })

        newSocket.on('phase:paused', (data) => {
            if (data.sessionId === id) {
                loadSession()
            }
        })

        newSocket.on('phase:resumed', (data) => {
            if (data.sessionId === id) {
                loadSession()
            }
        })

        newSocket.on('phase:finished', (data) => {
            if (data.sessionId === id) {
                loadSession()
                loadAllLeaderboards()
            }
        })

        return () => {
            newSocket.disconnect()
        }
    }, [id])

    // Chronomètre basé sur la PHASE actuelle (pas la session)
    useEffect(() => {
        let interval
        if (session?.phaseStatus === 'running' && session?.phaseStartedAt) {
            interval = setInterval(() => {
                const start = new Date(session.phaseStartedAt).getTime()
                const now = new Date().getTime()
                setElapsedTime(Math.floor((now - start) / 1000))
            }, 1000)
        } else if (session?.phaseStatus === 'finished' && session?.phaseStartedAt && session?.phaseFinishedAt) {
            const start = new Date(session.phaseStartedAt).getTime()
            const end = new Date(session.phaseFinishedAt).getTime()
            setElapsedTime(Math.floor((end - start) / 1000))
        } else if (session?.phaseStatus === 'paused' && session?.phaseStartedAt) {
            const start = new Date(session.phaseStartedAt).getTime()
            const now = new Date().getTime()
            setElapsedTime(Math.floor((now - start) / 1000))
        } else if (session?.phaseStatus === 'waiting') {
            setElapsedTime(0)
        }

        return () => {
            if (interval) clearInterval(interval)
        }
    }, [session?.phaseStatus, session?.phaseStartedAt, session?.phaseFinishedAt])

    async function loadSession () {
        try {
            const res = await fetch(`${API_URL}/sessions/${id}`)
            const data = await res.json()

            if (data.success) {
                setSession(data.data)
            } else {
                setError('Session introuvable')
            }
        } catch (err) {
            console.error('Error loading session:', err)
            setError('Erreur lors du chargement de la session')
        } finally {
            setLoading(false)
        }
    }

    async function loadAllLeaderboards () {
        try {
            // Charger le classement pour chaque phase
            const phases = ['practice', 'qualifying', 'race']
            const results = await Promise.all(
                phases.map(phase =>
                    fetch(`${API_URL}/stats/leaderboard/drivers?sessionId=${id}&phase=${phase}`)
                        .then(res => res.json())
                )
            )

            const newLeaderboards = {}
            phases.forEach((phase, index) => {
                if (results[index].success) {
                    newLeaderboards[phase] = results[index].data || []
                }
            })

            setPhaseLeaderboards(newLeaderboards)

            // Garder le leaderboard général pour compatibilité
            if (results[0].success) {
                setLeaderboard(results[0].data || [])
            }
        } catch (err) {
            console.error('Error loading leaderboards:', err)
        }
    }

    // ========== PHASE CONTROL FUNCTIONS ==========

    async function handleStartPhase (phase = null) {
        try {
            const targetPhase = phase || session.currentPhase
            console.log('🎬 Démarrage phase:', { targetPhase, sessionStatus: session.status, phaseStatus: session.phaseStatus })

            // Utiliser la nouvelle route session-control
            const res = await fetch(`${API_URL}/session-control/${id}/phases/${targetPhase}/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            })

            const data = await res.json()
            console.log('📥 Réponse start:', data)

            if (res.ok) {
                await loadSession()
                await loadAllLeaderboards()
            } else {
                setError(data.error || 'Erreur lors du démarrage de la phase')
            }
        } catch (err) {
            console.error('❌ Error starting phase:', err)
            setError('Erreur lors du démarrage de la phase: ' + err.message)
        }
    }

    async function handlePausePhase () {
        try {
            const res = await fetch(`${API_URL}/session-control/${id}/phases/${session.currentPhase}/pause`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            })

            if (res.ok) {
                await loadSession()
            } else {
                setError('Erreur lors de la pause')
            }
        } catch (err) {
            console.error('Error pausing phase:', err)
            setError('Erreur lors de la mise en pause')
        }
    }

    async function handleResumePhase () {
        try {
            const res = await fetch(`${API_URL}/session-control/${id}/phases/${session.currentPhase}/resume`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            })

            if (res.ok) {
                await loadSession()
            } else {
                setError('Erreur lors de la reprise')
            }
        } catch (err) {
            console.error('Error resuming phase:', err)
            setError('Erreur lors de la reprise')
        }
    }

    async function handleStopPhase () {
        if (!confirm('Terminer cette phase ? Les données seront enregistrées et vous pourrez passer à la phase suivante.')) {
            return
        }

        try {
            const res = await fetch(`${API_URL}/session-control/${id}/phases/${session.currentPhase}/finish`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            })

            if (res.ok) {
                loadSession()
                loadAllLeaderboards()
            } else {
                setError('Erreur lors de l\'arrêt de la phase')
            }
        } catch (err) {
            console.error('Error stopping phase:', err)
            setError('Erreur lors de l\'arrêt de la phase')
        }
    }

    async function handleResetPhase () {
        if (!confirm('Réinitialiser cette phase ? Tous les tours de cette phase seront supprimés.')) {
            return
        }

        try {
            // Supprimer tous les tours de la phase actuelle
            const res = await fetch(`${API_URL}/laps/by-phase`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: id,
                    phase: session.currentPhase
                })
            })

            if (res.ok) {
                // Remettre la phase en attente
                await fetch(`${API_URL}/sessions/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        phaseStatus: 'waiting',
                        phaseStartedAt: null,
                        phaseFinishedAt: null
                    })
                })

                loadSession()
                loadAllLeaderboards()
                setElapsedTime(0)
            } else {
                setError('Erreur lors de la réinitialisation')
            }
        } catch (err) {
            console.error('Error resetting phase:', err)
            setError('Erreur lors de la réinitialisation de la phase')
        }
    }

    async function handleFinishSession () {
        if (!confirm('Terminer toute la session ? Cela mettra fin à toutes les phases.')) {
            return
        }

        try {
            const res = await fetch(`${API_URL}/active-session/finish`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            })

            if (res.ok) {
                loadSession()
                loadAllLeaderboards()
            } else {
                setError('Erreur lors de la fin de session')
            }
        } catch (err) {
            console.error('Error finishing session:', err)
            setError('Erreur lors de la fin de session')
        }
    }

    async function handleReset () {
        if (!confirm('Êtes-vous sûr de vouloir redémarrer cette session ? Toutes les données de course seront supprimées.')) return

        try {
            const res = await fetch(`${API_URL}/sessions/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: 'setup',
                    startedAt: null,
                    finishedAt: null
                })
            })

            if (res.ok) {
                loadSession()
                setElapsedTime(0)
            } else {
                setError('Erreur lors du redémarrage')
            }
        } catch (err) {
            console.error('Error resetting session:', err)
            setError('Erreur lors du redémarrage de la session')
        }
    }

    async function handlePhaseChange (newPhase) {
        // Si la nouvelle phase est la même que l'actuelle, ne rien faire
        if (newPhase === session.currentPhase) {
            return
        }

        // Sauvegarder l'ancienne phase au cas où on annule
        const oldPhase = session.currentPhase

        // Validation: si une phase est en cours, demander confirmation
        if (session.phaseStatus === 'running') {
            if (!confirm('Une phase est en cours. Voulez-vous l\'arrêter pour passer à la phase suivante ?')) {
                // Restaurer l'ancienne phase dans le state pour que le select revienne
                setSession(prev => ({ ...prev, currentPhase: oldPhase }))
                return
            }

            // Arrêter la phase actuelle
            try {
                await fetch(`${API_URL}/active-session/stop-phase`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                })
            } catch (err) {
                console.error('Error stopping phase:', err)
                setError('Erreur lors de l\'arrêt de la phase')
                setSession(prev => ({ ...prev, currentPhase: oldPhase }))
                return
            }
        }

        // Mise à jour optimiste pour feedback immédiat
        setSession(prev => ({ ...prev, currentPhase: newPhase }))
        setActivePhaseTab(newPhase)

        try {
            const res = await fetch(`${API_URL}/sessions/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    currentPhase: newPhase,
                    phaseStatus: 'waiting', // Remettre en attente
                    phaseStartedAt: null,
                    phaseFinishedAt: null
                })
            })

            if (!res.ok) {
                setError('Erreur lors du changement de phase')
                // Restaurer l'ancienne phase en cas d'erreur
                setSession(prev => ({ ...prev, currentPhase: oldPhase }))
                setActivePhaseTab(oldPhase)
                return
            }

            // Recharger pour synchroniser avec le backend
            await loadSession()
            await loadAllLeaderboards()
        } catch (err) {
            console.error('Error changing phase:', err)
            setError('Erreur lors du changement de phase')
            // Restaurer l'ancienne phase en cas d'erreur
            setSession(prev => ({ ...prev, currentPhase: oldPhase }))
            setActivePhaseTab(oldPhase)
        }
    }

    async function handleDelete () {
        if (!confirm('Êtes-vous sûr de vouloir supprimer cette session ?')) return

        try {
            const res = await fetch(`${API_URL}/sessions/${id}`, { method: 'DELETE' })
            if (res.ok) {
                navigate('/sessions')
            } else {
                setError('Erreur lors de la suppression')
            }
        } catch (err) {
            console.error('Error deleting session:', err)
            setError('Erreur lors de la suppression')
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full bg-gray-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600 text-lg">Chargement de la session...</p>
                </div>
            </div>
        )
    }

    if (!session) {
        return (
            <div className="p-8 bg-gray-50 min-h-screen">
                <button
                    onClick={() => navigate('/sessions')}
                    className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 mb-8"
                >
                    <ArrowLeftIcon className="w-5 h-5" />
                    Retour aux sessions
                </button>
                <div className="text-center text-gray-500">Session introuvable</div>
            </div>
        )
    }

    const sessionColor = session.track?.color || '#6366F1'

    // État de la SESSION ENTIÈRE
    const sessionActive = session.status === 'active'
    const sessionFinished = session.status === 'finished'

    // État de la PHASE ACTUELLE
    const phaseWaiting = session.phaseStatus === 'waiting'
    const phaseRunning = session.phaseStatus === 'running'
    const phasePaused = session.phaseStatus === 'paused'
    const phaseFinished = session.phaseStatus === 'finished'

    // Formater le temps en HH:MM:SS
    const formatTime = (seconds) => {
        const hours = Math.floor(seconds / 3600)
        const minutes = Math.floor((seconds % 3600) / 60)
        const secs = seconds % 60
        return `${hours.toString()
            .padStart(2, '0')}:${minutes.toString()
            .padStart(2, '0')}:${secs.toString()
            .padStart(2, '0')}`
    }

    // Calculer le temps restant si durée définie
    const remainingTime = session?.duration ? (session.duration * 60) - elapsedTime : null

    return (
        <>
            {/* Animations CSS */}
            <style>{`
        @keyframes fadeInSlide {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes animate-pulse-slow {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.95;
          }
        }

        .animate-pulse-slow {
          animation: animate-pulse-slow 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
      `}</style>

            <div className="min-h-screen bg-gray-50">
                {/* Header Hero */}
                <div
                    className="relative bg-gradient-to-r from-indigo-600 to-purple-600"
                    style={{
                        background: session.track?.photo
                            ? `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.7)), url(${session.track.photo})`
                            : `linear-gradient(135deg, ${sessionColor} 0%, ${sessionColor}dd 100%)`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center'
                    }}
                >
                    {/* Background pattern - only if no photo */}
                    {!session.track?.photo && (
                        <div className="absolute inset-0 opacity-10">
                            <div className="absolute inset-0" style={{
                                backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 35px, rgba(255,255,255,.05) 35px, rgba(255,255,255,.05) 70px)`
                            }}></div>
                        </div>
                    )}

                    {/* Content avec padding cohérent */}
                    <div className="relative max-w-7xl mx-auto p-8">
                        {/* Navigation */}
                        <div className="mb-8">
                            <button
                                onClick={() => navigate('/sessions')}
                                className="flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm rounded-lg text-white hover:bg-white/30 transition-all"
                            >
                                <ArrowLeftIcon className="w-5 h-5" />
                                Retour
                            </button>
                        </div>

                        {/* Session Info */}
                        <div className="flex flex-col gap-8 pb-4">
                            {/* Top section - Badges, Title & Buttons */}
                            <div className="flex items-start justify-between gap-6">
                                <div className="text-white flex-1">
                                    {/* Badges */}
                                    <div className="flex items-center gap-3 mb-3">
                  <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                      session.type === 'race' ? 'bg-green-500/30 border border-green-400' :
                          session.type === 'qualifying' ? 'bg-purple-500/30 border border-purple-400' :
                              'bg-blue-500/30 border border-blue-400'
                  }`}>
                    {getSessionTypeLabel(session.type)}
                  </span>
                                        <span className={`px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-2 ${
                                            phaseRunning ? 'bg-green-500/30 border border-green-400' :
                                                phasePaused ? 'bg-yellow-500/30 border border-yellow-400' :
                                                    phaseFinished ? 'bg-blue-500/30 border border-blue-400' :
                                                        'bg-gray-500/30 border border-gray-400'
                                        }`}>
                    {phaseRunning && <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />}
                                            {getStatusLabel(session.phaseStatus)}
                  </span>
                                    </div>

                                    {/* Title */}
                                    <h1 className="text-4xl font-bold mb-4">
                                        {session.name || `Session #${session.id.slice(0, 8)}`}
                                    </h1>
                                </div>

                                {/* Control Buttons */}
                                <div className="flex items-center gap-3 flex-shrink-0">
                                    {/* Bouton terminer la session entière */}
                                    {sessionActive && !sessionFinished && (
                                        <button
                                            onClick={handleFinishSession}
                                            className="px-4 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all shadow-lg font-semibold flex items-center gap-2"
                                            title="Terminer toute la session"
                                        >
                                            <StopIcon className="w-5 h-5" />
                                            Terminer la session
                                        </button>
                                    )}

                                    {/* Bouton reset complet (si terminée) */}
                                    {sessionFinished && (
                                        <button
                                            onClick={handleReset}
                                            className="px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all shadow-lg font-semibold flex items-center gap-2"
                                            title="Redémarrer la session"
                                        >
                                            <ArrowPathIcon className="w-5 h-5" />
                                            Redémarrer
                                        </button>
                                    )}

                                    <button
                                        onClick={() => setShowEditForm(true)}
                                        className="p-3 bg-white/20 backdrop-blur-sm text-white rounded-lg hover:bg-white/30 transition-all"
                                        title="Paramètres"
                                    >
                                        <CogIcon className="w-6 h-6" />
                                    </button>

                                    <button
                                        onClick={handleDelete}
                                        className="p-3 bg-red-500/80 backdrop-blur-sm text-white rounded-lg hover:bg-red-600 transition-all"
                                        title="Supprimer la session"
                                    >
                                        <TrashIcon className="w-6 h-6" />
                                    </button>
                                </div>
                            </div>

                            {/* Info cards */}
                            <div className="flex flex-wrap items-center gap-4 pb-2 text-white">
                                {/* Circuit */}
                                <div className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20">
                                    <MapPinIcon className="w-5 h-5" />
                                    <span className="font-medium">{session.track?.name || 'Circuit non défini'}</span>
                                </div>

                                {/* Championnat */}
                                {session.championship && (
                                    <div className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20">
                                        <TrophyIcon className="w-5 h-5 text-yellow-400" />
                                        <span className="font-medium">{session.championship.name}</span>
                                    </div>
                                )}

                                {/* Chronomètre */}
                                <div className="flex items-center gap-3 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20">
                                    <ClockIcon className="w-5 h-5" />
                                    <span className="font-mono text-2xl font-bold">
                  {formatTime(elapsedTime)}
                </span>
                                    {session.duration && remainingTime !== null && (
                                        <span className="text-sm opacity-75">
                    / {session.duration}min
                  </span>
                                    )}
                                </div>

                                {/* CU Connection Status */}
                                <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${
                                    cuConnected
                                        ? 'bg-green-500/20 border-green-400'
                                        : 'bg-red-500/20 border-red-400'
                                }`}>
                                    <div className={`w-3 h-3 rounded-full ${
                                        cuConnected
                                            ? 'bg-green-400 animate-pulse'
                                            : 'bg-red-400'
                                    }`} />
                                    <span className="font-medium text-sm">
                                        {cuConnected ? 'CU Connecté' : 'CU Déconnecté'}
                                    </span>
                                    {cuConnected && cuStatus?.start !== undefined && (
                                        <span className={`text-xs px-2 py-0.5 rounded ${
                                            cuStatus.start === 0
                                                ? 'bg-green-500/50 border border-green-300'
                                                : 'bg-yellow-500/50 border border-yellow-300'
                                        }`}>
                                            {cuStatus.start === 0 ? 'RACING' : `LIGHTS ${cuStatus.start}/5`}
                                        </span>
                                    )}
                                </div>

                                {/* Control Unit Info */}
                                {session.cuVersion && (
                                    <div className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20">
                                        <BoltIcon className="w-5 h-5 text-yellow-400" />
                                        <div className="flex items-center gap-3 text-sm">
                                            <span className="font-mono font-semibold">{session.cuVersion}</span>
                                            {session.cuNumCars && (
                                                <span className="opacity-75">{session.cuNumCars} slots</span>
                                            )}
                                            {session.cuFuelMode && (
                                                <span className="text-xs bg-orange-500/30 px-2 py-0.5 rounded border border-orange-400">FUEL</span>
                                            )}
                                            {session.cuPitLane && (
                                                <span className="text-xs bg-blue-500/30 px-2 py-0.5 rounded border border-blue-400">PIT</span>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Sélecteur de phase */}
                                <div className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20">
                                    <span className="text-sm font-medium opacity-90">Phase:</span>
                                    <select
                                        value={session.currentPhase || 'practice'}
                                        onChange={(e) => handlePhaseChange(e.target.value)}
                                        className="bg-white text-gray-900 border-2 border-gray-300 rounded-md px-3 py-1.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                                        disabled={sessionFinished}
                                    >
                                        <option value="practice">🏁 Essais libres</option>
                                        <option value="qualifying">⏱️ Qualifications</option>
                                        <option value="race">🏆 Course</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                <div className="max-w-7xl mx-auto px-8 -mt-12 relative z-10 pb-8">
                    {error && (
                        <div className="mb-6">
                            <ErrorMessage type="error" message={error} onClose={() => setError('')} />
                        </div>
                    )}

                    {/* Stats Cards */}
                    <div className="flex flex-wrap gap-6 mb-8">
                        {/* Pilotes */}
                        <div className="bg-white rounded-xl shadow-lg p-6 flex-1 min-w-[240px]">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-3">
                                        <UsersIcon className="w-8 h-8 text-indigo-500 flex-shrink-0" />
                                        <span className="text-3xl font-bold text-gray-900">{session.drivers?.length || 0}</span>
                                    </div>
                                    <p className="text-gray-600 font-medium">Pilotes</p>
                                    <p className="text-sm text-gray-500">En compétition</p>
                                </div>
                            </div>
                        </div>

                        {/* Tours */}
                        <div className="bg-white rounded-xl shadow-lg p-6 flex-1 min-w-[240px]">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-3">
                                        <FlagIcon className="w-8 h-8 text-green-500 flex-shrink-0" />
                                        <span className="text-3xl font-bold text-gray-900">{session._count?.laps || 0}</span>
                                    </div>
                                    <p className="text-gray-600 font-medium">Tours</p>
                                    <p className="text-sm text-gray-500">Complétés</p>
                                </div>
                            </div>
                        </div>

                        {/* Durée/Tours max */}
                        <div className="bg-white rounded-xl shadow-lg p-6 flex-1 min-w-[240px]">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-3">
                                        <ClockIcon className="w-8 h-8 text-purple-500 flex-shrink-0" />
                                        <span className="text-3xl font-bold text-gray-900">
                    {session.duration || session.maxLaps || '∞'}
                  </span>
                                    </div>
                                    <p className="text-gray-600 font-medium">{session.duration ? 'Durée' : 'Tours max'}</p>
                                    <p className="text-sm text-gray-500">{session.duration ? 'Minutes' : 'Tours'}</p>
                                </div>
                            </div>
                        </div>

                        {/* Carburant */}
                        <div className="bg-white rounded-xl shadow-lg p-6 flex-1 min-w-[240px]">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-3">
                                        <BoltIcon className="w-8 h-8 text-yellow-500 flex-shrink-0" />
                                        <span className="text-3xl font-bold text-gray-900">{session.fuelMode}</span>
                                    </div>
                                    <p className="text-gray-600 font-medium">Carburant</p>
                                    <p className="text-sm text-gray-500">Mode {session.fuelMode}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Tabs - Phases */}
                    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                        <div className="border-b border-gray-200">
                            <div className="flex">
                                <button
                                    onClick={() => setActivePhaseTab('practice')}
                                    className={`px-6 py-4 font-medium transition-all flex items-center gap-2 ${
                                        activePhaseTab === 'practice'
                                            ? 'text-blue-600 border-b-2 border-blue-600'
                                            : 'text-gray-600 hover:text-gray-900'
                                    }`}
                                >
                                    <ClockIcon className="w-5 h-5" />
                                    Essais libres
                                    {phaseLeaderboards.practice.length > 0 && (
                                        <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                    {phaseLeaderboards.practice.length}
                  </span>
                                    )}
                                </button>
                                <button
                                    onClick={() => setActivePhaseTab('qualifying')}
                                    className={`px-6 py-4 font-medium transition-all flex items-center gap-2 ${
                                        activePhaseTab === 'qualifying'
                                            ? 'text-purple-600 border-b-2 border-purple-600'
                                            : 'text-gray-600 hover:text-gray-900'
                                    }`}
                                >
                                    <ChartBarIcon className="w-5 h-5" />
                                    Qualifications
                                    {phaseLeaderboards.qualifying.length > 0 && (
                                        <span className="ml-2 px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">
                    {phaseLeaderboards.qualifying.length}
                  </span>
                                    )}
                                </button>
                                <button
                                    onClick={() => setActivePhaseTab('race')}
                                    className={`px-6 py-4 font-medium transition-all flex items-center gap-2 ${
                                        activePhaseTab === 'race'
                                            ? 'text-green-600 border-b-2 border-green-600'
                                            : 'text-gray-600 hover:text-gray-900'
                                    }`}
                                >
                                    <FlagIcon className="w-5 h-5" />
                                    Course
                                    {phaseLeaderboards.race.length > 0 && (
                                        <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                    {phaseLeaderboards.race.length}
                  </span>
                                    )}
                                </button>
                            </div>
                        </div>

                        <div className="p-8">
                            {/* Affichage du classement selon la phase */}
                            <div className="space-y-6">
                                {/* Phase Control ou bouton d'activation */}
                                {session?.currentPhase === activePhaseTab ? (
                                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
                                        <PhaseControl
                                            phase={activePhaseTab}
                                            phaseStatus={session.phaseStatus}
                                            onStart={() => handleStartPhase(activePhaseTab)}
                                            onResume={handleResumePhase}
                                            onPause={handlePausePhase}
                                            onStop={handleStopPhase}
                                            onReset={handleResetPhase}
                                            disabled={sessionFinished}
                                        />
                                    </div>
                                ) : !sessionFinished && (
                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-sm font-medium text-blue-900">Cette phase n'est pas active</p>
                                                <p className="text-xs text-blue-700 mt-1">
                                                    Phase active actuelle: {session.currentPhase === 'practice' ? 'Essais libres' : session.currentPhase === 'qualifying' ? 'Qualifications' : 'Course'}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => handlePhaseChange(activePhaseTab)}
                                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all font-medium flex items-center gap-2"
                                            >
                                                <ArrowPathIcon className="w-4 h-4" />
                                                Activer cette phase
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Info de la phase */}
                                <div className="flex items-center justify-between mb-6">
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-900">
                                            {activePhaseTab === 'practice' && 'Essais libres'}
                                            {activePhaseTab === 'qualifying' && 'Qualifications'}
                                            {activePhaseTab === 'race' && 'Course'}
                                        </h3>
                                        <p className="text-sm text-gray-600">
                                            {activePhaseTab === 'practice' && 'Classement par meilleur temps au tour'}
                                            {activePhaseTab === 'qualifying' && 'Classement par meilleur temps'}
                                            {activePhaseTab === 'race' && 'Classement par nombre de tours puis meilleur temps'}
                                        </p>
                                    </div>
                                    {session?.currentPhase === activePhaseTab && (
                                        <span className="px-4 py-2 bg-green-100 text-green-700 font-semibold rounded-lg flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    Phase active
                  </span>
                                    )}
                                </div>

                                {/* Leaderboard */}
                                <div className="space-y-4">
                                    {phaseLeaderboards[activePhaseTab]?.length > 0 ? (
                                        phaseLeaderboards[activePhaseTab].map((entry, idx) => (
                                            <div
                                                key={entry.driver?.id || idx}
                                                className={`flex items-center justify-between p-4 rounded-lg transition-all duration-500 ease-in-out transform hover:scale-[1.02] ${
                                                    idx === 0 ? 'bg-gradient-to-r from-yellow-50 to-yellow-100 border-2 border-yellow-300 animate-pulse-slow' :
                                                        idx === 1 ? 'bg-gradient-to-r from-gray-50 to-gray-100 border-2 border-gray-300' :
                                                            idx === 2 ? 'bg-gradient-to-r from-orange-50 to-orange-100 border-2 border-orange-300' :
                                                                'bg-gray-50 hover:bg-gray-100'
                                                }`}
                                                style={{
                                                    animation: 'fadeInSlide 0.5s ease-out'
                                                }}
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className={`text-3xl font-bold ${
                                                        idx === 0 ? 'text-yellow-600' :
                                                            idx === 1 ? 'text-gray-600' :
                                                                idx === 2 ? 'text-orange-600' :
                                                                    'text-gray-900'
                                                    }`}>
                                                        #{entry.position || idx + 1}
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        {entry.driver?.photo ? (
                                                            <img
                                                                src={entry.driver.photo}
                                                                alt={entry.driver.name}
                                                                className="w-12 h-12 rounded-full object-cover"
                                                            />
                                                        ) : (
                                                            <div
                                                                className="w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-bold"
                                                                style={{ backgroundColor: entry.driver?.color || sessionColor }}
                                                            >
                                                                {entry.driver?.name?.charAt(0)}
                                                            </div>
                                                        )}
                                                        <div>
                                                            <p className="font-bold text-gray-900">{entry.driver?.name}</p>
                                                            <p className="text-sm text-gray-600">
                                                                {entry.car?.brand} {entry.car?.model}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-semibold text-gray-900">{entry.laps || 0} tours</p>
                                                    {entry.bestLap && (
                                                        <p className="text-sm text-gray-600">
                                                            Meilleur : {(entry.bestLap / 1000).toFixed(3)}s
                                                        </p>
                                                    )}
                                                    {entry.lastLap && (
                                                        <p className="text-xs text-gray-500">
                                                            Dernier : {(entry.lastLap / 1000).toFixed(3)}s
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center py-12 text-gray-500">
                                            <FlagIcon className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                                            <p className="font-medium">Aucune donnée pour cette phase</p>
                                            <p className="text-sm mt-2">
                                                {session?.currentPhase === activePhaseTab
                                                    ? 'Les tours seront affichés ici une fois la session démarrée'
                                                    : 'Changez de phase pour enregistrer des tours'}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Edit Form Modal */}
                {showEditForm && (
                    <SessionForm
                        session={session}
                        onClose={() => setShowEditForm(false)}
                        onSaved={() => {
                            setShowEditForm(false)
                            loadSession()
                        }}
                    />
                )}
            </div>
        </>
    )
}

function getSessionTypeLabel (type) {
    switch (type) {
    case 'practice':
        return 'Essais libres'
    case 'qualifying':
        return 'Qualifications'
    case 'race':
        return 'Course'
    default:
        return type
    }
}

function getStatusLabel (status) {
    switch (status) {
    case 'setup':
        return 'En préparation'
    case 'running':
        return 'En cours'
    case 'paused':
        return 'En pause'
    case 'finished':
        return 'Terminée'
    default:
        return status
    }
}
