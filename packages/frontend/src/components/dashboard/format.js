/** A lap time in seconds, "-" when there is none. */
export function formatLap(ms) {
  if (!ms) return '-'
  return `${(ms / 1000).toFixed(3)}s`
}

export const PODIUM_COLORS = ['text-yellow-500', 'text-zinc-400', 'text-amber-700']
