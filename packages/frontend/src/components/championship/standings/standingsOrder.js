import { STANDARD_SESSION_TYPES, SessionType } from '@racehubos/shared'

// Championship standings name their fields race*, free sessions' standings do not
export const raceLaps = (s) => s.totalLaps || s.raceTotalLaps || 0
export const raceTime = (s) => s.totalTime || s.raceTotalTime
export const lapCount = (s) => s.totalLaps || s.raceTotalLaps || s.laps

/** The time that ranks a standing in practice (its best lap, however named) or qualifying. */
export const rankingTime = (s, tab) => (tab === SessionType.PRACTICE ? s.lapTime || s.bestTime : s.bestTime)

const ORDERS = {
  // Fastest first, no time last
  [SessionType.PRACTICE]: (list) =>
    [...list].sort(
      (a, b) => (rankingTime(a, SessionType.PRACTICE) || Infinity) - (rankingTime(b, SessionType.PRACTICE) || Infinity)
    ),
  // Only those with a time, fastest first
  [SessionType.QUALIF]: (list) =>
    list.filter((s) => s.bestTime !== null && s.bestTime > 0).sort((a, b) => a.bestTime - b.bestTime),
  // Those who drove or scored: most laps, then shortest total time
  [SessionType.RACE]: (list) =>
    list
      .filter((s) => raceLaps(s) > 0 || s.points > 0)
      .sort((a, b) => raceLaps(b) - raceLaps(a) || (raceTime(a) || Infinity) - (raceTime(b) || Infinity)),
}

/** The standings of a tab, in ranking order; any other tab than practice and qualifying is the race one. */
export function standingsFor(standings, tab) {
  const key = tab === SessionType.PRACTICE || tab === SessionType.QUALIF ? tab : SessionType.RACE
  return ORDERS[key](standings[key] || [])
}

/** The gap to the leader: laps behind in a race, else the time behind; null for the leader or without times. */
export function gapToLeader(standing, leader, tab) {
  if (standing === leader || !STANDARD_SESSION_TYPES.includes(tab)) return null
  if (tab === SessionType.RACE) {
    const lapsBehind = raceLaps(leader) - raceLaps(standing)
    if (lapsBehind > 0) return { type: 'laps', value: lapsBehind }
    const leaderTime = raceTime(leader) || 0
    const time = raceTime(standing) || 0
    return leaderTime && time ? { type: 'time', value: time - leaderTime } : null
  }
  const leaderTime = rankingTime(leader, tab)
  const time = rankingTime(standing, tab)
  return leaderTime && time ? { type: 'time', value: time - leaderTime } : null
}

export const formatGapSeconds = (ms) => `+${(ms / 1000).toFixed(3)}`

const PODIUM_ROWS = [
  'bg-gradient-to-r from-yellow-500/40 to-transparent border-l-4 border-yellow-400',
  'bg-gradient-to-r from-gray-400/30 to-transparent border-l-4 border-gray-300',
  'bg-gradient-to-r from-orange-500/30 to-transparent border-l-4 border-orange-400',
]
const PODIUM_BADGES = ['bg-yellow-400 text-yellow-950', 'bg-gray-300 text-gray-800', 'bg-orange-400 text-orange-950']

export const podiumRow = (position) => PODIUM_ROWS[position - 1] || ''
export const podiumBadge = (position) => PODIUM_BADGES[position - 1] || 'text-muted-foreground'
