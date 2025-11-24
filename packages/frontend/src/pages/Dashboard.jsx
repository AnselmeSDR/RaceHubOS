import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import io from 'socket.io-client'
import {
  UserGroupIcon,
  TruckIcon,
  MapIcon,
  FlagIcon,
  UserPlusIcon,
  BeakerIcon,
  ArrowRightIcon,
  PlayIcon,
  PauseIcon,
  StopIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  CheckCircleIcon,
  XMarkIcon,
  PlusIcon,
  CogIcon,
} from '@heroicons/react/24/outline'
import SessionForm from '../components/SessionForm'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3000'

export default function Dashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState({
    drivers: 0,
    cars: 0,
    tracks: 0,
    sessions: 0,
    loading: true,
  })

  const [activeSession, setActiveSession] = useState(null)
  const [sessionLogs, setSessionLogs] = useState([])
  const [socket, setSocket] = useState(null)
  const [circuitStatus, setCircuitStatus] = useState({
    connected: false,
    running: false,
    carCount: 0,
    isMockDevice: true
  })
  const [showConfigWarning, setShowConfigWarning] = useState(false)
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [sessionToEdit, setSessionToEdit] = useState(null)

  useEffect(() => {
    loadStats()
    loadActiveSession()
    loadCircuitStatus()

    // Initialize WebSocket
    const newSocket = io(WS_URL)
    setSocket(newSocket)

    // Listen for session updates
    newSocket.on('session_update', (data) => {
      setActiveSession(data)
    })

    // Listen for session logs
    newSocket.on('session_log', (log) => {
      setSessionLogs((prev) => [...prev.slice(-49), log])
    })

    // Listen for lap times
    newSocket.on('lap_completed', (data) => {
      console.log('Lap completed:', data)
      loadActiveSession()
    })

    // Listen for circuit/simulator status
    newSocket.on('race:status', (data) => {
      console.log('Circuit status:', data)
      setCircuitStatus({
        connected: data.carCount > 0 && !data.isMockDevice,
        running: data.running || false,
        carCount: data.carCount || 0,
        isMockDevice: data.isMockDevice || false
      })
    })

    return () => {
      newSocket.disconnect()
    }
  }, [])

  async function loadStats() {
    try {
      const [driversRes, carsRes, tracksRes, sessionsRes] = await Promise.all([
        fetch(`${API_URL}/drivers`),
        fetch(`${API_URL}/cars`),
        fetch(`${API_URL}/tracks`),
        fetch(`${API_URL}/sessions`),
      ])

      const [driversData, carsData, tracksData, sessionsData] = await Promise.all([
        driversRes.json(),
        carsRes.json(),
        tracksRes.json(),
        sessionsRes.json(),
      ])

      setStats({
        drivers: driversData.count || 0,
        cars: carsData.count || 0,
        tracks: tracksData.count || 0,
        sessions: sessionsData.count || 0,
        loading: false,
      })

      // Check if configuration exists
      if (driversData.count === 0 || carsData.count === 0 || tracksData.count === 0) {
        setShowConfigWarning(true)
      }
    } catch (error) {
      console.error('Error loading stats:', error)
      setStats((prev) => ({ ...prev, loading: false }))
    }
  }

  async function loadActiveSession() {
    try {
      const response = await fetch(`${API_URL}/active-session`)
      const data = await response.json()
      if (data.success) {
        setActiveSession(data.data)
        setSessionLogs(data.logs || [])

        // Show warning if no session configured
        if (!data.data) {
          setShowConfigWarning(true)
        }
      }
    } catch (error) {
      console.error('Error loading active session:', error)
    }
  }

  async function loadCircuitStatus() {
    try {
      const response = await fetch(`${API_URL}/simulator`)
      const data = await response.json()
      setCircuitStatus({
        connected: data.cars?.length > 0 && !data.isMockDevice,
        running: data.isRunning || false,
        carCount: data.cars?.length || 0,
        isMockDevice: data.isMockDevice || false
      })
    } catch (error) {
      console.error('Error loading circuit status:', error)
    }
  }

  async function openConfigModal() {
    if (activeSession?.sessionId) {
      // Si la session active a un sessionId, charger la session complète
      try {
        const response = await fetch(`${API_URL}/sessions/${activeSession.sessionId}`)
        const data = await response.json()
        if (data.success) {
          setSessionToEdit(data.data)
        }
      } catch (error) {
        console.error('Error loading session:', error)
      }
    } else {
      // Sinon, créer une nouvelle session
      setSessionToEdit(null)
    }
    setShowConfigModal(true)
  }


  async function pauseSession() {
    try {
      const response = await fetch(`${API_URL}/active-session/pause`, {
        method: 'POST'
      })
      const data = await response.json()
      if (data.success) {
        setActiveSession(data.data)
      }
    } catch (error) {
      console.error('Error pausing session:', error)
    }
  }

  async function stopSession() {
    try {
      const response = await fetch(`${API_URL}/active-session/stop`, {
        method: 'POST'
      })
      const data = await response.json()
      if (data.success) {
        setActiveSession(data.data)
      }
    } catch (error) {
      console.error('Error stopping session:', error)
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'running': return 'text-green-600 bg-green-100'
      case 'paused': return 'text-yellow-600 bg-yellow-100'
      case 'stopped': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getStatusText = (status) => {
    switch (status) {
      case 'running': return 'En cours'
      case 'paused': return 'En pause'
      case 'stopped': return 'Arrêtée'
      case 'waiting': return 'En attente'
      default: return status
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Tableau de bord</h1>
        <p className="text-gray-600">Vue d'ensemble du système RaceHubOS</p>
      </div>

      {/* Configuration Warning */}
      {showConfigWarning && (
        <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-yellow-800">Configuration requise</h3>
              <p className="text-sm text-yellow-700 mt-1">
                {!activeSession ?
                  'Aucune session active. Le système démarre automatiquement en mode essais libres.' :
                  'Configuration incomplète détectée.'
                }
              </p>
              {stats.drivers === 0 || stats.cars === 0 || stats.tracks === 0 ? (
                <div className="mt-2 space-y-1">
                  {stats.drivers === 0 && (
                    <Link to="/drivers" className="text-sm text-yellow-700 hover:text-yellow-800 flex items-center gap-1">
                      → Ajouter des pilotes
                    </Link>
                  )}
                  {stats.cars === 0 && (
                    <Link to="/cars" className="text-sm text-yellow-700 hover:text-yellow-800 flex items-center gap-1">
                      → Ajouter des voitures
                    </Link>
                  )}
                  {stats.tracks === 0 && (
                    <Link to="/tracks" className="text-sm text-yellow-700 hover:text-yellow-800 flex items-center gap-1">
                      → Ajouter des circuits
                    </Link>
                  )}
                </div>
              ) : (
                !activeSession && (
                  <button
                    onClick={openConfigModal}
                    className="mt-2 px-3 py-1 bg-yellow-600 text-white rounded hover:bg-yellow-700 text-sm"
                  >
                    Configurer et démarrer
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* Active Session */}
      {activeSession && (
        <div
          className="mb-8 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg p-6 text-white cursor-pointer hover:shadow-xl transition-all"
          onClick={() => {
            if (activeSession.sessionId) {
              navigate(`/sessions/${activeSession.sessionId}`)
            }
          }}>
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-2xl font-bold mb-2">
                {activeSession.name || 'Session active'}
              </h2>
              <div className="flex items-center gap-4">
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(activeSession.status)}`}>
                  {getStatusText(activeSession.status)}
                </span>
                {activeSession.track && (
                  <span className="text-white/90">
                    <MapIcon className="h-4 w-4 inline mr-1" />
                    {activeSession.track.name}
                  </span>
                )}
              </div>
            </div>

            {/* Session Controls */}
            <div className="flex gap-2">
              {/* Configuration button - always visible */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  openConfigModal()
                }}
                className="p-2 bg-white/20 rounded hover:bg-white/30"
                title="Configurer"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>

              {/* Play/Pause button */}
              {(activeSession.status === 'waiting' || activeSession.status === 'stopped' || activeSession.status === 'paused') && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    pauseSession()
                  }}
                  className="p-2 bg-white/20 rounded hover:bg-white/30"
                  title={activeSession.status === 'paused' ? "Reprendre" : "Démarrer"}
                >
                  <PlayIcon className="h-5 w-5" />
                </button>
              )}
              {activeSession.status === 'running' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    pauseSession()
                  }}
                  className="p-2 bg-white/20 rounded hover:bg-white/30"
                  title="Pause"
                >
                  <PauseIcon className="h-5 w-5" />
                </button>
              )}

              {/* Stop button */}
              {(activeSession.status === 'running' || activeSession.status === 'paused') && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    stopSession()
                  }}
                  className="p-2 bg-white/20 rounded hover:bg-white/30"
                  title="Arrêter"
                >
                  <StopIcon className="h-5 w-5" />
                </button>
              )}
            </div>
          </div>

          {/* Active Drivers */}
          {activeSession.currentDrivers && Object.keys(activeSession.currentDrivers).length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
              {Object.values(activeSession.currentDrivers).map((driverData) => (
                <div key={driverData.controller} className="bg-white/10 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {driverData.driver.photo && (
                        <img
                          src={driverData.driver.photo}
                          alt={driverData.driver.name}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      )}
                      <div>
                        <div className="font-semibold">{driverData.driver.name}</div>
                        <div className="text-xs opacity-75">
                          {driverData.car.brand} {driverData.car.model}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs opacity-75">Ctrl {driverData.controller}</div>
                      <div className="text-xs font-semibold">
                        {driverData.status === 'on_track' ? '🟢 Piste' :
                         driverData.status === 'pit' ? '🟡 Stand' : '⚪ Attente'}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <div className="opacity-75">Tours</div>
                      <div className="font-semibold">{driverData.lapCount || 0}</div>
                    </div>
                    <div>
                      <div className="opacity-75">Dernier</div>
                      <div className="font-semibold">
                        {driverData.lastLap ? `${driverData.lastLap.toFixed(2)}s` : '-'}
                      </div>
                    </div>
                    <div>
                      <div className="opacity-75">Meilleur</div>
                      <div className="font-semibold">
                        {driverData.bestLap ? `${driverData.bestLap.toFixed(2)}s` : '-'}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Link to="/drivers" className="block">
          <div className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <UserGroupIcon className="h-10 w-10 text-blue-500" />
              <span className="text-3xl font-bold text-gray-800">{stats.drivers}</span>
            </div>
            <h3 className="text-gray-600 font-semibold">Pilotes</h3>
            <p className="text-sm text-gray-500 mt-1">Pilotes enregistrés</p>
          </div>
        </Link>

        <Link to="/cars" className="block">
          <div className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <TruckIcon className="h-10 w-10 text-green-500" />
              <span className="text-3xl font-bold text-gray-800">{stats.cars}</span>
            </div>
            <h3 className="text-gray-600 font-semibold">Voitures</h3>
            <p className="text-sm text-gray-500 mt-1">Voitures disponibles</p>
          </div>
        </Link>

        <Link to="/tracks" className="block">
          <div className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <MapIcon className="h-10 w-10 text-purple-500" />
              <span className="text-3xl font-bold text-gray-800">{stats.tracks}</span>
            </div>
            <h3 className="text-gray-600 font-semibold">Circuits</h3>
            <p className="text-sm text-gray-500 mt-1">Circuits configurés</p>
          </div>
        </Link>

        <Link to="/sessions" className="block">
          <div className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <FlagIcon className="h-10 w-10 text-red-500" />
              <span className="text-3xl font-bold text-gray-800">{stats.sessions}</span>
            </div>
            <h3 className="text-gray-600 font-semibold">Sessions</h3>
            <p className="text-sm text-gray-500 mt-1">Sessions de course</p>
          </div>
        </Link>
      </div>

      {/* Session Logs */}
      {sessionLogs.length > 0 && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Événements récents</h2>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {sessionLogs.slice().reverse().map((log) => (
              <div key={log.id} className="flex items-start gap-3 p-2 hover:bg-gray-50 rounded">
                <div className="flex-shrink-0 mt-1">
                  {log.type === 'lap_completed' && <CheckCircleIcon className="h-4 w-4 text-green-500" />}
                  {log.type === 'session_start' && <PlayIcon className="h-4 w-4 text-blue-500" />}
                  {log.type === 'session_stop' && <StopIcon className="h-4 w-4 text-red-500" />}
                  {log.type === 'session_pause' && <PauseIcon className="h-4 w-4 text-yellow-500" />}
                  {log.type === 'race_event' && <FlagIcon className="h-4 w-4 text-purple-500" />}
                </div>
                <div className="flex-1">
                  <div className="text-sm text-gray-700">
                    {log.type === 'lap_completed' && (
                      <span>
                        <strong>{log.data.driver}</strong> - Tour {log.data.lapNumber} : {log.data.time.toFixed(2)}s
                        {log.data.bestLap === log.data.time && ' 🏆 Meilleur tour!'}
                      </span>
                    )}
                    {log.type === 'session_start' && (
                      <span>Session démarrée : {log.data.name} sur {log.data.track}</span>
                    )}
                    {log.type === 'session_stop' && (
                      <span>Session arrêtée après {log.data.duration}s</span>
                    )}
                    {log.type === 'session_pause' && (
                      <span>Session {log.data.status === 'paused' ? 'mise en pause' : 'reprise'}</span>
                    )}
                    {log.type === 'race_event' && (
                      <span>{log.data.driver} - {log.data.type}</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(log.timestamp).toLocaleTimeString('fr-FR')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Actions rapides</h2>
          <div className="space-y-3">
            <Link
              to="/drivers"
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <UserPlusIcon className="h-5 w-5 text-blue-500" />
                <span className="font-medium">Ajouter un pilote</span>
              </div>
              <ArrowRightIcon className="h-4 w-4 text-gray-400" />
            </Link>
            <Link
              to="/sessions"
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <FlagIcon className="h-5 w-5 text-green-500" />
                <span className="font-medium">Créer une session</span>
              </div>
              <ArrowRightIcon className="h-4 w-4 text-gray-400" />
            </Link>
            <Link
              to="/simulator"
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <BeakerIcon className="h-5 w-5 text-purple-500" />
                <span className="font-medium">Ouvrir le simulateur</span>
              </div>
              <ArrowRightIcon className="h-4 w-4 text-gray-400" />
            </Link>
            <Link
              to="/settings"
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <CogIcon className="h-5 w-5 text-gray-500" />
                <span className="font-medium">Paramètres</span>
              </div>
              <ArrowRightIcon className="h-4 w-4 text-gray-400" />
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">État du système</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Backend API</span>
              <span className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-green-600 font-medium">Connecté</span>
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">WebSocket</span>
              <span className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${socket?.connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                <span className={`text-sm font-medium ${socket?.connected ? 'text-green-600' : 'text-red-600'}`}>
                  {socket?.connected ? 'Connecté' : 'Déconnecté'}
                </span>
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Circuit Carrera</span>
              <span className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${circuitStatus.connected ? 'bg-green-500 animate-pulse' : circuitStatus.isMockDevice && circuitStatus.carCount > 0 ? 'bg-yellow-500' : 'bg-gray-400'}`}></div>
                <span className={`text-sm font-medium ${circuitStatus.connected ? 'text-green-600' : circuitStatus.isMockDevice && circuitStatus.carCount > 0 ? 'text-yellow-600' : 'text-gray-600'}`}>
                  {circuitStatus.connected
                    ? `Connecté (${circuitStatus.carCount} voitures)`
                    : circuitStatus.isMockDevice && circuitStatus.carCount > 0
                    ? `Simulateur (${circuitStatus.carCount} voitures)`
                    : 'Non connecté'}
                </span>
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Base de données</span>
              <span className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-green-600 font-medium">SQLite</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Session Configuration Modal */}
      {showConfigModal && (
        <SessionForm
          session={sessionToEdit}
          onClose={() => {
            setShowConfigModal(false)
            setSessionToEdit(null)
          }}
          onSaved={async (session) => {
            setShowConfigModal(false)
            setSessionToEdit(null)
            // Si c'est une nouvelle session ou une mise à jour, la définir comme session active
            if (session?.id) {
              try {
                await fetch(`${API_URL}/active-session/start`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ sessionId: session.id })
                })
              } catch (error) {
                console.error('Error starting session:', error)
              }
            }
            loadActiveSession()
          }}
        />
      )}
    </div>
  )
}