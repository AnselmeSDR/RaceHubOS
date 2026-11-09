import { useTranslation } from 'react-i18next'
import { Minus, TrendingDown, TrendingUp } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import LapTime from '../race/LapTime'

const TRENDS = {
  faster: { Icon: TrendingDown, color: 'text-green-500' },
  slower: { Icon: TrendingUp, color: 'text-red-500' },
  stable: { Icon: Minus, color: 'text-muted-foreground' },
}

function Figure({ label, children }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground/60 uppercase">{label}</div>
      {children}
    </div>
  )
}

/** The medians of five laps, in two columns. */
function MedianWindows({ windows }) {
  const { t } = useTranslation('balancing')
  const half = Math.ceil(windows.length / 2)
  return (
    <div className="border-t border-border pt-2">
      <div className="text-xs text-muted-foreground/60 uppercase mb-1.5">{t('chart.medianPer5')}</div>
      <div className="flex gap-4">
        {[windows.slice(0, half), windows.slice(half)].map((items, col) => (
          <div key={col} className="flex-1 space-y-1.5">
            {items.map(({ from, to, value }) => (
              <div key={from} className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {from}-{to}
                </span>
                <LapTime time={value} size="sm" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

/** One car's figures over the balancing session (see `carStatsOf`). */
export default function BalancingCarCard({ stats }) {
  const { t } = useTranslation('balancing')
  const { name, color, best, avg60, medianWindows, bestMedianWindow, trend, totalLaps, deltaToFastest } = stats
  const trendStyle = trend && TRENDS[trend.direction]

  return (
    <Card data-testid="balancing-car-card">
      <CardContent className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
          <span className="font-semibold text-sm truncate">{name}</span>
          <div className="flex items-center gap-2 ml-auto">
            {trendStyle && (
              <span
                data-testid={`trend-${trend.direction}`}
                className={`flex items-center gap-0.5 text-xs ${trendStyle.color}`}
              >
                <trendStyle.Icon className="size-3" />
              </span>
            )}
            <span className="text-xs text-muted-foreground">{t('chart.lapsCount', { count: totalLaps })}</span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 mb-2 text-center">
          <Figure label={t('chart.best')}>
            <LapTime time={best} size="md" className="text-fastest-lap" />
          </Figure>
          <Figure label={t('chart.bestMedian5')}>
            <LapTime time={bestMedianWindow} size="md" highlight />
            {deltaToFastest > 0 && (
              <div className="text-xs font-mono text-red-400 mt-0.5">+{(deltaToFastest / 1000).toFixed(3)}</div>
            )}
          </Figure>
          <Figure label={t('chart.avg60')}>
            <LapTime time={avg60} size="md" />
          </Figure>
        </div>
        {medianWindows.length > 0 && <MedianWindows windows={medianWindows} />}
      </CardContent>
    </Card>
  )
}
