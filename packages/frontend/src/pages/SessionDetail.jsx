import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import io from 'socket.io-client'
import {
  ArrowLeftIcon,
  PlayIcon,
  PauseIcon,
  StopIcon,
  CogIcon,
  TrashIcon,
  FlagIcon,
  UsersIcon,
  ClockIcon,
  TrophyIcon,
  MapPinIcon,
  ChartBarIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  BoltIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline'
import {
  ClockIcon as ClockSolidIcon,
} from '@heroicons/react/24/solid'
import ErrorMessage from '../components/ErrorMessage'
import SessionForm from '../components/SessionForm'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3000'

export default function SessionDetail() {
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

    return () => {
      newSocket.disconnect()
    }
  }, [id])

  // Chronomètre
  useEffect(() => {
    let interval
    if (session?.status === 'running' && session?.startedAt) {
      interval = setInterval(() => {
        const start = new Date(session.startedAt).getTime()
        const now = new Date().getTime()
        setElapsedTime(Math.floor((now - start) / 1000))
      }, 1000)
    } else if (session?.status === 'finished' && session?.startedAt && session?.finishedAt) {
      const start = new Date(session.startedAt).getTime()
      const end = new Date(session.finishedAt).getTime()
      setElapsedTime(Math.floor((end - start) / 1000))
    } else if (session?.status === 'paused' && session?.startedAt) {
      const start = new Date(session.startedAt).getTime()
      const now = new Date().getTime()
      setElapsedTime(Math.floor((now - start) / 1000))
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [session?.status, session?.startedAt, session?.finishedAt])

  async function loadSession() {
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

  async function loadAllLeaderboards() {
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

  async function handleSessionControl(action, newStatus) {
    try {
      // Mettre à jour le statut de la session
      const res = await fetch(`${API_URL}/sessions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          ...(action === 'start' && { startedAt: new Date().toISOString() }),
          ...(action === 'stop' && { finishedAt: new Date().toISOString() })
        })
      })

      if (res.ok) {
        // Si c'est le démarrage, définir comme session active
        if (action === 'start') {
          await fetch(`${API_URL}/active-session/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: id })
          })
        }

        loadSession()
      }
    } catch (err) {
      console.error(`Error ${action} session:`, err)
      setError(`Erreur lors de ${action === 'start' ? 'démarrage' : action === 'pause' ? 'la pause' : "l'arrêt"} de la session`)
    }
  }

  async function handleReset() {
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

  async function handlePhaseChange(newPhase) {
    try {
      // Mise à jour optimiste du state pour un feedback immédiat
      setSession(prev => ({ ...prev, currentPhase: newPhase }))
      setActivePhaseTab(newPhase)

      const res = await fetch(`${API_URL}/sessions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPhase: newPhase
        })
      })

      if (!res.ok) {
        // Recharger la session en cas d'erreur pour revenir à l'état correct
        loadSession()
        setError('Erreur lors du changement de phase')
      }
    } catch (err) {
      console.error('Error changing phase:', err)
      loadSession() // Recharger en cas d'erreur
      setError('Erreur lors du changement de phase')
    }
  }

  async function handleDelete() {
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

  const sessionColor = session.track?.color || '#6366f1'
  const isRunning = session.status === 'running'
  const isPaused = session.status === 'paused'
  const isFinished = session.status === 'finished'
  const canStart = session.status === 'setup' || session.status === 'paused'

  // Formater le temps en HH:MM:SS
  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // Calculer le temps restant si durée définie
  const remainingTime = session?.duration ? (session.duration * 60) - elapsedTime : null

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Hero */}
      <div
        className="relative h-72 bg-gradient-to-r from-indigo-600 to-purple-600"
        style={{
          background: `linear-gradient(135deg, ${sessionColor} 0%, ${sessionColor}dd 100%)`
        }}
      >
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 35px, rgba(255,255,255,.05) 35px, rgba(255,255,255,.05) 70px)`
          }}></div>
        </div>

        {/* Navigation */}
        <div className="absolute top-6 left-6">
          <button
            onClick={() => navigate('/sessions')}
            className="flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm rounded-lg text-white hover:bg-white/30 transition-all"
          >
            <ArrowLeftIcon className="w-5 h-5" />
            Retour
          </button>
        </div>

        {/* Session Info */}
        <div className="absolute bottom-16 left-0 right-0 top-16 p-8">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-end justify-between">
              <div className="text-white">
                <div className="flex items-center gap-3 mb-2">
                  <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                    session.type === 'race' ? 'bg-green-500/30 border border-green-400' :
                    session.type === 'qualifying' ? 'bg-purple-500/30 border border-purple-400' :
                    'bg-blue-500/30 border border-blue-400'
                  }`}>
                    {getSessionTypeLabel(session.type)}
                  </span>
                  <span className={`px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-2 ${
                    isRunning ? 'bg-green-500/30 border border-green-400' :
                    isPaused ? 'bg-yellow-500/30 border border-yellow-400' :
                    isFinished ? 'bg-blue-500/30 border border-blue-400' :
                    'bg-gray-500/30 border border-gray-400'
                  }`}>
                    {isRunning && <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />}
                    {getStatusLabel(session.status)}
                  </span>
                </div>
                <h1 className="text-4xl font-bold mb-2">
                  {session.name || `Session #${session.id.slice(0, 8)}`}
                </h1>
                <div className="flex items-center gap-6 text-white/90">
                  <span className="flex items-center gap-2">
                    <MapPinIcon className="w-5 h-5" />
                    {session.track?.name || 'Circuit non défini'}
                  </span>
                  {session.championship && (
                    <span className="flex items-center gap-2">
                      <TrophyIcon className="w-5 h-5 text-yellow-400" />
                      {session.championship.name}
                    </span>
                  )}

                  {/* Chronomètre */}
                  <span className="flex items-center gap-3 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20">
                    <ClockIcon className="w-5 h-5" />
                    <span className="font-mono text-2xl font-bold">
                      {formatTime(elapsedTime)}
                    </span>
                    {session.duration && remainingTime !== null && (
                      <span className="text-sm opacity-75">
                        / {session.duration}min
                      </span>
                    )}
                  </span>

                  {/* Sélecteur de phase */}
                  <div className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20">
                    <span className="text-sm font-medium opacity-90">Phase:</span>
                    <select
                      value={session.currentPhase || 'practice'}
                      onChange={(e) => handlePhaseChange(e.target.value)}
                      className="bg-white text-gray-900 border-2 border-gray-300 rounded-md px-3 py-1.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                      disabled={isFinished}
                    >
                      <option value="practice">🏁 Essais libres</option>
                      <option value="qualifying">⏱️ Qualifications</option>
                      <option value="race">🏆 Course</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Control Buttons */}
              <div className="flex items-center gap-3">
                {canStart && (
                  <button
                    onClick={() => handleSessionControl('start', 'running')}
                    className="p-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all shadow-lg"
                    title={session.status === 'paused' ? 'Reprendre' : 'Démarrer'}
                  >
                    <PlayIcon className="w-6 h-6" />
                  </button>
                )}

                {isRunning && (
                  <>
                    <button
                      onClick={() => handleSessionControl('pause', 'paused')}
                      className="p-3 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-all shadow-lg"
                      title="Pause"
                    >
                      <PauseIcon className="w-6 h-6" />
                    </button>
                    <button
                      onClick={() => handleSessionControl('stop', 'finished')}
                      className="p-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all shadow-lg"
                      title="Terminer"
                    >
                      <StopIcon className="w-6 h-6" />
                    </button>
                  </>
                )}

                {(isPaused || isFinished) && (
                  <button
                    onClick={handleReset}
                    className="p-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all shadow-lg"
                    title="Redémarrer la session"
                  >
                    <ArrowPathIcon className="w-6 h-6" />
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <UsersIcon className="w-8 h-8 text-indigo-500" />
              <span className="text-3xl font-bold text-gray-900">{session.drivers?.length || 0}</span>
            </div>
            <p className="text-gray-600 font-medium">Pilotes</p>
            <p className="text-sm text-gray-500">En compétition</p>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <FlagIcon className="w-8 h-8 text-green-500" />
              <span className="text-3xl font-bold text-gray-900">{session._count?.laps || 0}</span>
            </div>
            <p className="text-gray-600 font-medium">Tours</p>
            <p className="text-sm text-gray-500">Complétés</p>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <ClockIcon className="w-8 h-8 text-purple-500" />
              <span className="text-3xl font-bold text-gray-900">
                {session.duration || session.maxLaps || '∞'}
              </span>
            </div>
            <p className="text-gray-600 font-medium">{session.duration ? 'Durée' : 'Tours max'}</p>
            <p className="text-sm text-gray-500">{session.duration ? 'Minutes' : 'Tours'}</p>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <BoltIcon className="w-8 h-8 text-yellow-500" />
              <span className="text-3xl font-bold text-gray-900">{session.fuelMode}</span>
            </div>
            <p className="text-gray-600 font-medium">Carburant</p>
            <p className="text-sm text-gray-500">Mode {session.fuelMode}</p>
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
                      key={idx}
                      className={`flex items-center justify-between p-4 rounded-lg transition-all ${
                        idx === 0 ? 'bg-gradient-to-r from-yellow-50 to-yellow-100 border-2 border-yellow-300' :
                        idx === 1 ? 'bg-gradient-to-r from-gray-50 to-gray-100 border-2 border-gray-300' :
                        idx === 2 ? 'bg-gradient-to-r from-orange-50 to-orange-100 border-2 border-orange-300' :
                        'bg-gray-50'
                      }`}
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
  )
}

function getSessionTypeLabel(type) {
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

function getStatusLabel(status) {
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
