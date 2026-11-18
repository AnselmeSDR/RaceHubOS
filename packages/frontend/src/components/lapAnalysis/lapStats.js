import { medianOf } from '@/components/balancing/balancingStats'

// A clean lap is within 15 % of the driver's best. Over a season of sessions half the laps are, tightly
// packed; the others trail off without a gap: off the track, held up, in the pits
export const CLEAN_LAP_RATIO = 1.15
// The pace at a clean lap is the median of this many clean laps around it
export const PACE_WINDOW = 5
// Under two laps there is nothing to compare
export const MIN_LAPS = 2

const sum = (values) => values.reduce((total, value) => total + value, 0)

/** The pace at each lap (ms): null before the first clean lap and after the last, a straight line across an incident. */
function paceOf(times, limit) {
  const clean = times.flatMap((time, lap) => (time <= limit ? [lap] : []))
  const half = Math.floor(PACE_WINDOW / 2)
  const pace = times.map(() => null)
  clean.forEach((lap, i) => {
    pace[lap] = medianOf(clean.slice(Math.max(0, i - half), i + half + 1).map((at) => times[at]))
  })
  clean.slice(1).forEach((lap, i) => {
    const from = clean[i]
    for (let between = from + 1; between < lap; between++) {
      pace[between] = pace[from] + ((pace[lap] - pace[from]) * (between - from)) / (lap - from)
    }
  })
  return pace
}

/**
 * The entries that have lapped, in their order, each with its lap times (ms, in lap order), its best,
 * the `limit` of a clean lap, the median and the spread (standard deviation) of its clean laps, its
 * incidents (the other laps) and the time they `lost` over a median lap, its pace and the time elapsed
 * at the end of each lap.
 */
export function analysedLaps(entries) {
  return entries
    .filter((entry) => entry.laps?.length)
    .map((entry) => {
      const times = [...entry.laps].sort((a, b) => a.lapNumber - b.lapNumber).map((lap) => lap.lapTime)
      const best = Math.min(...times)
      const limit = best * CLEAN_LAP_RATIO
      const clean = times.filter((time) => time <= limit)
      const median = medianOf(clean)
      const mean = sum(clean) / clean.length
      let total = 0
      return {
        key: entry.id ?? `ctrl-${entry.controller}`,
        controller: entry.controller,
        driver: entry.driver,
        times,
        best,
        limit,
        median,
        spread: Math.sqrt(sum(clean.map((time) => (time - mean) ** 2)) / clean.length),
        incidents: times.length - clean.length,
        lost: sum(times.filter((time) => time > limit).map((time) => time - median)),
        pace: paceOf(times, limit),
        elapsed: times.map((time) => (total += time)),
      }
    })
}

/** How far behind `leader` the driver is at the end of each lap both have done (ms): ahead is negative. */
export const gapsTo = (leader, driver) =>
  driver.elapsed.slice(0, leader.elapsed.length).map((time, lap) => time - leader.elapsed[lap])
