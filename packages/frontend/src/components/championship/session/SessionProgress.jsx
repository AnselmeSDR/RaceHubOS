import { useTranslation } from 'react-i18next'
import { Clock, Flag, RefreshCw } from 'lucide-react'
import { formatClock } from './progress'

const DEFAULT_GRACE_SECONDS = 30

function Bar({ children, className = 'bg-muted' }) {
  return <div className={`h-2 ${className} rounded-full overflow-hidden flex`}>{children}</div>
}

/**
 * Where a session stands: its racing time (pauses aside) on the wall-clock timeline, its laps,
 * and once the flag is out, the grace period left. Figures left show only while it is active.
 */
export default function SessionProgress({
  time,
  laps,
  segments,
  isActive,
  isPaused,
  gracePeriodRemaining,
  gracePeriodMs,
}) {
  const { t } = useTranslation('championships')
  const wallTime = segments.reduce((sum, segment) => sum + segment.duration, 0)
  const graceTotal = gracePeriodMs ? gracePeriodMs / 1000 : DEFAULT_GRACE_SECONDS

  return (
    <div className="px-4 py-3 bg-muted/50 border-b border-border space-y-3">
      {time && (
        <div>
          <div className="flex items-center justify-between mb-1 text-sm">
            <span className="flex items-center gap-1 text-muted-foreground">
              <Clock className="w-4 h-4" />
              {formatClock(time.current)}
              {time.pauseTime > 0 && (
                <span className="text-yellow-600">
                  (+{formatClock(time.pauseTime)} {t('sessionSection.pause')})
                </span>
              )}
              {time.total && ` / ${formatClock(time.total)}`}
            </span>
            {isActive && time.total && (
              <span className={`font-bold ${time.isComplete ? 'text-red-600' : 'text-foreground'}`}>
                {t('sessionSection.timeRemaining', { time: formatClock(time.remaining) })}
              </span>
            )}
          </div>
          <Bar>
            {segments.map((segment, i) => (
              <div
                key={i}
                className={`h-full transition-all duration-300 ${segment.type === 'active' ? 'bg-green-500' : 'bg-yellow-500'}`}
                style={{ width: `${wallTime > 0 ? (segment.duration / wallTime) * 100 : 0}%` }}
              />
            ))}
          </Bar>
        </div>
      )}
      {laps && (
        <div>
          <div className="flex items-center justify-between mb-1 text-sm">
            <span className="flex items-center gap-1 text-muted-foreground">
              <RefreshCw className="w-4 h-4" />
              {laps.total
                ? t('sessionSection.lapsCountTotal', { current: laps.current, total: laps.total })
                : t('sessionSection.lapsCount', { current: laps.current })}
            </span>
            {isActive && laps.total && (
              <span className={`font-bold ${laps.isComplete ? 'text-red-600' : 'text-foreground'}`}>
                {t('sessionSection.lapsRemaining', { count: laps.remaining })}
              </span>
            )}
          </div>
          <Bar>
            <div
              className={`h-full transition-all duration-500 ${laps.isComplete || isActive || isPaused ? 'bg-green-500' : 'bg-blue-500'}`}
              style={{ width: `${laps.percentage}%` }}
            />
          </Bar>
        </div>
      )}
      {gracePeriodRemaining !== null && (
        <div>
          <div className="flex items-center justify-between mb-1 text-sm">
            <span className="flex items-center gap-1 text-orange-600 font-medium">
              <Flag className="w-4 h-4" /> {t('sessionSection.checkeredFlag')}
            </span>
            <span className="font-bold text-orange-700 animate-pulse">{formatClock(gracePeriodRemaining)}</span>
          </div>
          <Bar className="bg-orange-200">
            <div
              className="h-full bg-orange-500 transition-all duration-1000"
              style={{ width: `${Math.max(0, (gracePeriodRemaining / graceTotal) * 100)}%` }}
            />
          </Bar>
        </div>
      )}
    </div>
  )
}
