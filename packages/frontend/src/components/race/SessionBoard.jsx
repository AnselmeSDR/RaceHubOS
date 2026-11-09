import { SessionStatus, SessionType } from '@racehubos/shared'
import { leaderboardSortBy } from '@/lib/leaderboardEntries'
import SessionLeaderboard from './SessionLeaderboard'
import StartingGrid from './StartingGrid'

/**
 * A session's starting grid before its first lap, its leaderboard after. Practice is sorted as the page
 * chose (`practiceSortBy`, changed through `onPracticeSortChange`), qualifying by best lap, a race in race order.
 */
export default function SessionBoard({ session, entries, maxLaps, expanded, practiceSortBy, onPracticeSortChange }) {
  if (!session) return null

  if (maxLaps === 0 && session.status !== SessionStatus.FINISHED) return <StartingGrid entries={entries} />

  return (
    <SessionLeaderboard
      entries={entries}
      expanded={expanded}
      sortBy={leaderboardSortBy(session.type, practiceSortBy)}
      onSortChange={session.type === SessionType.PRACTICE ? onPracticeSortChange : undefined}
      sessionType={session.type}
      sessionStatus={session.status}
    />
  )
}
