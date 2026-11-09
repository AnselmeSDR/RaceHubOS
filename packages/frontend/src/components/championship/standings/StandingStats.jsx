import { useTranslation } from 'react-i18next'
import { STANDARD_SESSION_TYPES, SessionType } from '@racehubos/shared'
import { GAP_COLORS } from '@/lib/colors'
import LapTime from '../../race/LapTime'
import { formatGapSeconds, raceLaps, raceTime, rankingTime } from './standingsOrder'

const GAP = 'font-mono text-xs text-muted-foreground w-16 text-right'

// Practice and qualifying: the ranking time and the gap; a race: laps, gap or total, and points
export default function StandingStats({ standing, position, gap, tab }) {
  const { t } = useTranslation('championships')
  if (!STANDARD_SESSION_TYPES.includes(tab)) return null
  if (tab !== SessionType.RACE) {
    return (
      <>
        <LapTime time={rankingTime(standing, tab)} size="sm" />
        {gap !== null && <span className={GAP}>{formatGapSeconds(gap.value)}</span>}
      </>
    )
  }

  const total = raceTime(standing)
  let gapOrTotal = <LapTime time={total} size="sm" />
  if (position > 1 && gap !== null) {
    gapOrTotal = (
      <>
        <span className={`font-mono text-sm font-medium ${gap.type === 'laps' ? GAP_COLORS.laps : 'text-foreground'}`}>
          {gap.type === 'laps' ? t('standings.gapLaps', { count: gap.value }) : formatGapSeconds(gap.value)}
        </span>
        <div className="font-mono text-[10px] text-muted-foreground">
          <LapTime time={total} size="xs" />
        </div>
      </>
    )
  }

  return (
    <>
      <div className="text-center min-w-[40px]">
        <div className="text-[10px] text-muted-foreground/50 uppercase">{t('standings.laps')}</div>
        <span className="font-mono text-sm font-bold text-foreground">{raceLaps(standing)}</span>
      </div>
      <div className="text-right min-w-[70px]">
        <div className="text-[10px] text-muted-foreground/50 uppercase">
          {position === 1 ? t('standings.total') : t('standings.gap')}
        </div>
        {gapOrTotal}
      </div>
      {standing.points !== undefined && (
        <span className="font-bold text-foreground text-sm w-12 text-right">
          {t('standings.points', { count: standing.points })}
        </span>
      )}
    </>
  )
}
