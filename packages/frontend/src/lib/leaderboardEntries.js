import { RUNNING_SESSION_STATUSES, SessionType } from '@racehubos/shared'

/** Whether a session with this status is running, so its leaderboard comes live from the session context. */
export const isLiveStatus = (status) => RUNNING_SESSION_STATUSES.includes(status)

/**
 * A stored leaderboard turned into the entries the session context gives for a live session,
 * sorted by position (unplaced last), the fastest lap flagged.
 */
export function toLeaderboardEntries(leaderboard) {
  if (!leaderboard?.length) return []
  const allBestLaps = leaderboard.map((p) => p.bestLapTime).filter((t) => t && t > 0)
  const fastestLapTime = allBestLaps.length > 0 ? Math.min(...allBestLaps) : null
  return leaderboard
    .map((p) => ({
      id: p.id,
      controller: p.controller,
      driver: p.driver,
      car: p.car,
      gridPos: p.gridPos ?? null,
      stats: {
        laps: p.totalLaps || 0,
        bestLap: p.bestLapTime || null,
        lastLap: p.lastLapTime || null,
        totalTime: p.totalTime || 0,
        gap: p.gap ?? null,
      },
      position: p.position || 0,
      positionDelta: 0,
      hasFastestLap: fastestLapTime && p.bestLapTime === fastestLapTime,
      isDNF: p.isDNF || false,
      laps: p.laps || [],
    }))
    .sort((a, b) => (a.position || 99) - (b.position || 99))
}

/** How a session's leaderboard is sorted: practice as chosen, qualifying by best lap, a race by race order. */
export function leaderboardSortBy(sessionType, practiceSortBy) {
  if (sessionType === SessionType.PRACTICE) return practiceSortBy
  return sessionType === SessionType.QUALIF ? 'bestLap' : 'race'
}
