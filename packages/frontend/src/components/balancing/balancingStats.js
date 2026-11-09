const DEFAULT_COLOR = '#3B82F6'
const WHITE_SUBSTITUTE = '#94A3B8'
const WHITES = ['#fff', '#ffffff', 'white']
const TREND_MIN_LAPS = 10
const TREND_THRESHOLD_MS = 50
const WINDOW = 5
const FASTEST_SHARE = 0.6
const MIN_FASTEST_LAPS = 3
const SESSION_CHANGE_MS = 50

/** The median of `values`; null when there are none. */
export function medianOf(values) {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/** The car's color as drawn on the chart: blue when unset, slate for white (unreadable on white). */
export function chartColor(color) {
  if (!color) return DEFAULT_COLOR
  return WHITES.includes(color.toLowerCase()) ? WHITE_SUBSTITUTE : color
}

/** Faster, slower or stable from the first half of the laps to the second (medians), from ten laps on. */
export function trendOf(times) {
  if (times.length < TREND_MIN_LAPS) return null
  const half = Math.floor(times.length / 2)
  const first = medianOf(times.slice(0, half))
  const second = medianOf(times.slice(half))
  if (!first || !second) return null
  const delta = second - first
  if (Math.abs(delta) < TREND_THRESHOLD_MS) return { direction: 'stable', delta }
  return { direction: delta > 0 ? 'slower' : 'faster', delta }
}

/**
 * The entries with a car and laps, each with its name, chart color and counted laps: the first lap
 * (out of the pits) and those over `maxLapTime` are left out. `fallbackName(number)` names a car
 * without brand nor model.
 */
export function balancingSeries(entries, maxLapTime, fallbackName) {
  return entries
    .filter((entry) => entry.car && entry.laps?.length)
    .map(({ car, controller, laps }) => {
      const name = [car.brand, car.model].filter(Boolean).join(' ') || fallbackName(controller + 1)
      return {
        key: `${name}-${controller}`,
        name,
        color: chartColor(car.color),
        laps: laps.slice(1).filter((lap) => !maxLapTime || lap.lapTime <= maxLapTime),
      }
    })
}

/** One row per lap from the second on, with each car's time in seconds under its key. */
export function chartRows(series) {
  const lastLap = Math.max(0, ...series.flatMap((s) => s.laps.map((lap) => lap.lapNumber)))
  const rows = []
  for (let lap = 2; lap <= lastLap; lap++) {
    const row = { lap }
    for (const { key, laps } of series) {
      const found = laps.find((l) => l.lapNumber === lap)
      if (found) row[key] = found.lapTime / 1000
    }
    rows.push(row)
  }
  return rows
}

/** The median of each five laps, from the fastest five on, and the best of them. */
function medianWindowsOf(sorted) {
  const windows = []
  for (let i = 0; i + WINDOW <= sorted.length; i += WINDOW) {
    windows.push({ from: i + 1, to: i + WINDOW, value: sorted[i + Math.floor(WINDOW / 2)] })
  }
  return { medianWindows: windows, bestMedianWindow: windows.length ? Math.min(...windows.map((w) => w.value)) : null }
}

/** The average of the fastest 60 % of the laps, from three such laps on. */
function fastestAverageOf(sorted) {
  const count = Math.ceil(sorted.length * FASTEST_SHARE)
  if (count < MIN_FASTEST_LAPS) return null
  return sorted.slice(0, count).reduce((sum, time) => sum + time, 0) / count
}

/**
 * Each car's figures over its counted laps (ms), the best median of five first: best lap, medians of
 * five, average of the fastest 60 %, trend, and how far its best median is from the fastest one.
 */
export function carStatsOf(series) {
  const stats = series
    .filter((s) => s.laps.length)
    .map(({ key, name, color, laps }) => {
      const times = laps.map((lap) => lap.lapTime)
      const sorted = [...times].sort((a, b) => a - b)
      return {
        key,
        name,
        color,
        best: sorted[0],
        avg60: fastestAverageOf(sorted),
        ...medianWindowsOf(sorted),
        trend: trendOf(times),
        totalLaps: times.length,
      }
    })
  const windows = stats.map((s) => s.bestMedianWindow).filter(Boolean)
  const fastest = windows.length ? Math.min(...windows) : null
  return stats
    .map((s) => ({ ...s, deltaToFastest: s.bestMedianWindow && fastest ? s.bestMedianWindow - fastest : null }))
    .sort((a, b) => (a.bestMedianWindow ?? Infinity) - (b.bestMedianWindow ?? Infinity))
}

/** How a session's median compares with the one before: within 50 ms it is steady; none for the first. */
export function medianChange(median, previous) {
  if (!previous) return null
  const delta = median - previous
  if (delta < -SESSION_CHANGE_MS) return 'improved'
  if (delta > SESSION_CHANGE_MS) return 'degraded'
  return 'steady'
}
