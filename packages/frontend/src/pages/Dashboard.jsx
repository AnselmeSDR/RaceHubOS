import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Users,
  Car,
  Map,
  Flag,
  Trophy,
  Timer,
  ArrowRight,
  Crown,
  Medal,
  Zap,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { useDevice } from '../context/DeviceContext'
import { useSession } from '../context/SessionContext'
import { getImgUrl } from '../utils/image'

const API_URL = import.meta.env.VITE_API_URL || '/api'

function formatLap(ms) {
  if (!ms) return '-'
  return `${(ms / 1000).toFixed(3)}s`
}

function formatDate(date) {
  if (!date) return ''
  return new Date(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

function DriverAvatar({ driver, size = 'size-8' }) {
  return (
    <div
      className={`${size} rounded-full flex items-center justify-center text-white font-bold overflow-hidden shrink-0 ring-2 ring-background`}
      style={{ backgroundColor: driver.color || '#3B82F6' }}
    >
      {driver.img ? (
        <img src={getImgUrl(driver.img)} alt="" className="w-full h-full object-cover" />
      ) : (
        <span className="text-xs">{driver.name?.charAt(0)}</span>
      )}
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { connected: cuConnected, socketConnected } = useDevice()
  const { session, isActive: isSessionActive } = useSession()

  const [stats, setStats] = useState({ drivers: 0, cars: 0, tracks: 0, sessions: 0, loading: true })
  const [records, setRecords] = useState(null)
  const [topDrivers, setTopDrivers] = useState([])
  const [topLaps, setTopLaps] = useState([])

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/drivers`).then(r => r.ok ? r.json() : { count: 0 }),
      fetch(`${API_URL}/cars`).then(r => r.ok ? r.json() : { count: 0 }),
      fetch(`${API_URL}/tracks`).then(r => r.ok ? r.json() : { count: 0 }),
      fetch(`${API_URL}/sessions?has_championship=true`).then(r => r.ok ? r.json() : { count: 0 }),
    ]).then(([d, c, t, s]) => {
      setStats({ drivers: d.count || d.total || 0, cars: c.count || c.total || 0, tracks: t.count || t.total || 0, sessions: s.count || s.total || 0, loading: false })
    }).catch(() => setStats(p => ({ ...p, loading: false })))

    fetch(`${API_URL}/stats/records?has_championship=true`).then(r => r.ok ? r.json() : null).then(d => {
      if (d?.success) setRecords(d.data)
    }).catch(() => {})

    fetch(`${API_URL}/stats/drivers?has_championship=true`).then(r => r.ok ? r.json() : null).then(d => {
      if (d?.success) setTopDrivers((d.data || []).slice(0, 10))
    }).catch(() => {})

    fetch(`${API_URL}/stats/laptimes?limit=10&sortBy=lapTime&sortOrder=asc&unique=true&has_championship=true`).then(r => r.ok ? r.json() : null).then(d => {
      if (d?.success) setTopLaps(d.data || [])
    }).catch(() => {})
  }, [])

  const statCards = [
    { to: '/drivers', icon: Users, label: 'Pilotes', value: stats.drivers, color: 'text-blue-500' },
    { to: '/cars', icon: Car, label: 'Voitures', value: stats.cars, color: 'text-green-500' },
    { to: '/tracks', icon: Map, label: 'Circuits', value: stats.tracks, color: 'text-purple-500' },
    { to: '/history', icon: Flag, label: 'Sessions', value: stats.sessions, color: 'text-red-500' },
  ]

  const podiumColors = ['text-yellow-500', 'text-zinc-400', 'text-amber-700']
  const podiumIcons = [Crown, Medal, Medal]

  return (
    <div className="p-4 space-y-4">
      {/* Active Session Banner */}
      {isSessionActive && (
        <div
          className="relative overflow-hidden bg-gradient-to-r from-green-600 to-emerald-500 rounded-xl p-5 text-white cursor-pointer hover:shadow-xl transition-all group"
          onClick={() => navigate('/race')}
        >
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'repeating-linear-gradient(45deg, white, white 10px, transparent 10px, transparent 20px)' }} />
          <div className="relative flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="size-12 rounded-full bg-white/20 flex items-center justify-center">
                <Flag className="size-6 animate-pulse" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Session en cours</h2>
                <span className="text-sm text-white/80">{session?.name || 'Course active'}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-white/70 group-hover:text-white transition-colors">
              <span className="text-sm">Rejoindre</span>
              <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map((s) => (
          <Link key={s.to} to={s.to}>
            <Card className="hover:ring-2 hover:ring-primary/20 transition-all">
              <CardContent>
                <div className="flex items-center justify-between">
                  <s.icon className={`size-5 ${s.color}`} />
                  <span className="text-2xl font-black tabular-nums">{stats.loading ? '-' : s.value}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Records absolus */}
      {records && (
        <Card>
          <CardContent>
            <div className="flex items-center gap-2 mb-4">
              <Zap className="size-4 text-yellow-500" />
              <h2 className="font-semibold text-sm">Records absolus</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {records.fastestLap && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Timer className="size-4 text-green-500" />
                    <div>
                      <p className="text-xs text-muted-foreground">Meilleur tour</p>
                      <p className="text-sm font-medium">{records.fastestLap.driver?.name || '?'}</p>
                    </div>
                  </div>
                  <span className="font-mono font-bold text-green-500">{formatLap(records.fastestLap.time)}</span>
                </div>
              )}
              {records.mostWins && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Trophy className="size-4 text-yellow-500" />
                    <div>
                      <p className="text-xs text-muted-foreground">Plus de victoires</p>
                      <p className="text-sm font-medium">{records.mostWins.driver?.name || '?'}</p>
                    </div>
                  </div>
                  <span className="font-mono font-bold text-yellow-500">{records.mostWins.count}</span>
                </div>
              )}
              {records.mostPodiums && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Medal className="size-4 text-orange-500" />
                    <div>
                      <p className="text-xs text-muted-foreground">Plus de podiums</p>
                      <p className="text-sm font-medium">{records.mostPodiums.driver?.name || '?'}</p>
                    </div>
                  </div>
                  <span className="font-mono font-bold text-orange-500">{records.mostPodiums.count}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Classement pilotes + Meilleurs tours */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Driver Leaderboard */}
        {topDrivers.length > 0 && (
          <Card>
            <CardContent>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Crown className="size-4 text-yellow-500" />
                  <h2 className="font-semibold text-sm">Classement pilotes</h2>
                </div>
                <Link to="/stats" className="text-xs text-muted-foreground hover:text-foreground">Voir tout →</Link>
              </div>
              <div className="space-y-2">
                {topDrivers.map((d, i) => {
                  const PodiumIcon = podiumIcons[i] || null
                  return (
                    <Link key={d.id} to={`/drivers/${d.id}`} className="flex items-center gap-3 p-1.5 -mx-1.5 rounded-lg hover:bg-muted transition-colors">
                      <span className={`w-5 text-center font-bold text-xs ${i < 3 ? podiumColors[i] : 'text-muted-foreground'}`}>
                        {PodiumIcon ? <PodiumIcon className="size-4 mx-auto" /> : i + 1}
                      </span>
                      <DriverAvatar driver={d} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{d.name}</p>
                        <p className="text-xs text-muted-foreground">{d.statistics?.wins || 0}V · {d.statistics?.podiums || 0}P</p>
                      </div>
                      {d.statistics?.bestLap && (
                        <span className="text-xs font-mono text-muted-foreground">{formatLap(d.statistics.bestLap)}</span>
                      )}
                    </Link>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Top 5 Fastest Laps */}
        {topLaps.length > 0 && (
          <Card>
            <CardContent>
              <div className="flex items-center gap-2 mb-4">
                <Timer className="size-4 text-green-500" />
                <h2 className="font-semibold text-sm">Meilleurs tours</h2>
              </div>
              <div className="space-y-2">
                {topLaps.map((lap, i) => (
                  <div key={i} className="flex items-center gap-3 p-1.5 -mx-1.5 rounded-lg">
                    <span className={`w-5 text-center font-bold text-xs ${i < 3 ? podiumColors[i] : 'text-muted-foreground'}`}>{i + 1}</span>
                    {lap.driver && <DriverAvatar driver={lap.driver} />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{lap.driver?.name || '?'}</p>
                      <p className="text-xs text-muted-foreground truncate">{lap.car?.brand} {lap.car?.model} · {lap.track?.name}</p>
                    </div>
                    <span className="font-mono font-bold text-green-500 text-xs">{formatLap(lap.lapTime)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Quick Actions + System Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent>
            <h2 className="font-semibold text-sm mb-3">Actions rapides</h2>
            <div className="space-y-1.5">
              {[
                { to: '/race', icon: Flag, label: 'Lancer une course', color: 'text-green-500' },
                { to: '/championships', icon: Trophy, label: 'Championnats', color: 'text-yellow-500' },
                { to: '/stats', icon: Timer, label: 'Statistiques', color: 'text-blue-500' },
              ].map((a) => (
                <Link key={a.to} to={a.to} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-muted transition-colors">
                  <div className="flex items-center gap-3">
                    <a.icon className={`size-4 ${a.color}`} />
                    <span className="text-sm">{a.label}</span>
                  </div>
                  <ArrowRight className="size-3.5 text-muted-foreground" />
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <h2 className="font-semibold text-sm mb-3">Système</h2>
            <div className="space-y-2.5">
              {[
                { label: 'Backend API', ok: true },
                { label: 'WebSocket', ok: socketConnected },
                { label: 'Control Unit', ok: cuConnected },
                { label: 'Base de données', ok: true, text: 'SQLite' },
              ].map((s) => (
                <div key={s.label} className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{s.label}</span>
                  <div className="flex items-center gap-1.5">
                    <div className={`size-1.5 rounded-full ${s.ok ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span className={`text-xs ${s.ok ? 'text-green-500' : 'text-red-500'}`}>
                      {s.text || (s.ok ? 'OK' : 'Off')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
