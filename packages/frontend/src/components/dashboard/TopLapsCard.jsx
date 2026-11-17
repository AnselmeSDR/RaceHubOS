import { useTranslation } from 'react-i18next'
import CarPicture from '@/components/car/CarPicture'
import DriverAvatar from '@/components/driver/DriverAvatar'
import { rankClass } from '@/components/profile/podium'
import { GOLD, GRID_HEAD, GRID_LIST, GRID_ROW } from '@/lib/gridList'
import { formatLap } from './format'
import Panel from './Panel'
import { useApiData } from './useApiData'

const LAPS = '/stats/laptimes?limit=10&sortBy=lapTime&sortOrder=asc&unique=true&has_championship=true'

/** The ten fastest laps of the championships, one per driver, with car and track, each in its column. */
export default function TopLapsCard() {
  const { t } = useTranslation('dashboard')
  const laps = useApiData(LAPS, [])
  if (laps.length === 0) return null

  return (
    <Panel testId="dashboard-top-laps" title={t('topLaps.title')}>
      <div
        className={GRID_LIST}
        style={{ gridTemplateColumns: 'max-content minmax(0,auto) minmax(0,auto) minmax(0,auto) max-content' }}
      >
        <div className={GRID_HEAD}>
          <span>#</span>
          <span>{t('glossary:driver', { count: 1 })}</span>
          <span>{t('glossary:car', { count: 1 })}</span>
          <span>{t('glossary:track', { count: 1 })}</span>
          <span className="text-right">{t('common:time')}</span>
        </div>
        {laps.map((lap, i) => (
          <div key={i} data-testid="top-lap" className={GRID_ROW}>
            <span className={`font-bold tabular-nums ${rankClass(i + 1)}`}>{i + 1}</span>
            <span className="flex min-w-0 items-center gap-2">
              {lap.driver && <DriverAvatar driver={lap.driver} className="size-6" />}
              <span className="truncate font-medium">{lap.driver?.name || '?'}</span>
            </span>
            <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
              {lap.car && <CarPicture car={lap.car} alt="" className="size-6" />}
              <span className="truncate">
                {lap.car?.brand} {lap.car?.model}
              </span>
            </span>
            <span className="truncate text-muted-foreground">{lap.track?.name}</span>
            <span className={`text-right font-mono font-semibold tabular-nums ${i === 0 ? GOLD : ''}`}>
              {formatLap(lap.lapTime)}
            </span>
          </div>
        ))}
      </div>
    </Panel>
  )
}
