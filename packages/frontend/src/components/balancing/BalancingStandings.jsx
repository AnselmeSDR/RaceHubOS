import { useTranslation } from 'react-i18next'
import BalancingStandingRow from './BalancingStandingRow'

/**
 * Each car's best balancing lap, the fastest first; cars without a timed lap are left out. While none
 * has one, the cars of `lineup` (the session about to run) already stand there, dashes in place of their times.
 */
export default function BalancingStandings({ standings = [], lineup = [] }) {
  const { t } = useTranslation('balancing')
  const sorted = standings.filter((s) => s.lapTime > 0).sort((a, b) => a.lapTime - b.lapTime)
  const waiting = lineup.filter((entry) => entry.car)

  if (sorted.length === 0 && waiting.length > 0) {
    return (
      <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden divide-y divide-border">
        {waiting.map((entry) => (
          <BalancingStandingRow key={entry.car.id} standing={{ car: entry.car }} gap={null} />
        ))}
      </div>
    )
  }

  if (sorted.length === 0) {
    return (
      <div className="bg-card rounded-xl shadow-sm border border-border p-8 text-center text-muted-foreground text-sm">
        {t('standings.empty')}
      </div>
    )
  }

  const leaderTime = sorted[0].lapTime
  return (
    <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase">{t('standings.bestPerCar')}</h3>
      </div>
      <div className="divide-y divide-border">
        {sorted.map((standing, index) => (
          <BalancingStandingRow
            key={`${standing.carId}-${index}`}
            standing={standing}
            position={index + 1}
            gap={index > 0 ? standing.lapTime - leaderTime : null}
          />
        ))}
      </div>
    </div>
  )
}
