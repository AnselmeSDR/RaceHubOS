/**
 * LapTime - Formatted lap time display
 * Displays times in mm:ss.SSS or ss.SSS format
 */
export default function LapTime({ time, size = 'md', highlight = false }) {
  const sizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-xl font-bold',
  }

  // Handle null/undefined/invalid times
  if (time === null || time === undefined || time <= 0) {
    return (
      <span className={`${sizes[size]} font-mono text-gray-400 tabular-nums`}>
        --
      </span>
    )
  }

  // Format time from milliseconds
  const formatTime = (ms) => {
    const totalSeconds = ms / 1000
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60

    if (minutes >= 1) {
      // Format: "1:23.456"
      return `${minutes}:${seconds.toFixed(3).padStart(6, '0')}`
    } else {
      // Format: "23.456"
      return seconds.toFixed(3)
    }
  }

  const formattedTime = formatTime(time)

  return (
    <span
      className={`
        ${sizes[size]} font-mono tabular-nums
        ${highlight
          ? 'bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded font-bold'
          : 'text-gray-900'
        }
      `}
    >
      {formattedTime}
    </span>
  )
}
