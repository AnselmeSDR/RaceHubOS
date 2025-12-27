/**
 * StateChip - Race state badge
 * Color-coded chip displaying current session state
 */

// Map backend status to display state
const STATUS_MAP = {
  draft: 'IDLE',
  idle: 'IDLE',
  ready: 'PENDING',
  active: 'RUNNING',
  paused: 'PAUSED',
  finished: 'RESULTS',
  // Also support uppercase for backwards compatibility
  IDLE: 'IDLE',
  PENDING: 'PENDING',
  RUNNING: 'RUNNING',
  PAUSED: 'PAUSED',
  RESULTS: 'RESULTS',
}

export default function StateChip({ state, status }) {
  // Support both 'state' and 'status' props
  const rawValue = status || state
  const normalizedState = STATUS_MAP[rawValue] || 'IDLE'

  const stateConfig = {
    IDLE: {
      label: 'Free Practice',
      bgColor: 'bg-gray-100',
      textColor: 'text-gray-600',
      borderColor: 'border-gray-300',
      pulse: false,
    },
    PENDING: {
      label: 'Starting...',
      bgColor: 'bg-yellow-100',
      textColor: 'text-yellow-700',
      borderColor: 'border-yellow-400',
      pulse: true,
    },
    RUNNING: {
      label: 'Racing',
      bgColor: 'bg-green-100',
      textColor: 'text-green-700',
      borderColor: 'border-green-400',
      pulse: true,
    },
    PAUSED: {
      label: 'Paused',
      bgColor: 'bg-orange-100',
      textColor: 'text-orange-700',
      borderColor: 'border-orange-400',
      pulse: false,
    },
    RESULTS: {
      label: 'Results',
      bgColor: 'bg-blue-100',
      textColor: 'text-blue-700',
      borderColor: 'border-blue-400',
      pulse: false,
    },
  }

  const config = stateConfig[normalizedState] || stateConfig.IDLE

  return (
    <span
      className={`
        inline-flex items-center gap-2 px-3 py-1.5 rounded-full
        text-sm font-semibold uppercase tracking-wide
        border ${config.bgColor} ${config.textColor} ${config.borderColor}
      `}
    >
      {/* Status indicator dot */}
      <span
        className={`
          w-2 h-2 rounded-full
          ${normalizedState === 'RUNNING' ? 'bg-green-500' : ''}
          ${normalizedState === 'PENDING' ? 'bg-yellow-500' : ''}
          ${normalizedState === 'PAUSED' ? 'bg-orange-500' : ''}
          ${normalizedState === 'RESULTS' ? 'bg-blue-500' : ''}
          ${normalizedState === 'IDLE' ? 'bg-gray-400' : ''}
          ${config.pulse ? 'animate-pulse' : ''}
        `}
      />
      {config.label}
    </span>
  )
}
