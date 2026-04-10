import { Flag, Timer, Zap } from 'lucide-react'
import { getImgUrl } from '../../utils/image'

function formatLapTime(ms) {
  if (!ms) return '--'
  const s = ms / 1000
  return s >= 60 ? `${Math.floor(s / 60)}:${(s % 60).toFixed(3).padStart(6, '0')}` : `${s.toFixed(3)}s`
}

function formatTime(seconds) {
  if (seconds == null || seconds < 0) return '--'
  const total = Math.floor(seconds)
  const min = Math.floor(total / 60)
  const sec = total % 60
  return `${min}:${String(sec).padStart(2, '0')}`
}

/**
 * Podium - Reusable podium display for finished sessions
 *
 * @param {Array} drivers - SessionDriver array (with driver, car, totalLaps, bestLapTime, totalTime)
 * @param {string} sessionType - 'practice' | 'qualif' | 'race'
 * @param {object} stats - Optional { duration, gracePeriod, fastest } for summary bar
 */
export default function Podium({ drivers = [], sessionType = 'race', stats }) {
  const sorted = [...drivers]
    .filter(sd => sd.driver && (sd.totalLaps > 0 || sd.bestLapTime))
    .sort((a, b) => {
      if (sessionType === 'practice') {
        const lapsA = a.totalLaps || 0, lapsB = b.totalLaps || 0
        if (lapsB !== lapsA) return lapsB - lapsA
        return (a.bestLapTime || Infinity) - (b.bestLapTime || Infinity)
      }
      if (sessionType === 'qualif') return (a.bestLapTime || Infinity) - (b.bestLapTime || Infinity)
      const lapsA = a.totalLaps || 0, lapsB = b.totalLaps || 0
      if (lapsB !== lapsA) return lapsB - lapsA
      return (a.totalTime || Infinity) - (b.totalTime || Infinity)
    })

  if (sorted.length < 2) return null

  const podium = sorted.slice(0, 3)
  const fastest = sorted.reduce((best, sd) => (!best || (sd.bestLapTime && sd.bestLapTime < best.bestLapTime)) ? sd : best, null)
  const podiumBorder = ['border-yellow-400', 'border-gray-300', 'border-orange-400']
  const podiumGlow = ['shadow-yellow-400/20', 'shadow-gray-300/20', 'shadow-orange-400/20']
  const podiumHeight = ['h-44', 'h-32', 'h-28']
  const podiumBg = ['bg-gradient-to-t from-yellow-400/20 to-transparent', 'bg-gradient-to-t from-gray-300/20 to-transparent', 'bg-gradient-to-t from-orange-400/20 to-transparent']
  const podiumLabel = ['1er', '2ème', '3ème']
  const podiumOrder = podium.length >= 3 ? [podium[1], podium[0], podium[2]] : podium
  const podiumIndexOrder = podium.length >= 3 ? [1, 0, 2] : podium.map((_, i) => i)

  return (
    <div>
      {/* Podium visual */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-end justify-center gap-2">
          {podiumOrder.map((sd, visualIdx) => {
            const realIdx = podiumIndexOrder[visualIdx]
            return (
              <div key={sd.id} className="flex flex-col items-center flex-1 max-w-[140px]">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 overflow-hidden mb-2 shadow-lg ring-2 ring-offset-2 ring-offset-card"
                  style={{ '--tw-ring-color': sd.driver?.color || '#6B7280', backgroundColor: sd.driver?.color || '#6B7280' }}
                >
                  {sd.driver?.img
                    ? <img src={getImgUrl(sd.driver.img)} alt="" className="w-full h-full object-cover" />
                    : <span className="text-lg">{sd.driver?.name?.charAt(0) || '?'}</span>}
                </div>
                <span className="text-xs font-bold text-foreground truncate w-full text-center mb-1">
                  {sd.driver?.name?.split(' ').pop()}
                </span>
                <div className={`w-full ${podiumHeight[realIdx]} ${podiumBg[realIdx]} border-t-2 ${podiumBorder[realIdx]} rounded-t-lg flex flex-col items-center justify-between pt-2 pb-2 shadow-md ${podiumGlow[realIdx]}`}>
                  <span className="text-2xl font-black text-foreground/80">{podiumLabel[realIdx]}</span>
                  <div className="text-center space-y-0.5">
                    {realIdx === 0 ? (
                      <div className="font-mono text-xs text-green-400">Vainqueur</div>
                    ) : (
                      <div className="font-mono text-xs text-red-400">
                        {sessionType === 'practice'
                          ? `+${formatLapTime((sd.bestLapTime || 0) - (podium[0]?.bestLapTime || 0))}`
                          : (sd.totalLaps || 0) < (podium[0]?.totalLaps || 0)
                            ? `+${(podium[0]?.totalLaps || 0) - (sd.totalLaps || 0)} tour${(podium[0]?.totalLaps || 0) - (sd.totalLaps || 0) > 1 ? 's' : ''}`
                            : `+${formatLapTime((sd.totalTime || 0) - (podium[0]?.totalTime || 0))}`
                        }
                      </div>
                    )}
                    <div className="font-mono text-xs text-purple-400">{formatLapTime(sd.bestLapTime)}</div>
                    {sessionType !== 'practice' && <div className="text-xs text-muted-foreground">{sd.totalLaps || 0} tours</div>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Stats summary */}
      {stats && (
        <div className="px-4 py-3 bg-muted/30 flex items-center justify-between text-center">
          <div>
            <div className="text-lg font-bold text-foreground">
              {sorted[0]?.totalLaps || 0}
              {stats.maxLaps && <span className="text-muted-foreground">/{stats.maxLaps}</span>}
            </div>
            <div className="text-xs text-muted-foreground">Tours</div>
          </div>
          {stats.duration != null && (
            <div>
              <div className="text-lg font-bold text-foreground flex items-center justify-center gap-1">
                <Timer className="size-4" />
                {formatTime(stats.duration)}
                {stats.maxDuration && <span className="text-muted-foreground">/{formatTime(Math.floor(stats.maxDuration / 1000))}</span>}
              </div>
              <div className="text-xs text-muted-foreground">Durée</div>
            </div>
          )}
          {stats.gracePeriodUsed && (
            <div>
              <div className="text-lg font-bold text-orange-500 flex items-center justify-center gap-1">
                <Flag className="size-4" />
                {Math.round((stats.gracePeriod || 30000) / 1000)}s
              </div>
              <div className="text-xs text-muted-foreground">Grace</div>
            </div>
          )}
          {fastest && (
            <div>
              <div className="text-lg font-bold text-purple-500 flex items-center justify-center gap-1">
                <Zap className="size-4" />
                {formatLapTime(fastest.bestLapTime)}
              </div>
              <div className="text-xs text-muted-foreground">{fastest.driver?.name}</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
