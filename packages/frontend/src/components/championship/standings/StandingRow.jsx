import { useTranslation } from 'react-i18next'
import { SessionType } from '@racehubos/shared'
import DriverAvatar from '@/components/driver/DriverAvatar'
import StandingStats from './StandingStats'
import { podiumBadge, podiumRow } from '@/lib/podium'
import { lapCount } from './standingsOrder'

// A driver's place, avatar, car and laps, then the tab's figures
export default function StandingRow({ standing, driver, position, gap, tab }) {
  const { t } = useTranslation('championships')
  const laps = lapCount(standing)
  return (
    <div
      data-testid="standing-row"
      className={`flex items-center gap-3 px-4 py-3 hover:bg-muted ${podiumRow(position)}`}
    >
      <span
        className={`w-7 h-7 shrink-0 flex items-center justify-center rounded-full font-black text-sm ${podiumBadge(position)}`}
      >
        {position}
      </span>

      <DriverAvatar driver={{ name: '?', ...driver }} alt={driver.name} />

      <div className="flex-1 min-w-0">
        <div className="font-medium text-foreground text-sm truncate">{driver.name}</div>
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          {standing.car && (
            <span className="truncate">
              {standing.car.brand} {standing.car.model}
            </span>
          )}
          {tab !== SessionType.RACE && laps > 0 && <span>• {t('standings.lapsCount', { count: laps })}</span>}
        </div>
      </div>

      <div className="text-right flex items-center gap-3 shrink-0 whitespace-nowrap">
        <StandingStats standing={standing} position={position} gap={gap} tab={tab} />
      </div>
    </div>
  )
}
