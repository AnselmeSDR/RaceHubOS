import { useMemo } from 'react'
import { TrendingDown, TrendingUp, Minus } from 'lucide-react'
import LapTime from '../race/LapTime'
import { getImgUrl } from '../../utils/image'

export default function BalancingStandings({ standings = [] }) {
  const sorted = useMemo(() => {
    return [...standings]
      .filter(s => s.lapTime > 0)
      .sort((a, b) => a.lapTime - b.lapTime)
  }, [standings])

  if (sorted.length === 0) {
    return (
      <div className="bg-card rounded-xl shadow-sm border border-border p-8 text-center text-muted-foreground text-sm">
        Aucun classement disponible
      </div>
    )
  }

  const leaderTime = sorted[0]?.lapTime

  return (
    <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase">
          Meilleur temps par voiture
        </h3>
      </div>
      <div className="divide-y divide-border">
        {sorted.map((standing, index) => {
          const car = standing.car
          const position = index + 1
          const gap = index > 0 && leaderTime ? standing.lapTime - leaderTime : null
          const history = standing.history || []
          const lastTwo = history.length >= 2 ? history.slice(-2) : null
          const trend = lastTwo ? lastTwo[1].median - lastTwo[0].median : null

          return (
            <div
              key={`${standing.carId}-${index}`}
              className={`px-4 py-3 hover:bg-muted ${
                position === 1 ? 'bg-gradient-to-r from-yellow-500/40 to-transparent border-l-4 border-yellow-400' :
                position === 2 ? 'bg-gradient-to-r from-gray-400/30 to-transparent border-l-4 border-gray-300' :
                position === 3 ? 'bg-gradient-to-r from-orange-500/30 to-transparent border-l-4 border-orange-400' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                {/* Position */}
                <span className={`w-7 h-7 flex items-center justify-center rounded-full font-black text-sm ${
                  position === 1 ? 'bg-yellow-400 text-yellow-950' :
                  position === 2 ? 'bg-gray-300 text-gray-800' :
                  position === 3 ? 'bg-orange-400 text-orange-950' :
                  'text-muted-foreground'
                }`}>
                  {position}
                </span>

                {/* Car image */}
                {car?.img ? (
                  <div className="w-10 h-7 rounded flex-shrink-0 overflow-hidden">
                    <img
                      src={getImgUrl(car.img)}
                      alt={`${car.brand} ${car.model}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div
                    className="w-10 h-7 rounded flex-shrink-0 flex items-center justify-center text-white text-xs font-bold"
                    style={{ backgroundColor: car?.color || '#6B7280' }}
                  >
                    {(car?.brand || 'C').charAt(0)}
                  </div>
                )}

                {/* Car info */}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-foreground text-sm truncate">
                    {car?.brand} {car?.model}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {standing.laps || 0} tours · {history.length} session{history.length > 1 ? 's' : ''}
                  </div>
                </div>

                {/* Stats */}
                <div className="text-right space-y-0.5">
                  <div className="flex items-center justify-end gap-2">
                    <span className="text-xs text-muted-foreground/60 w-7 text-left">Best</span>
                    <LapTime time={standing.lapTime} size="sm" />
                    <span className="font-mono text-xs text-muted-foreground w-16 text-right">
                      {gap !== null ? `+${(gap / 1000).toFixed(3)}` : ''}
                    </span>
                  </div>
                  {standing.median && (
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-xs text-muted-foreground/60 w-7 text-left">Méd.</span>
                      <LapTime time={standing.median} size="sm" />
                      <span className="w-16" />
                    </div>
                  )}
                  {standing.avg60 && (
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-xs text-muted-foreground/60 w-7 text-left">60%</span>
                      <LapTime time={standing.avg60} size="sm" />
                      <span className="w-16" />
                    </div>
                  )}
                </div>
              </div>

              {/* Session history */}
              {history.length > 1 && (
                <div className="mt-2 ml-10 flex items-center gap-1.5 flex-wrap">
                  {history.map((h, i) => {
                    const prev = i > 0 ? history[i - 1].median : null
                    const delta = prev ? h.median - prev : null
                    const improved = delta !== null && delta < -50
                    const degraded = delta !== null && delta > 50
                    return (
                      <div
                        key={i}
                        className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-mono ${
                          improved ? 'bg-green-500/10 text-green-500' :
                          degraded ? 'bg-red-500/10 text-red-500' :
                          'bg-muted text-muted-foreground'
                        }`}
                      >
                        {delta !== null && (
                          improved ? <TrendingDown className="size-2.5" /> :
                          degraded ? <TrendingUp className="size-2.5" /> :
                          <Minus className="size-2.5" />
                        )}
                        <span>{(h.median / 1000).toFixed(3)}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
