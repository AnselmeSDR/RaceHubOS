import { useState, useEffect, useCallback } from 'react'
import { Trophy, Timer, Clock, Zap, TrendingUp, Activity, Heart, Loader2 } from 'lucide-react'
import { getImgUrl } from '../../utils/image'
import { GAP_COLORS } from '../../lib/colors'

const API_URL = import.meta.env.VITE_API_URL || ''

function formatLapTime(ms) {
  if (!ms) return '--'
  const s = ms / 1000
  return s >= 60 ? `${Math.floor(s / 60)}:${(s % 60).toFixed(3).padStart(6, '0')}` : `${s.toFixed(3)}s`
}

function formatTotalTime(ms) {
  if (!ms) return '--'
  const totalSec = ms / 1000
  const min = Math.floor(totalSec / 60)
  const sec = (totalSec % 60).toFixed(3)
  return `${min}:${sec.padStart(6, '0')}`
}

const AWARD_ICONS = {
  'best-lap': Timer,
  'best-qualif': Clock,
  'best-race-lap': Zap,
  'comeback': TrendingUp,
  'consistent': Activity,
  'iron-man': Heart,
}

// ---- Podium ----
function ResultsPodium({ podium }) {
  if (!podium || podium.length < 2) return null

  const podiumBorder = ['border-yellow-400', 'border-gray-300', 'border-orange-400']
  const podiumGlow = ['shadow-yellow-400/20', 'shadow-gray-300/20', 'shadow-orange-400/20']
  const podiumHeight = ['h-28', 'h-20', 'h-16']
  const podiumBg = ['bg-gradient-to-t from-yellow-400/20 to-transparent', 'bg-gradient-to-t from-gray-300/20 to-transparent', 'bg-gradient-to-t from-orange-400/20 to-transparent']
  const podiumLabel = ['1er', '2ème', '3ème']
  const podiumOrder = podium.length >= 3 ? [podium[1], podium[0], podium[2]] : podium
  const podiumIndexOrder = podium.length >= 3 ? [1, 0, 2] : podium.map((_, i) => i)

  return (
    <div className="flex items-end justify-center gap-6">
      {podiumOrder.map((entry, displayIdx) => {
        const realIdx = podiumIndexOrder[displayIdx]
        return (
          <div key={entry.driverId} className="flex flex-col items-center w-32">
            <div
              className="w-20 h-20 rounded-full border-3 overflow-hidden mb-2 flex items-center justify-center text-white text-xl font-bold shadow-lg"
              style={{ borderColor: realIdx === 0 ? '#facc15' : realIdx === 1 ? '#d1d5db' : '#fb923c', backgroundColor: entry.driver?.color || '#6B7280' }}
            >
              {entry.driver?.img ? (
                <img src={getImgUrl(entry.driver.img)} className="w-full h-full object-cover" alt="" />
              ) : (
                entry.driver?.name?.charAt(0) || '?'
              )}
            </div>
            <span className="text-sm font-bold mb-0.5">{entry.driver?.name}</span>
            <span className="text-[10px] text-muted-foreground mb-1">{entry.totalLaps} tours</span>
            <div className={`${podiumHeight[realIdx]} w-full ${podiumBg[realIdx]} ${podiumBorder[realIdx]} border-t-2 rounded-t-lg flex items-start justify-center pt-1.5 ${podiumGlow[realIdx]} shadow-lg`}>
              <span className="text-lg font-black text-foreground">{podiumLabel[realIdx]}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ---- Award card ----
function AwardCard({ award }) {
  const Icon = AWARD_ICONS[award.id] || Trophy

  const renderValue = () => {
    switch (award.id) {
      case 'best-lap':
      case 'best-qualif':
      case 'best-race-lap':
        return (
          <div>
            <span className={`font-mono text-lg font-bold ${GAP_COLORS.leader}`}>{formatLapTime(award.lapTime)}</span>
            <div className="text-[10px] text-muted-foreground mt-0.5">{award.sessionName}</div>
          </div>
        )
      case 'comeback':
        return (
          <div>
            <span className="font-mono text-lg font-bold text-session-race">+{award.gain} place{award.gain > 1 ? 's' : ''}</span>
            <div className="text-[10px] text-muted-foreground mt-0.5">P{award.qualifPos} → P{award.racePos}</div>
          </div>
        )
      case 'consistent':
        return (
          <div>
            <span className="font-mono text-lg font-bold text-session-qualif">σ {formatLapTime(award.stdDev)}</span>
            <div className="text-[10px] text-muted-foreground mt-0.5">{award.sessionName}</div>
          </div>
        )
      case 'iron-man':
        return (
          <div>
            <span className="font-mono text-lg font-bold text-delta-gained">{award.totalLaps} tours</span>
            <div className="text-[10px] text-muted-foreground mt-0.5">{award.finishedRaces} course{award.finishedRaces > 1 ? 's' : ''} terminée{award.finishedRaces > 1 ? 's' : ''}</div>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div className="border border-border rounded-lg p-3 bg-card hover:bg-muted/50 transition-colors">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-championship/10">
          <Icon className="size-4 text-championship" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">{award.title}</div>
          <div className="flex items-center gap-2">
            {award.driver?.img && (
              <img src={getImgUrl(award.driver.img)} className="w-6 h-6 rounded-full object-cover" alt="" />
            )}
            <span className="text-sm font-medium truncate">{award.driver?.name}</span>
          </div>
          <div className="mt-1">{renderValue()}</div>
        </div>
      </div>
    </div>
  )
}

// ---- Standings table ----
function StandingsTable({ standings }) {
  if (!standings?.length) return null

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-muted-foreground text-xs uppercase bg-muted/50">
            <th className="px-3 py-2 w-8">#</th>
            <th className="px-3 py-2">Pilote</th>
            <th className="px-3 py-2 text-center w-16">Tours</th>
            <th className="px-3 py-2 text-right w-24">Temps</th>
            <th className="px-3 py-2 text-right w-20">Écart</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {standings.map((entry) => {
            const leaderLaps = standings[0].totalLaps
            const leaderTime = standings[0].totalTime
            const lapDiff = leaderLaps - entry.totalLaps
            let gap = null
            if (entry.position > 1) {
              gap = lapDiff > 0
                ? { type: 'laps', value: lapDiff }
                : { type: 'time', value: entry.totalTime - leaderTime }
            }

            return (
              <tr key={entry.driverId} className={
                entry.position === 1 ? 'bg-gradient-to-r from-yellow-500/20 to-transparent' :
                entry.position === 2 ? 'bg-gradient-to-r from-gray-400/10 to-transparent' :
                entry.position === 3 ? 'bg-gradient-to-r from-orange-500/10 to-transparent' : ''
              }>
                <td className="px-3 py-2">
                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-black ${
                    entry.position === 1 ? 'bg-yellow-400 text-yellow-950' :
                    entry.position === 2 ? 'bg-gray-300 text-gray-800' :
                    entry.position === 3 ? 'bg-orange-400 text-orange-950' :
                    'text-muted-foreground'
                  }`}>
                    {entry.position}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    {entry.driver?.img && (
                      <img src={getImgUrl(entry.driver.img)} className="w-6 h-6 rounded-full object-cover" alt="" />
                    )}
                    <div>
                      <div className="font-medium">{entry.driver?.name}</div>
                      {entry.car && <div className="text-[10px] text-muted-foreground">{entry.car.brand} {entry.car.model}</div>}
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2 text-center font-mono font-bold">{entry.totalLaps}</td>
                <td className="px-3 py-2 text-right font-mono text-xs">{formatTotalTime(entry.totalTime)}</td>
                <td className="px-3 py-2 text-right">
                  {gap ? (
                    <span className={`font-mono text-xs font-medium ${gap.type === 'laps' ? GAP_COLORS.laps : 'text-muted-foreground'}`}>
                      {gap.type === 'laps' ? `+${gap.value} t` : `+${(gap.value / 1000).toFixed(3)}`}
                    </span>
                  ) : (
                    <span className={`text-xs font-bold ${GAP_COLORS.leader}`}>Leader</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ---- Main component ----
export default function ChampionshipResults({ championshipId }) {
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchResults = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/championships/${championshipId}/results`)
      const data = await res.json()
      if (data.success) setResults(data.data)
    } catch (err) {
      console.error('Failed to fetch results:', err)
    } finally {
      setLoading(false)
    }
  }, [championshipId])

  useEffect(() => { fetchResults() }, [fetchResults])

  useEffect(() => {
    const refresh = () => fetchResults()
    window.addEventListener('session:finished', refresh)
    return () => window.removeEventListener('session:finished', refresh)
  }, [fetchResults])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Chargement...
      </div>
    )
  }

  if (!results || (!results.standings?.length && !results.awards?.length)) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        Aucun résultat disponible. Terminez au moins une course.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Podium */}
      {results.podium?.length >= 2 && (
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase mb-4 text-center">Podium</h3>
          <ResultsPodium podium={results.podium} />
        </div>
      )}

      {/* Awards */}
      {results.awards?.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase mb-3 flex items-center gap-2">
            <Trophy className="size-4 text-championship" />
            Meilleurs moments
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {results.awards.map(award => (
              <AwardCard key={award.id} award={award} />
            ))}
          </div>
        </div>
      )}

      {/* Full standings */}
      {results.standings?.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase mb-3">Classement final</h3>
          <StandingsTable standings={results.standings} />
        </div>
      )}
    </div>
  )
}
