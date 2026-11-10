/** A time in milliseconds as "m:ss.mmm", or "s.mmm" under a minute; a dash when there is none. */
export function bracketTime(ms) {
  if (!ms) return '-'
  const total = Math.round(ms)
  const mins = Math.floor(total / 60000)
  const secs = Math.floor((total % 60000) / 1000)
  const millis = String(total % 1000).padStart(3, '0')
  if (mins > 0) return `${mins}:${String(secs).padStart(2, '0')}.${millis}`
  return `${secs}.${millis}`
}
