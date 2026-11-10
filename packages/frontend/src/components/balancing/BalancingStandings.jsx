import { useTranslation } from 'react-i18next'
import BalancingStandingRow from './BalancingStandingRow'

/** Each car's best balancing lap, the fastest first; cars without a timed lap are left out. */
export default function BalancingStandings({ standings = [] }) {
  const { t } = useTranslation('balancing')
  const sorted = standings.filter((s) => s.lapTime > 0).sort((a, b) => a.lapTime - b.lapTime)

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
