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
  CogIcon,
} from '@heroicons/react/24/outline'
import { useRace } from '../context/RaceContext'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3000'

export default function Dashboard() {
  const navigate = useNavigate()
  const { state, cuConnected, socketConnected, RACE_STATES } = useRace()

  const [stats, setStats] = useState({
    drivers: 0,
    cars: 0,
    tracks: 0,
    sessions: 0,
    loading: true,
  })

  const [circuitStatus, setCircuitStatus] = useState({
    connected: false,
    running: false,
    carCount: 0,
    isMockDevice: true
  })

  const [showConfigWarning, setShowConfigWarning] = useState(false)

  const loadStats = async () => {
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
    } catch {
      setStats((prev) => ({ ...prev, loading: false }))
    }
  }

  useEffect(() => {
    loadStats()

    // Initialize WebSocket for simulator status
    const socket = io(WS_URL)

    socket.on('race:status', (data) => {
      setCircuitStatus({
        connected: data.carCount > 0 && !data.isMockDevice,
        running: data.running || false,
        carCount: data.carCount || 0,
        isMockDevice: data.isMockDevice || false
      })
    })

    return () => {
      socket.disconnect()
    }
  }, [])

  const isSessionActive = state !== RACE_STATES.IDLE

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
            <div className="flex-1">
              <h3 className="font-semibold text-yellow-800">Configuration requise</h3>
              <p className="text-sm text-yellow-700 mt-1">
                Configuration incomplète détectée.
              </p>
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
            </div>
          </div>
        </div>
      )}

      {/* Active Session Banner */}
      {isSessionActive && (
        <div
          className="mb-8 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg p-6 text-white cursor-pointer hover:shadow-xl transition-all"
          onClick={() => navigate('/race')}
        >
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold mb-2">Session en cours</h2>
              <div className="flex items-center gap-4">
                <span className="px-3 py-1 rounded-full text-sm font-semibold bg-white/20">
                  {state}
                </span>
              </div>
            </div>
            <div className="text-white/80">
              Cliquez pour accéder →
            </div>
          </div>
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

      {/* Quick Actions & System Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Actions rapides</h2>
          <div className="space-y-3">
            <Link
              to="/race"
              className="flex items-center justify-between p-3 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <FlagIcon className="h-5 w-5 text-green-500" />
                <span className="font-medium">Mode Course</span>
              </div>
              <ArrowRightIcon className="h-4 w-4 text-gray-400" />
            </Link>
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
                <div className={`w-2 h-2 rounded-full ${socketConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                <span className={`text-sm font-medium ${socketConnected ? 'text-green-600' : 'text-red-600'}`}>
                  {socketConnected ? 'Connecté' : 'Déconnecté'}
                </span>
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Control Unit</span>
              <span className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${cuConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
                <span className={`text-sm font-medium ${cuConnected ? 'text-green-600' : 'text-gray-600'}`}>
                  {cuConnected ? 'Connecté' : 'Non connecté'}
                </span>
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Simulateur</span>
              <span className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${circuitStatus.isMockDevice && circuitStatus.carCount > 0 ? 'bg-yellow-500 animate-pulse' : 'bg-gray-400'}`}></div>
                <span className={`text-sm font-medium ${circuitStatus.isMockDevice && circuitStatus.carCount > 0 ? 'text-yellow-600' : 'text-gray-600'}`}>
                  {circuitStatus.isMockDevice && circuitStatus.carCount > 0
                    ? `Actif (${circuitStatus.carCount} voitures)`
                    : 'Inactif'}
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
    </div>
  )
}
