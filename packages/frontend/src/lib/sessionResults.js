import { SessionType } from '@racehubos/shared'

/** The best lap time among a session's drivers, null when nobody set one. */
export function fastestLapTime(sessionDrivers = []) {
  const times = sessionDrivers.map((d) => d.bestLapTime).filter((t) => t && t > 0)
  return times.length > 0 ? Math.min(...times) : null
}

/** How long a finished session ran, in milliseconds; null before it started or finished. */
export function sessionDuration(session) {
  if (!session?.startedAt || !session?.finishedAt) return null
  return new Date(session.finishedAt).getTime() - new Date(session.startedAt).getTime()
}

// A race ranks by laps then total time; the other sessions by best lap, those without one last
function compare(isRace) {
  return (a, b) => {
    if (isRace) {
      if ((b.totalLaps || 0) !== (a.totalLaps || 0)) return (b.totalLaps || 0) - (a.totalLaps || 0)
      return (a.totalTime || Infinity) - (b.totalTime || Infinity)
    }
    if (!a.bestLapTime && !b.bestLapTime) return 0
    if (!a.bestLapTime) return 1
    if (!b.bestLapTime) return -1
    return a.bestLapTime - b.bestLapTime
  }
}

// The gap to the leader: laps behind in a race, else time behind (best lap outside races)
function gapToLeader(sd, leader, isRace) {
  if (isRace) {
    const lapDiff = (leader.totalLaps || 0) - (sd.totalLaps || 0)
    if (lapDiff > 0) return { type: 'laps', value: lapDiff }
    return { type: 'time', value: (sd.totalTime || 0) - (leader.totalTime || 0) }
  }
  if (leader.bestLapTime && sd.bestLapTime) return { type: 'time', value: sd.bestLapTime - leader.bestLapTime }
  return null
}

/** A stored session's drivers as ranked leaderboard entries, in the format of the live session context. */
export function sessionEntries(session) {
  if (!session?.drivers?.length) return []
  const isRace = session.type === SessionType.RACE
  const fastest = fastestLapTime(session.drivers)
  const sorted = [...session.drivers].sort(compare(isRace))
  const leader = sorted[0]

  return sorted.map((sd, i) => ({
    id: sd.id,
    controller: sd.controller,
    driver: sd.driver,
    car: sd.car,
    gridPos: sd.gridPos ?? null,
    stats: {
      laps: sd.totalLaps || 0,
      bestLap: sd.bestLapTime || null,
      lastLap: sd.lastLapTime || null,
      totalTime: sd.totalTime || 0,
      gap: i > 0 ? gapToLeader(sd, leader, isRace) : null,
    },
    position: i + 1,
    positionDelta: 0,
    hasFastestLap: fastest && sd.bestLapTime === fastest,
    isDNF: sd.isDNF || false,
  }))
}

/** A balancing session's drivers with their laps in order, as the balancing chart reads them. */
export function balancingEntries(session) {
  if (!session || session.type !== SessionType.BALANCING || !session.laps?.length) return []

  const lapsByController = new Map()
  for (const lap of session.laps) {
    if (!lapsByController.has(lap.controller)) lapsByController.set(lap.controller, [])
    lapsByController.get(lap.controller).push({ lapNumber: lap.lapNumber, lapTime: Math.round(lap.lapTime) })
  }

  return (session.drivers || []).map((sd) => ({
    id: sd.id,
    controller: sd.controller,
    driver: sd.driver,
    car: sd.car,
    laps: (lapsByController.get(sd.controller) || []).sort((a, b) => a.lapNumber - b.lapNumber),
    stats: { laps: sd.totalLaps || 0, bestLap: sd.bestLapTime || null },
  }))
}
