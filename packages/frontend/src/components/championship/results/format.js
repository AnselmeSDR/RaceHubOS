/** A lap time: seconds below a minute, m:ss.mmm above; "--" without one. */
export function formatLapTime(ms) {
  if (!ms) return '--'
  const s = ms / 1000
  return s >= 60 ? `${Math.floor(s / 60)}:${(s % 60).toFixed(3).padStart(6, '0')}` : `${s.toFixed(3)}s`
}

/** A total race time as m:ss.mmm; "--" without one. */
export function formatTotalTime(ms) {
  if (!ms) return '--'
  const totalSec = ms / 1000
  const min = Math.floor(totalSec / 60)
  const sec = (totalSec % 60).toFixed(3)
  return `${min}:${sec.padStart(6, '0')}`
}
