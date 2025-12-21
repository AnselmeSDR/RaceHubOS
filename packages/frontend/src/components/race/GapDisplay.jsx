/**
 * GapDisplay - Gap to leader display
 * Shows time difference with color coding
 */
export default function GapDisplay({ gap, position }) {
  // Leader shows nothing or "LEADER"
  if (position === 1) {
    return (
      <span className="text-sm font-bold text-purple-600 uppercase tracking-wide">
        Leader
      </span>
    )
  }

  // Handle null/undefined gaps
  if (gap === null || gap === undefined) {
    return <span className="text-gray-400">--</span>
  }

  // Handle string gaps (e.g., "+2 tours")
  if (typeof gap === 'string') {
    return (
      <span className="font-mono tabular-nums text-sm font-medium text-orange-600">
        {gap}
      </span>
    )
  }

  // Format gap in seconds (gap is in milliseconds)
  const gapSeconds = gap / 1000
  const formattedGap = `+${gapSeconds.toFixed(3)}s`

  // Color based on gap size
  // < 1s: green (close racing)
  // 1-5s: yellow (medium gap)
  // > 5s: red (large gap)
  const getGapColor = () => {
    if (gapSeconds < 1) return 'text-green-600'
    if (gapSeconds < 5) return 'text-yellow-600'
    return 'text-red-600'
  }

  return (
    <span className={`font-mono tabular-nums text-sm font-medium ${getGapColor()}`}>
      {formattedGap}
    </span>
  )
}
