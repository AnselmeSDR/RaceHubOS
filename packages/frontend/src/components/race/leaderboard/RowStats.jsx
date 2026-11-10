import { useTranslation } from 'react-i18next'
import { SessionStatus } from '@racehubos/shared'
import { GAP_COLORS } from '@/lib/colors'
import GapDisplay from '../GapDisplay'
import LapTime from '../LapTime'

function Stat({ label, expanded, className = '', children }) {
  return (
    <div className={`text-center ${className}`}>
      <div className={`${expanded ? 'text-sm' : 'text-xs'} text-muted-foreground/50 uppercase`}>{label}</div>
      {children}
    </div>
  )
}

// Laps, best and last lap, then the gap; the race leader shows its total once finished
export default function RowStats({ entry, sortBy, sessionStatus, expanded }) {
  const { t } = useTranslation('race')
  const stats = entry.stats || {}
  const size = expanded ? 'xl' : 'md'
  const raceLeader = sortBy === 'race' && entry.position === 1
  const finished = sessionStatus === SessionStatus.FINISHED

  let gap
  if (!raceLeader) {
    gap = (
      <GapDisplay
        gap={entry.displayGap || stats.gap}
        position={entry.position}
        leaderBestLap={entry.position === 1 && sortBy !== 'race' ? stats.bestLap : null}
      />
    )
  } else if (finished) {
    gap = <LapTime time={stats.totalTime} size={size} format="total" />
  } else {
    gap = (
      <span className={`${expanded ? 'text-lg' : 'text-sm'} font-bold ${GAP_COLORS.leader}`}>
        {t('gapDisplay.leader')}
      </span>
    )
  }

  return (
    <div className={`flex items-center ${expanded ? 'gap-8' : 'gap-3 @4xl:gap-6'} flex-shrink-0`}>
      <Stat label={t('leaderboard.laps')} expanded={expanded}>
        <div className={`font-mono font-bold ${expanded ? 'text-2xl' : 'text-lg'} text-foreground`}>
          {stats.laps ?? 0}
        </div>
      </Stat>
      <Stat label={t('leaderboard.best')} expanded={expanded}>
        <LapTime time={stats.bestLap} size={size} highlight={entry.hasFastestLap} />
      </Stat>
      <Stat label={t('leaderboard.last')} expanded={expanded}>
        <LapTime time={stats.lastLap} size={size} />
      </Stat>
      <Stat
        label={raceLeader && finished ? t('leaderboard.total') : t('leaderboard.gap')}
        expanded={expanded}
        className={expanded ? 'min-w-[100px]' : 'min-w-16 @4xl:min-w-[80px]'}
      >
        {gap}
      </Stat>
    </div>
  )
}
