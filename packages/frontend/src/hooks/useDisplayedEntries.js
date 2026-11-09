import { useEffect, useMemo, useState } from 'react'
import { useSession } from '@/context/SessionContext'
import { getSessionLeaderboard } from '@/lib/championshipApi'
import { isLiveStatus, toLeaderboardEntries } from '@/lib/leaderboardEntries'

/**
 * The leaderboard entries to show for `session`, and the most laps any of them completed.
 *
 * A running session is loaded into the session context and followed live; any other one is read once
 * from its stored leaderboard, leaving the live context alone.
 */
export function useDisplayedEntries(session) {
  const { entries: liveEntries, maxLapsCompleted, loadSession } = useSession()
  const [stored, setStored] = useState({ sessionId: null, leaderboard: null })
  const live = isLiveStatus(session?.status)

  useEffect(() => {
    if (!session) return
    if (isLiveStatus(session.status)) {
      loadSession(session.id)
      return
    }
    getSessionLeaderboard(session.id).then((leaderboard) => setStored({ sessionId: session.id, leaderboard }))
  }, [session, loadSession])

  const leaderboard = stored.sessionId === session?.id ? stored.leaderboard : null
  const entries = useMemo(() => toLeaderboardEntries(leaderboard), [leaderboard])

  if (live) return { entries: liveEntries, maxLaps: maxLapsCompleted }
  return { entries, maxLaps: Math.max(0, ...entries.map((e) => e.stats.laps)) }
}
