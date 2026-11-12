import { Trans, useTranslation } from 'react-i18next'
import { ChevronRight } from 'lucide-react'
import { bracketTime } from './bracketTime'
import DriverAvatar from '@/components/driver/DriverAvatar'

/** All qualifiers ranked by best lap once every qualifying group has finished; a hint before. */
export default function MergedRanking({ ranking, ready }) {
  const { t } = useTranslation('championships')

  if (!ready) {
    return (
      <div className="text-center space-y-2">
        <ChevronRight className="w-6 h-6 text-muted-foreground mx-auto" />
        <p className="text-xs text-muted-foreground">
          <Trans t={t} i18nKey="bracket.rankingAfterQualifs" />
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-center text-muted-foreground mb-2">{t('bracket.qualifRanking')}</p>
      <div className="border border-border rounded-lg p-2 bg-card space-y-1 min-w-[140px]">
        {ranking.map((entry) => (
          <div key={entry.driverId} data-testid="ranking-entry" className="flex items-center gap-2 text-xs">
            <span
              className={`w-4 text-right font-medium ${
                entry.position <= 3 ? 'text-yellow-600 dark:text-yellow-400' : 'text-muted-foreground'
              }`}
            >
              {entry.position}
            </span>
            {entry.driver?.img && <DriverAvatar driver={entry.driver} className="size-4" />}
            <span className="flex-1 truncate">{entry.driver?.name || '?'}</span>
            <span className="text-muted-foreground tabular-nums">{bracketTime(entry.bestTime)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
