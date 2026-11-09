import { useState } from 'react'
import { SessionStatus, SessionType } from '@racehubos/shared'
import SessionLeaderboard from '@/components/race/SessionLeaderboard'
import StartingGrid from '@/components/race/StartingGrid'
import { leaderboardSortBy } from '@/lib/leaderboardEntries'

/**
 * The selected session's grid before its first lap, its leaderboard after. Practice can be sorted;
 * the choice is kept from one practice session to the next.
 */
export default function ChampionshipSessionView({ session, entries, maxLaps, expanded }) {
  const [practiceSortBy, setPracticeSortBy] = useState('laps')
  if (!session) return null

  if (maxLaps === 0 && session.status !== SessionStatus.FINISHED) return <StartingGrid entries={entries} />

  const isPractice = session.type === SessionType.PRACTICE
  return (
    <SessionLeaderboard
      entries={entries}
      expanded={expanded}
      sortBy={leaderboardSortBy(session.type, practiceSortBy)}
      onSortChange={isPractice ? setPracticeSortBy : undefined}
      sessionType={session.type}
      sessionStatus={session.status}
    />
  )
}
