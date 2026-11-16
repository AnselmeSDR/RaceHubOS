import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { SessionStatus } from '@racehubos/shared'
import DriverAvatar from '@/components/driver/DriverAvatar'
import { STATUS_DOTS } from '@/lib/colors'
import { bracketTime } from './bracket/bracketTime'
import { useBracket } from './bracket/useBracket'

const PODIUM = 'font-semibold text-yellow-600 dark:text-yellow-400'
const ROW = 'col-span-4 grid-cols-subgrid items-center'
// With room, the lines split into two halves side by side, each line at its `--row`; never when a
// driver runs several qualifs or races (championships before 1.33.0), which would not fit
const HALVES = '@3xl:grid-cols-[repeat(4,max-content)_1rem_repeat(4,max-content)]'
const SIDE = ['@3xl:col-start-1', '@3xl:col-start-6']

/**
 * Each driver's path: the qualifs and races they are in, and their rank once every qualif is over.
 * In qualifying order until then, by rank after; a participant in no session comes after the others.
 */
function pathsOf({ participants = [], qualifGroups, raceGroups, mergedRanking }) {
  const paths = new Map()
  const pathOf = ({ driverId, driver }) => {
    if (!paths.has(driverId)) paths.set(driverId, { driverId, driver, qualifs: [], races: [] })
    const path = paths.get(driverId)
    path.driver ??= driver
    return path
  }
  const place = (groups, key) =>
    groups.forEach((group) =>
      group.drivers.forEach((entry) => entry.driverId && pathOf(entry)[key].push({ group, entry }))
    )
  place(qualifGroups, 'qualifs')
  participants.forEach(pathOf)
  place(raceGroups, 'races')

  const ranks = new Map(mergedRanking.map((entry) => [entry.driverId, entry.position]))
  const lines = [...paths.values()].map((path) => ({ ...path, rank: ranks.get(path.driverId) }))
  // Infinity - Infinity is NaN, which sort takes for a tie
  return ranks.size ? lines.sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity)) : lines
}

/** A session of the bracket, opened when clicked, with the status dot of the session tabs. */
function SessionChip({ group, race, onSelect }) {
  const { t } = useTranslation('championships')
  const dot = STATUS_DOTS[group.status]
  return (
    <button
      type="button"
      title={t(`bracket.statusLabels.${group.status}`, group.status)}
      onClick={() => onSelect?.(group.sessionId)}
      className={`inline-flex items-center gap-1 h-[18px] px-1.5 rounded-md bg-muted text-[11px] font-bold hover:ring-1 hover:ring-current/40 ${
        race ? 'text-session-race' : 'text-session-qualif'
      }`}
    >
      {group.label}
      {dot && <span className={`size-1.5 rounded-full ${dot}`} />}
    </button>
  )
}

/** The sessions of one kind a driver is in; once a session is finished, what they did in it. */
function Sessions({ sessions, race, onSelect }) {
  return (
    <span role="cell" className="flex items-center gap-3">
      {sessions.map(({ group, entry }) => {
        const finished = group.status === SessionStatus.FINISHED
        return (
          <span key={group.sessionId} className="inline-flex items-center gap-1.5 text-[11px] tabular-nums">
            <SessionChip group={group} race={race} onSelect={onSelect} />
            {finished && !race && entry.bestLapTime > 0 && (
              <span className="w-[3.25rem] text-muted-foreground">{bracketTime(entry.bestLapTime)}</span>
            )}
            {finished && race && entry.finalPos && (
              <span className={`min-w-5 ${entry.finalPos <= 3 ? PODIUM : 'font-semibold text-muted-foreground'}`}>
                P{entry.finalPos}
              </span>
            )}
          </span>
        )
      })}
    </span>
  )
}

/** An automatic championship's bracket, one line per driver; a session clicked is selected. */
export default function ChampionshipBracket({ championshipId, onSessionSelect }) {
  const { t } = useTranslation('championships')
  const { bracket, loading } = useBracket(championshipId)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin mr-2" />
        {t('bracket.loading')}
      </div>
    )
  }
  if (!bracket) return null

  const lines = pathsOf(bracket)
  const split = lines.every((line) => line.qualifs.length <= 1 && line.races.length <= 1)
  const half = split ? Math.ceil(lines.length / 2) : lines.length
  const header = (side) => (
    <div
      role="row"
      className={`${ROW} @3xl:row-start-1 ${SIDE[side]} ${side ? 'hidden @3xl:grid' : 'grid'} pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70`}
    >
      <span role="columnheader">{t('glossary:driver', { count: 1 })}</span>
      <span role="columnheader">{t('glossary:sessionType.qualif')}</span>
      <span role="columnheader">{t('bracket.rank')}</span>
      <span role="columnheader">{t('glossary:sessionType.race')}</span>
    </div>
  )

  return (
    <div className="@container">
      <div
        role="table"
        className={`grid grid-cols-[repeat(4,max-content)] gap-x-4 overflow-x-auto text-xs ${split ? HALVES : ''}`}
      >
        {header(0)}
        {lines.length > half && header(1)}
        {lines.map((line, i) => {
          const side = i < half ? 0 : 1
          return (
            <div
              key={line.driverId}
              role="row"
              style={{ '--row': (i % half) + 2 }}
              className={`${ROW} grid h-6 border-t border-border/60 @3xl:row-start-(--row) ${SIDE[side]}`}
            >
              <span role="cell" className="flex items-center gap-1.5">
                {line.driver && <DriverAvatar driver={line.driver} className="size-4" />}
                {line.driver?.name ?? '?'}
              </span>
              <Sessions sessions={line.qualifs} onSelect={onSessionSelect} />
              <span
                role="cell"
                className={`text-right tabular-nums ${line.rank <= 3 ? PODIUM : 'text-muted-foreground'}`}
              >
                {line.rank}
              </span>
              <Sessions sessions={line.races} race onSelect={onSessionSelect} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
