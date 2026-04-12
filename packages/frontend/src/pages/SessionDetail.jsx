import { useEffect, useState, useMemo } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { ArrowLeft, Flag, MapPin, Trash2, Trophy, Users2, Clock, Timer, Pause, Scale } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import SessionLeaderboard from '../components/race/SessionLeaderboard'
import BalancingChart from '../components/balancing/BalancingChart'
import Podium from '../components/race/Podium'
import LapTime from '../components/race/LapTime'
import { getImgUrl } from '../utils/image'

const API_URL = import.meta.env.VITE_API_URL || ''

const TYPE_LABELS = {
  practice: 'Essais Libres',
  qualif: 'Qualifications',
  race: 'Course',
  balancing: 'Équilibrage',
}

const STATUS_LABELS = {
  draft: 'Brouillon',
  active: 'Active',
  paused: 'En pause',
  finishing: 'Drapeau',
  finished: 'Terminée',
}

function formatDuration(ms) {
  if (!ms || ms <= 0) return '--'
  const totalSec = Math.floor(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  if (min === 0) return `${sec}s`
  return `${min}m${sec > 0 ? ` ${sec}s` : ''}`
}

function formatDate(date) {
  return new Date(date).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function SessionDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${API_URL}/api/sessions/${id}`)
        const data = await res.json()
        if (data.success) setSession(data.data)
      } catch (err) {
        console.error('Error loading session:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  // Build entries from session.drivers (same format as SessionContext entries)
  const entries = useMemo(() => {
    if (!session?.drivers?.length) return []

    const drivers = session.drivers
    const allBestLaps = drivers.map(d => d.bestLapTime).filter(t => t && t > 0)
    const fastestLapTime = allBestLaps.length > 0 ? Math.min(...allBestLaps) : null

    // Sort
    const isRace = session.type === 'race'
    const sorted = [...drivers].sort((a, b) => {
      if (isRace) {
        if ((b.totalLaps || 0) !== (a.totalLaps || 0)) return (b.totalLaps || 0) - (a.totalLaps || 0)
        return (a.totalTime || Infinity) - (b.totalTime || Infinity)
      }
      if (!a.bestLapTime && !b.bestLapTime) return 0
      if (!a.bestLapTime) return 1
      if (!b.bestLapTime) return -1
      return a.bestLapTime - b.bestLapTime
    })

    const leader = sorted[0]

    return sorted.map((sd, i) => {
      let gap = null
      if (i > 0 && leader) {
        if (isRace) {
          const lapDiff = (leader.totalLaps || 0) - (sd.totalLaps || 0)
          if (lapDiff > 0) gap = { type: 'laps', value: lapDiff }
          else gap = { type: 'time', value: (sd.totalTime || 0) - (leader.totalTime || 0) }
        } else {
          if (leader.bestLapTime && sd.bestLapTime) gap = { type: 'time', value: sd.bestLapTime - leader.bestLapTime }
        }
      }

      return {
        id: sd.id,
        controller: sd.controller,
        driver: sd.driver,
        car: sd.car,
        gridPos: sd.gridPos ?? null,
        stats: {
          laps: sd.totalLaps || 0,
          bestLap: sd.bestLapTime || null,
          lastLap: sd.lastLapTime || null,
          totalTime: sd.totalTime || 0,
          gap,
        },
        position: i + 1,
        positionDelta: 0,
        hasFastestLap: fastestLapTime && sd.bestLapTime === fastestLapTime,
        isDNF: sd.isDNF || false,
      }
    })
  }, [session])

  // Build entries for balancing chart (needs laps array per controller)
  const balancingEntries = useMemo(() => {
    if (!session || session.type !== 'balancing' || !session.laps?.length) return []

    // Group laps by controller
    const lapsByCtrl = new Map()
    for (const lap of session.laps) {
      if (!lapsByCtrl.has(lap.controller)) lapsByCtrl.set(lap.controller, [])
      lapsByCtrl.get(lap.controller).push({ lapNumber: lap.lapNumber, lapTime: Math.round(lap.lapTime) })
    }

    return (session.drivers || []).map(sd => ({
      id: sd.id,
      controller: sd.controller,
      driver: sd.driver,
      car: sd.car,
      laps: (lapsByCtrl.get(sd.controller) || []).sort((a, b) => a.lapNumber - b.lapNumber),
      stats: { laps: sd.totalLaps || 0, bestLap: sd.bestLapTime || null },
    }))
  }, [session])

  // Session duration
  const sessionDuration = useMemo(() => {
    if (!session?.startedAt || !session?.finishedAt) return null
    const start = new Date(session.startedAt).getTime()
    const end = new Date(session.finishedAt).getTime()
    return end - start
  }, [session])

  // Total pause duration
  const totalPauseDuration = useMemo(() => {
    if (!session?.pauses) return 0
    const pauses = typeof session.pauses === 'string' ? JSON.parse(session.pauses) : session.pauses
    return pauses.reduce((sum, p) => sum + (p.end ? p.end - p.start : 0), 0)
  }, [session])

  // Total laps
  const totalLaps = useMemo(() => {
    return (session?.drivers || []).reduce((sum, d) => sum + (d.totalLaps || 0), 0)
  }, [session])

  // Fastest lap
  const fastestLap = useMemo(() => {
    const times = (session?.drivers || []).map(d => d.bestLapTime).filter(t => t && t > 0)
    return times.length > 0 ? Math.min(...times) : null
  }, [session])

  const fastestDriver = useMemo(() => {
    if (!fastestLap || !session?.drivers) return null
    const sd = session.drivers.find(d => d.bestLapTime === fastestLap)
    return sd?.driver
  }, [fastestLap, session])

  async function handleDelete() {
    if (!confirm('Supprimer cette session ?')) return
    try {
      const res = await fetch(`${API_URL}/api/sessions/${id}`, { method: 'DELETE' })
      if (res.ok) navigate('/history')
    } catch (err) {
      console.error('Error deleting session:', err)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full size-10 border-b-2 border-primary" />
      </div>
    )
  }

  if (!session) {
    return (
      <div className="p-8">
        <Button variant="ghost" onClick={() => navigate('/history')}>
          <ArrowLeft className="size-4" /> Retour
        </Button>
        <p className="text-center text-muted-foreground mt-8">Session introuvable</p>
      </div>
    )
  }

  const isBalancing = session.type === 'balancing'
  const TypeIcon = isBalancing ? Scale : session.type === 'race' ? Flag : Clock

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/history')}>
            <ArrowLeft className="size-4" />
          </Button>
          <TypeIcon className="size-5 text-muted-foreground" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-lg">{session.name || `Session #${session.id.slice(0, 8)}`}</h1>
              <Badge variant="outline">{TYPE_LABELS[session.type] || session.type}</Badge>
              <Badge variant={session.status === 'finished' ? 'default' : 'secondary'}>
                {STATUS_LABELS[session.status] || session.status}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground flex items-center gap-2">
              {session.track && (
                <Link to={`/tracks/${session.track.id}`} className="hover:underline flex items-center gap-1">
                  <MapPin className="size-3" />
                  {session.track.name}
                </Link>
              )}
              {session.championship && (
                <Link to={`/championships/${session.championship.id}`} className="hover:underline flex items-center gap-1">
                  <Trophy className="size-3" />
                  {session.championship.name}
                </Link>
              )}
              <span>· {formatDate(session.createdAt)}</span>
            </div>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={handleDelete} className="text-destructive hover:text-destructive">
          <Trash2 className="size-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Podium (finished sessions, not balancing) */}
        {session.status === 'finished' && !isBalancing && session.drivers?.length > 0 && (
          <Card>
            <CardContent className="p-0 overflow-hidden">
              <Podium
                drivers={session.drivers}
                sessionType={session.type}
                stats={{
                  duration: sessionDuration ? Math.floor(sessionDuration / 1000) : null,
                  maxDuration: session.maxDuration,
                  maxLaps: session.maxLaps,
                  gracePeriod: session.gracePeriod,
                  gracePeriodUsed: !!session.finishingAt,
                }}
              />
            </CardContent>
          </Card>
        )}

        {/* DNF drivers */}
        {entries.some(e => e.isDNF) && (
          <div className="flex items-center gap-2 text-sm text-orange-500">
            <Flag className="size-4" />
            DNF : {entries.filter(e => e.isDNF).map(e => e.driver?.name || `Ctrl ${e.controller + 1}`).join(', ')}
          </div>
        )}

        {/* Main content: Leaderboard or Balancing Chart */}
        {isBalancing ? (
          balancingEntries.some(e => e.laps.length > 0) ? (
            <BalancingChart entries={balancingEntries} />
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Aucune donnée de tour
              </CardContent>
            </Card>
          )
        ) : (
          entries.length > 0 ? (
            <SessionLeaderboard
              entries={entries}
              sortBy={session.type === 'race' ? 'race' : 'bestLap'}
              sessionType={session.type}
              sessionStatus={session.status}
              expanded
            />
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Aucun participant
              </CardContent>
            </Card>
          )
        )}

        {/* Lap history table */}
        {session.laps?.length > 0 && !isBalancing && (
          <Card>
            <CardContent className="p-0">
              <div className="px-4 py-3 border-b border-border">
                <h3 className="text-sm font-semibold">Historique des tours ({session.laps.length})</h3>
              </div>
              <div className="max-h-96 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card border-b border-border">
                    <tr className="text-left text-xs text-muted-foreground uppercase">
                      <th className="px-4 py-2 font-medium">Tour</th>
                      <th className="px-4 py-2 font-medium">Pilote</th>
                      <th className="px-4 py-2 font-medium">Voiture</th>
                      <th className="px-4 py-2 font-medium text-right">Temps</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {session.laps.map((lap, i) => {
                      const driver = session.drivers?.find(d => d.controller === lap.controller)
                      return (
                        <tr key={lap.id || i} className={`${lap.lapTime === fastestLap ? 'bg-purple-500/10' : ''}`}>
                          <td className="px-4 py-1.5 font-mono text-muted-foreground">{lap.lapNumber}</td>
                          <td className="px-4 py-1.5">
                            <div className="flex items-center gap-2">
                              <span
                                className="size-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                                style={{ backgroundColor: driver?.driver?.color || '#6B7280' }}
                              >
                                {(driver?.driver?.name || '?').charAt(0)}
                              </span>
                              <span className="truncate">{driver?.driver?.name || `Ctrl ${lap.controller + 1}`}</span>
                            </div>
                          </td>
                          <td className="px-4 py-1.5 text-muted-foreground truncate">
                            {driver?.car?.brand} {driver?.car?.model}
                          </td>
                          <td className="px-4 py-1.5 text-right">
                            <LapTime time={Math.round(lap.lapTime)} size="sm" highlight={lap.lapTime === fastestLap} />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
