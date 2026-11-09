import { useTranslation } from 'react-i18next'
import { SessionType } from '@racehubos/shared'
import { getImgUrl } from '@/utils/image'
import StandingStats from './StandingStats'
import { lapCount, podiumBadge, podiumRow } from './standingsOrder'

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

      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 overflow-hidden"
        style={{ backgroundColor: driver.color || '#6B7280' }}
      >
        {driver.img ? (
          <img src={getImgUrl(driver.img)} alt={driver.name} className="w-full h-full object-cover" />
        ) : (
          driver.name?.charAt(0) || '?'
        )}
      </div>

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
