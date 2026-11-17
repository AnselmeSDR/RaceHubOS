import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import DriverAvatar from '@/components/driver/DriverAvatar'
import { rankClass } from '@/components/profile/podium'
import { GOLD, GRID_HEAD, GRID_LIST, GRID_ROW } from '@/lib/gridList'
import { formatLap } from './format'
import Panel from './Panel'
import { useApiData } from './useApiData'

const FIGURES = [
  ['totalRaces', 'glossary:race'],
  ['wins', 'glossary:win'],
  ['podiums', 'glossary:podium'],
]

/**
 * The ten best drivers of the championships: races, wins, podiums and best lap, each in its titled
 * column, the best of each column in gold.
 */
export default function DriverLeaderboardCard() {
  const { t } = useTranslation('dashboard')
  const drivers = useApiData('/stats/drivers?has_championship=true', []).slice(0, 10)
  if (drivers.length === 0) return null
  const figure = (driver, key) => driver.statistics?.[key] || 0
  const top = Object.fromEntries(FIGURES.map(([key]) => [key, Math.max(...drivers.map((d) => figure(d, key)))]))
  const record = Math.min(...drivers.map((d) => d.statistics?.bestLap || Infinity))

  return (
    <Panel
      testId="dashboard-driver-leaderboard"
      title={t('driverLeaderboard.title')}
      to="/stats"
      link={`${t('layout:nav.stats')} →`}
    >
      <div className={GRID_LIST} style={{ gridTemplateColumns: 'max-content minmax(0,1fr) repeat(4, max-content)' }}>
        <div className={GRID_HEAD}>
          <span>#</span>
          <span>{t('glossary:driver', { count: 1 })}</span>
          {FIGURES.map(([key, label]) => (
            <span key={key} className="text-right">
              {t(label, { count: 2 })}
            </span>
          ))}
          <span className="text-right">{t('common:record')}</span>
        </div>
        {drivers.map((driver, i) => (
          <Link key={driver.id} to={`/drivers/${driver.id}`} className={`${GRID_ROW} hover:bg-muted transition-colors`}>
            <span className={`font-bold tabular-nums ${rankClass(i + 1)}`}>{i + 1}</span>
            <span className="flex min-w-0 items-center gap-2">
              <DriverAvatar driver={driver} className="size-6" />
              <span className="truncate font-medium">{driver.name}</span>
            </span>
            {FIGURES.map(([key]) => (
              <span
                key={key}
                data-figure={key}
                className={`text-right tabular-nums ${top[key] > 0 && figure(driver, key) === top[key] ? `font-semibold ${GOLD}` : 'text-muted-foreground'}`}
              >
                {figure(driver, key)}
              </span>
            ))}
            <span
              data-figure="bestLap"
              className={`text-right font-mono tabular-nums ${driver.statistics?.bestLap === record ? `font-semibold ${GOLD}` : ''}`}
            >
              {formatLap(driver.statistics?.bestLap)}
            </span>
          </Link>
        ))}
      </div>
    </Panel>
  )
}
