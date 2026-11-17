import { useTranslation } from 'react-i18next'
import { SessionType } from '@racehubos/shared'
import DriverAvatar from '@/components/driver/DriverAvatar'
import LapTime from '@/components/race/LapTime'
import { Card, CardContent } from '@/components/ui/card'
import { GOLD } from '@/lib/gridList'
import { sessionEntries } from '@/lib/sessionResults'

const UNKNOWN_DRIVER_COLOR = '#6B7280'
// The session's fastest lap, in the colours of the leaderboard
const FASTEST = 'rounded bg-purple-500/20 px-1.5 py-px font-bold text-purple-700 dark:text-purple-200'

/** The laps of each controller by lap number, in finishing order; a controller without an entry comes last. */
function lapColumns(session) {
  const columns = new Map(sessionEntries(session).map((entry) => [entry.controller, { ...entry, laps: [] }]))
  for (const lap of session.laps) {
    if (!columns.has(lap.controller)) columns.set(lap.controller, { controller: lap.controller, laps: [] })
    columns.get(lap.controller).laps[lap.lapNumber - 1] = Math.round(lap.lapTime)
  }
  return [...columns.values()]
    .filter((column) => column.laps.length > 0)
    .map((column) => ({ ...column, best: Math.min(...column.laps.filter(Boolean)) }))
}

function Time({ time, own, fastest }) {
  if (!time) return null
  const tone = time === fastest ? FASTEST : time === own ? `font-bold ${GOLD}` : 'text-foreground'
  return <LapTime time={time} size="sm" className={tone} />
}

/**
 * The laps of a stored session, a line per lap and a column per driver in finishing order, so two
 * drivers compare on the same lap; each driver's best in gold, the session's in purple. A single
 * driver's laps flow in columns instead. None for balancing.
 */
export default function SessionLapHistory({ session }) {
  const { t } = useTranslation('sessions')
  if (!session.laps?.length || session.type === SessionType.BALANCING) return null
  const columns = lapColumns(session)
  const fastest = Math.min(...columns.map((column) => column.best))
  const rows = Math.max(...columns.map((column) => column.laps.length))
  const [solo] = columns

  return (
    <Card data-testid="session-lap-history">
      <CardContent className="p-0">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold">{t('profile.lapHistory', { count: session.laps.length })}</h3>
        </div>
        {columns.length === 1 ? (
          <div className="columns-[9rem] gap-0 py-1 text-sm">
            {solo.laps.map((time, i) => (
              <div
                key={i}
                data-testid="lap"
                className="flex h-[26px] break-inside-avoid items-center justify-between border-r border-border px-4"
              >
                <span className="text-muted-foreground/70 tabular-nums">{i + 1}</span>
                <Time time={time} own={solo.best} />
              </div>
            ))}
          </div>
        ) : (
          <div className="max-h-96 overflow-auto">
            <table className="w-full border-separate border-spacing-0 text-center text-sm">
              <thead>
                <tr>
                  <th className="sticky top-0 z-10 h-[38px] w-14 border-b border-border bg-card text-[11px] font-semibold tracking-wide text-muted-foreground/70 uppercase">
                    {t('glossary:lap', { count: 1 })}
                  </th>
                  {columns.map((column) => (
                    <th
                      key={column.controller}
                      className="sticky top-0 z-10 min-w-[76px] border-b border-border bg-card px-2"
                    >
                      <span className="inline-flex items-center justify-center gap-1.5 font-bold">
                        <DriverAvatar
                          driver={column.driver ?? { name: '?', color: UNKNOWN_DRIVER_COLOR }}
                          className="size-5"
                        />
                        {column.driver?.name?.split(' ').pop() || `Ctrl ${column.controller + 1}`}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: rows }, (_, i) => (
                  <tr key={i} data-testid="lap">
                    <td className="h-[26px] border-t border-border text-muted-foreground/70 tabular-nums">{i + 1}</td>
                    {columns.map((column) => (
                      <td key={column.controller} className="border-t border-border">
                        <Time time={column.laps[i]} own={column.best} fastest={fastest} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
