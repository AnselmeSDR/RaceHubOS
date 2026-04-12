import { useState, useEffect, useCallback } from 'react'
import { ChevronRight, Trophy, Clock, CheckCircle2, Circle, Loader2 } from 'lucide-react'
import { useSession } from '../../context/SessionContext'

const API_URL = import.meta.env.VITE_API_URL || ''

const STATUS_STYLES = {
  draft: { bg: 'bg-muted', text: 'text-muted-foreground', label: 'En attente', icon: Circle },
  active: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-600 dark:text-yellow-400', label: 'En cours', icon: Loader2 },
  paused: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-600 dark:text-yellow-400', label: 'En pause', icon: Clock },
  finishing: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-600 dark:text-orange-400', label: 'Finition', icon: Clock },
  finished: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-600 dark:text-green-400', label: 'Terminé', icon: CheckCircle2 },
}

function formatTime(ms) {
  if (!ms) return '-'
  const totalMs = Math.round(ms)
  const mins = Math.floor(totalMs / 60000)
  const secs = Math.floor((totalMs % 60000) / 1000)
  const millis = totalMs % 1000
  if (mins > 0) return `${mins}:${String(secs).padStart(2, '0')}.${String(millis).padStart(3, '0')}`
  return `${secs}.${String(millis).padStart(3, '0')}`
}

function BracketCard({ label, name, status, drivers, type, showTimes = false }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.draft
  const StatusIcon = s.icon
  const borderColor = type === 'qualif'
    ? 'border-blue-200 dark:border-blue-800'
    : 'border-green-200 dark:border-green-800'
  const bgColor = type === 'qualif'
    ? 'bg-blue-50/50 dark:bg-blue-950/20'
    : 'bg-green-50/50 dark:bg-green-950/20'

  return (
    <div className={`border ${borderColor} rounded-lg p-3 ${bgColor}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold text-sm">{label}</span>
        <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${s.bg} ${s.text}`}>
          <StatusIcon className={`w-3 h-3 ${status === 'active' ? 'animate-spin' : ''}`} />
          {s.label}
        </span>
      </div>
      {name && <p className="text-xs text-muted-foreground mb-2">{name}</p>}
      {drivers?.length > 0 ? (
        <div className="space-y-1">
          {drivers.map((sd, i) => (
            <div key={sd.id || i} className="flex items-center gap-2 text-xs">
              {sd.gridPos && (
                <span className="w-4 text-right text-muted-foreground">{sd.gridPos}.</span>
              )}
              {sd.driver?.img && (
                <img src={`${API_URL}${sd.driver.img}`} className="w-4 h-4 rounded-full object-cover" alt="" />
              )}
              <span className="flex-1 truncate">{sd.driver?.name || '?'}</span>
              {showTimes && sd.bestLapTime && (
                <span className="text-muted-foreground tabular-nums">{formatTime(sd.bestLapTime)}</span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground italic">En attente des qualifications...</p>
      )}
    </div>
  )
}

export default function ChampionshipBracket({ championshipId, onSessionSelect }) {
  const [bracket, setBracket] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchBracket = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/championships/${championshipId}/bracket`)
      const data = await res.json()
      if (data.success) setBracket(data.data)
    } catch (err) {
      console.error('Failed to fetch bracket:', err)
    } finally {
      setLoading(false)
    }
  }, [championshipId])

  useEffect(() => {
    fetchBracket()
  }, [fetchBracket])

  // Listen for updates
  useEffect(() => {
    const handleUpdate = () => fetchBracket()
    window.addEventListener('session:finished', handleUpdate)
    window.addEventListener('championship:races_assigned', handleUpdate)
    window.addEventListener('session:status_changed', handleUpdate)
    return () => {
      window.removeEventListener('session:finished', handleUpdate)
      window.removeEventListener('championship:races_assigned', handleUpdate)
      window.removeEventListener('session:status_changed', handleUpdate)
    }
  }, [fetchBracket])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Chargement...
      </div>
    )
  }

  if (!bracket) return null

  const { qualifGroups, mergedRanking, raceGroups, allQualifsFinished } = bracket

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>{bracket.participants?.length} participants</span>
        <span>&middot;</span>
        <span>{qualifGroups.length} qualif{qualifGroups.length > 1 ? 's' : ''}</span>
        <span>&middot;</span>
        <span>{raceGroups.length} course{raceGroups.length > 1 ? 's' : ''}</span>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-start">
        {/* Qualif column */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-blue-600 dark:text-blue-400">Qualifications</h3>
          {qualifGroups.map((g) => (
            <button
              key={g.sessionId}
              className="w-full text-left"
              onClick={() => onSessionSelect?.(g.sessionId)}
            >
              <BracketCard
                label={g.label}
                name={g.name}
                status={g.status}
                drivers={g.drivers}
                type="qualif"
                showTimes={g.status === 'finished'}
              />
            </button>
          ))}
        </div>

        {/* Center: merged ranking */}
        <div className="flex flex-col items-center justify-center min-h-[200px] px-2">
          {allQualifsFinished ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-center text-muted-foreground mb-2">Classement Qualif</p>
              <div className="border border-border rounded-lg p-2 bg-card space-y-1 min-w-[140px]">
                {mergedRanking.map((entry) => (
                  <div key={entry.driverId} className="flex items-center gap-2 text-xs">
                    <span className={`w-4 text-right font-medium ${
                      entry.position <= 3 ? 'text-yellow-600 dark:text-yellow-400' : 'text-muted-foreground'
                    }`}>
                      {entry.position}
                    </span>
                    {entry.driver?.img && (
                      <img src={`${API_URL}${entry.driver.img}`} className="w-4 h-4 rounded-full object-cover" alt="" />
                    )}
                    <span className="flex-1 truncate">{entry.driver?.name || '?'}</span>
                    <span className="text-muted-foreground tabular-nums">{formatTime(entry.bestTime)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center space-y-2">
              <ChevronRight className="w-6 h-6 text-muted-foreground mx-auto" />
              <p className="text-xs text-muted-foreground">Classement après<br/>toutes les qualifs</p>
            </div>
          )}
        </div>

        {/* Race column */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-green-600 dark:text-green-400">Courses</h3>
          {raceGroups.map((g) => (
            <button
              key={g.sessionId}
              className="w-full text-left"
              onClick={() => onSessionSelect?.(g.sessionId)}
            >
              <BracketCard
                label={g.label}
                name={g.name}
                status={g.status}
                drivers={g.drivers}
                type="race"
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
