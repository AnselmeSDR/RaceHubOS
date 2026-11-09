import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent } from '@/components/ui/card'
import BalancingCarCard from './BalancingCarCard'
import BalancingLapChart from './BalancingLapChart'
import { balancingSeries, carStatsOf } from './balancingStats'

/** The balancing session's lap times per car, then each car's figures, the most consistent first. */
export default function BalancingChart({ entries = [], maxLapTime = null }) {
  const { t } = useTranslation('balancing')
  const series = useMemo(
    () => balancingSeries(entries, maxLapTime, (number) => t('chart.carFallback', { number })),
    [entries, maxLapTime, t]
  )

  if (series.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">{t('chart.noLapData')}</CardContent>
      </Card>
    )
  }

  const carStats = carStatsOf(series)
  return (
    <div className="space-y-4">
      <BalancingLapChart series={series} />
      {carStats.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {carStats.map((stats) => (
            <BalancingCarCard key={stats.key} stats={stats} />
          ))}
        </div>
      )}
    </div>
  )
}
