import { useTranslation } from 'react-i18next'
import { formatGapSeconds, podiumBadge, podiumRow } from '@/lib/podium'
import LapTime from '../race/LapTime'
import MedianHistory from './MedianHistory'
import CarPicture from '@/components/car/CarPicture'

const NO_COLOR = '#6B7280'

function CarThumb({ car }) {
  return <CarPicture car={{ brand: 'C', color: NO_COLOR, ...car }} className="size-12" />
}

function Figure({ label, time, children }) {
  return (
    <div className="flex items-center justify-end gap-2">
      <span className="text-xs text-muted-foreground/60 w-7 text-left">{label}</span>
      <LapTime time={time} size="sm" />
      <span className="font-mono text-xs text-muted-foreground w-16 text-right">{children}</span>
    </div>
  )
}

/** A car's place, its best lap (with the gap to the leader), median and fastest-60 % average, and its sessions. */
export default function BalancingStandingRow({ standing, position, gap }) {
  const { t } = useTranslation('balancing')
  const { car, median, avg60 } = standing
  const history = standing.history || []

  return (
    <div data-testid="balancing-standing" className={`px-4 py-3 hover:bg-muted ${podiumRow(position)}`}>
      <div className="flex items-center gap-3">
        <span
          className={`w-7 h-7 flex items-center justify-center rounded-full font-black text-sm ${podiumBadge(position)}`}
        >
          {position}
        </span>
        <CarThumb car={car} />
        <div className="flex-1 min-w-0">
          <div className="font-medium text-foreground text-sm truncate">
            {car?.brand} {car?.model}
          </div>
          <div className="text-xs text-muted-foreground">
            {t('standings.lapsAndSessions', { laps: standing.laps || 0, count: history.length })}
          </div>
        </div>
        <div className="text-right space-y-0.5">
          <Figure label={t('standings.best')} time={standing.lapTime}>
            {gap !== null && formatGapSeconds(gap)}
          </Figure>
          {median && <Figure label={t('standings.median')} time={median} />}
          {avg60 && <Figure label={t('standings.avg60')} time={avg60} />}
        </div>
      </div>
      {history.length > 1 && <MedianHistory history={history} />}
    </div>
  )
}
