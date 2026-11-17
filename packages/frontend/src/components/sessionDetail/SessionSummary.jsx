import { useTranslation } from 'react-i18next'
import { SessionType } from '@racehubos/shared'
import LapTime from '@/components/race/LapTime'
import { FASTEST_LAP_COLOR } from '@/lib/colors'
import { fastestLapTime, sessionDuration } from '@/lib/sessionResults'

const clock = (ms) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`

function Figure({ label, children }) {
  return (
    <div className="text-right leading-tight">
      <div className="text-base font-bold tabular-nums">{children}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  )
}

/**
 * A stored session at a glance: the leader's laps, how long it ran (against its limit for a race) and
 * the fastest lap, with who set it when there are several drivers. Each only once known.
 */
export default function SessionSummary({ session }) {
  const { t } = useTranslation('sessions')
  const drivers = session.drivers ?? []
  const laps = Math.max(0, ...drivers.map((entry) => entry.totalLaps || 0))
  const duration = sessionDuration(session)
  const fastest = fastestLapTime(drivers)
  const holder = drivers.length > 1 && drivers.find((entry) => entry.bestLapTime === fastest)?.driver?.name
  if (!laps && !duration && !fastest) return null

  return (
    <div data-testid="session-summary" className="flex items-center gap-5">
      {laps > 0 && <Figure label={t('glossary:lap', { count: laps })}>{laps}</Figure>}
      {duration > 0 && (
        <Figure label={t('columns.duration')}>
          {clock(duration)}
          {session.type === SessionType.RACE && session.maxDuration > 0 && (
            <span className="text-xs font-normal text-muted-foreground"> / {clock(session.maxDuration)}</span>
          )}
        </Figure>
      )}
      {fastest && (
        <Figure label={[t('profile.bestLap'), holder].filter(Boolean).join(', ')}>
          <LapTime time={fastest} className={FASTEST_LAP_COLOR} />
        </Figure>
      )}
    </div>
  )
}
