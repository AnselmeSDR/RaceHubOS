import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import io from 'socket.io-client'
import {
  Users,
  Car,
  Map,
  Flag,
  UserPlus,
  FlaskConical,
  ArrowRight,
  Settings,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { useDevice } from '../context/DeviceContext'
import { useSession } from '../context/SessionContext'
import { useTheme } from '../context/ThemeContext'

const API_URL = import.meta.env.VITE_API_URL || '/api'
const WS_URL = import.meta.env.VITE_WS_URL || ''

export default function Dashboard() {
  const navigate = useNavigate()
  const { connected: cuConnected, socketConnected } = useDevice()
  const { session, isActive: isSessionActive } = useSession()
  const { isAdmin } = useTheme()

  const [stats, setStats] = useState({
    drivers: 0,
    cars: 0,
    tracks: 0,
    sessions: 0,
    loading: true,
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
        driversRes.ok ? driversRes.json() : { count: 0 },
        carsRes.ok ? carsRes.json() : { count: 0 },
        tracksRes.ok ? tracksRes.json() : { count: 0 },
        sessionsRes.ok ? sessionsRes.json() : { count: 0 },
      ])

      setStats({
        drivers: driversData.count || 0,
        cars: carsData.count || 0,
        tracks: tracksData.count || 0,
        sessions: sessionsData.count || 0,
        loading: false,
      })

      if (driversData.count === 0 || carsData.count === 0 || tracksData.count === 0) {
        setShowConfigWarning(true)
      }
    } catch {
      setStats((prev) => ({ ...prev, loading: false }))
    }
  }

  useEffect(() => {
    loadStats()

    const socket = io(WS_URL)
    socket.on('race:status', () => {})
    return () => socket.disconnect()
  }, [])

  const statCards = [
    { to: '/drivers', icon: Users, label: 'Pilotes', sub: 'Pilotes enregistrés', value: stats.drivers, color: 'text-blue-500' },
    { to: '/cars', icon: Car, label: 'Voitures', sub: 'Voitures disponibles', value: stats.cars, color: 'text-green-500' },
    { to: '/tracks', icon: Map, label: 'Circuits', sub: 'Circuits configurés', value: stats.tracks, color: 'text-purple-500' },
    { to: '/sessions', icon: Flag, label: 'Sessions', sub: 'Sessions de course', value: stats.sessions, color: 'text-red-500' },
  ]

  const quickActions = [
    { to: '/race', icon: Flag, label: 'Mode Course', color: 'text-green-500', bg: 'bg-green-500/10' },
    { to: '/drivers', icon: UserPlus, label: 'Ajouter un pilote', color: 'text-blue-500', bg: 'bg-muted' },
    ...(isAdmin ? [{ to: '/simulator', icon: FlaskConical, label: 'Ouvrir le simulateur', color: 'text-purple-500', bg: 'bg-muted' }] : []),
    { to: '/settings', icon: Settings, label: 'Paramètres', color: 'text-muted-foreground', bg: 'bg-muted' },
  ]

  const systemStatus = [
    { label: 'Backend API', connected: true, text: 'Connecté' },
    { label: 'WebSocket', connected: socketConnected, text: socketConnected ? 'Connecté' : 'Déconnecté' },
    { label: 'Control Unit', connected: cuConnected, text: cuConnected ? 'Connecté' : 'Non connecté' },
    { label: 'Base de données', connected: true, text: 'SQLite' },
  ]

  return (
    <div className="p-4 space-y-4">
      {/* Configuration Warning */}
      {showConfigWarning && (
        <Card className="border-yellow-500/50 bg-yellow-500/10">
          <CardContent className="">
            <h3 className="font-semibold text-yellow-600 dark:text-yellow-400">Configuration requise</h3>
            <p className="text-sm text-yellow-600/80 dark:text-yellow-400/80 mt-1">Configuration incomplète détectée.</p>
            <div className="mt-2 space-y-1">
              {stats.drivers === 0 && <Link to="/drivers" className="text-sm text-yellow-600 dark:text-yellow-400 hover:underline block">→ Ajouter des pilotes</Link>}
              {stats.cars === 0 && <Link to="/cars" className="text-sm text-yellow-600 dark:text-yellow-400 hover:underline block">→ Ajouter des voitures</Link>}
              {stats.tracks === 0 && <Link to="/tracks" className="text-sm text-yellow-600 dark:text-yellow-400 hover:underline block">→ Ajouter des circuits</Link>}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Session Banner */}
      {isSessionActive && (
        <div
          className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-5 text-white cursor-pointer hover:shadow-xl transition-all"
          onClick={() => navigate('/race')}
        >
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold mb-1">Session en cours</h2>
              <span className="px-3 py-1 rounded-full text-sm font-semibold bg-white/20">
                {session?.status || 'Active'}
              </span>
            </div>
            <span className="text-white/70">Cliquez pour accéder →</span>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <Link key={s.to} to={s.to}>
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="">
                <div className="flex items-center justify-between mb-3">
                  <s.icon className={`size-8 ${s.color}`} />
                  <span className="text-2xl font-bold">{s.value}</span>
                </div>
                <p className="font-semibold text-sm">{s.label}</p>
                <p className="text-xs text-muted-foreground">{s.sub}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Quick Actions & System Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="">
            <h2 className="font-semibold mb-3">Actions rapides</h2>
            <div className="space-y-2">
              {quickActions.map((a) => (
                <Link
                  key={a.to}
                  to={a.to}
                  className={`flex items-center justify-between p-3 ${a.bg} rounded-lg hover:opacity-80 transition-opacity`}
                >
                  <div className="flex items-center gap-3">
                    <a.icon className={`size-4 ${a.color}`} />
                    <span className="font-medium text-sm">{a.label}</span>
                  </div>
                  <ArrowRight className="size-4 text-muted-foreground" />
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="">
            <h2 className="font-semibold mb-3">État du système</h2>
            <div className="space-y-3">
              {systemStatus.map((s) => (
                <div key={s.label} className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{s.label}</span>
                  <span className="flex items-center gap-2">
                    <div className={`size-2 rounded-full ${s.connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                    <span className={`text-xs font-medium ${s.connected ? 'text-green-500' : 'text-red-500'}`}>
                      {s.text}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
