const laps = (entry) => entry.stats?.laps || 0
const best = (entry) => entry.stats?.bestLap || Infinity
const total = (entry) => entry.stats?.totalTime || Infinity

const ORDERS = {
  // Fastest lap first, no lap last
  bestLap: (a, b) => best(a) - best(b),
  // Most laps, then shortest total time
  race: (a, b) => laps(b) - laps(a) || total(a) - total(b),
  // Most laps, then fastest lap
  laps: (a, b) => laps(b) - laps(a) || best(a) - best(b),
}

/** The entries in board order: 'laps' (the default), 'bestLap' or 'race'. */
export const sortEntries = (entries, sortBy) => [...entries].sort(ORDERS[sortBy] || ORDERS.laps)

/**
 * Sorted entries with their position; in race order, each one after the leader also gets its gap:
 * laps behind, or the time behind on the same lap count.
 */
export function withPositions(sorted, sortBy) {
  const leader = sorted[0]
  return sorted.map((entry, index) => {
    let displayGap = null
    if (sortBy === 'race' && index > 0) {
      const lapsBehind = laps(leader) - laps(entry)
      displayGap =
        lapsBehind > 0
          ? { type: 'laps', value: lapsBehind }
          : { type: 'time', value: (entry.stats?.totalTime || 0) - (leader.stats?.totalTime || 0) }
    }
    return { ...entry, position: index + 1, displayGap, leaderTotalTime: null }
  })
}

/** A driver's row color, readable on the board: white turns blue and blue white. */
export function rowColor(color) {
  if (!color) return '#3B82F6'
  const lower = color.toLowerCase?.() || ''
  if (['#fff', '#ffffff', 'white'].includes(lower)) return '#3B82F6'
  if (['#3b82f6', 'blue', '#0000ff'].includes(lower)) return '#ffffff'
  return color
}

/** The rank color of the podium places. */
export const positionColor = (position) =>
  ['text-yellow-500', 'text-gray-400', 'text-orange-500'][position - 1] || 'text-muted-foreground'
