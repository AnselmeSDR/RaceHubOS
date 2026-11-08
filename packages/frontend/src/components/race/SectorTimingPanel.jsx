import { useTranslation } from 'react-i18next'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { useSectorTiming } from './useSectorTiming'
import LapTime from './LapTime'
export default function SectorTimingPanel({ entries = [], session }) {
  const enabled = useSectorTiming()
  const { t } = useTranslation('sectorTiming')
  if (!enabled) return null
  return (
    <Card data-testid="sector-panel">
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {entries.map((entry) => {
          const stored = session?.laps
            ?.filter((lap) => lap.controller === entry.controller)
            .sort((a, b) => b.lapNumber - a.lapNumber)[0]
          const sectors =
            entry.stats?.sectors ||
            (stored?.sector1 != null
              ? { sector1: stored.sector1, sector2: stored.sector2, sector3: stored.sector3, completed: true }
              : null)
          return (
            <div key={entry.id || entry.controller}>
              <span>
                {entry.driver?.name || t('controller', { number: entry.controller + 1 })} ·{' '}
                {t(sectors?.completed ? 'completed' : 'current')}:{' '}
              </span>
              {['sector1', 'sector2', 'sector3'].map((field, index) => (
                <span key={field}>
                  {t('sector', { number: index + 1 })} <LapTime time={sectors?.[field]} size="sm" />{' '}
                </span>
              ))}
            </div>
          )
        })}
        {!entries.length && <p>{t('empty')}</p>}
      </CardContent>
    </Card>
  )
}
