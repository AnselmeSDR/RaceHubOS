/**
 * GapDisplay - Gap to leader display
 * Shows time difference with color coding
 * For races: leader shows total time, others show gap (laps or time)
 */
export default function GapDisplay({ gap, position, leaderTotalTime, isRace }) {
  // Leader in race mode: show total time
  if (position === 1 && isRace && leaderTotalTime) {
    return <FormattedTime time={leaderTotalTime} />
  }

  // Leader in other modes
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

  // Handle structured gap object { type: 'laps' | 'time', value: number }
  if (typeof gap === 'object' && gap.type) {
    if (gap.type === 'laps') {
      return (
        <span className="font-mono tabular-nums text-sm font-medium text-orange-600">
          +{gap.value} tour{gap.value > 1 ? 's' : ''}
        </span>
      )
    }
    if (gap.type === 'time') {
      return <FormattedGap gapMs={gap.value} />
    }
  }

  // Handle string gaps (e.g., "+2 tours")
  if (typeof gap === 'string') {
    return (
      <span className="font-mono tabular-nums text-sm font-medium text-orange-600">
        {gap}
      </span>
    )
  }

  // Legacy: plain number = time in ms
  return <FormattedGap gapMs={gap} />
}

// Format total time as MM:SS.mmm
function FormattedTime({ time }) {
  if (!time || time <= 0) return <span className="text-gray-400">--</span>

  const totalSeconds = time / 1000
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return (
    <span className="font-mono tabular-nums text-sm font-bold text-gray-900">
      {minutes}:{seconds.toFixed(3).padStart(6, '0')}
    </span>
  )
}

// Format gap in seconds with color coding
function FormattedGap({ gapMs }) {
  const gapSeconds = Math.abs(gapMs / 1000)

  // Color based on gap size
  const getGapColor = () => {
    if (gapSeconds < 1) return 'text-green-600'
    if (gapSeconds < 5) return 'text-yellow-600'
    return 'text-red-600'
  }

  return (
    <span className={`font-mono tabular-nums text-sm font-medium ${getGapColor()}`}>
      +{gapSeconds.toFixed(3)}s
    </span>
  )
}
