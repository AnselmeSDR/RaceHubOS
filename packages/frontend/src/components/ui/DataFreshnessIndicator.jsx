import { useDataFreshness } from '../../hooks/useDataFreshness'

/**
 * Visual indicator of data freshness based on WebSocket server time
 * @param {object} props
 * @param {string|number|Date} props.lastServerTime - Last serverTime received from WebSocket
 * @param {boolean} props.showLabel - Whether to show the text label (default: true)
 */
export default function DataFreshnessIndicator({ lastServerTime, showLabel = true }) {
  const { status, label } = useDataFreshness(lastServerTime)

  const config = {
    live: {
      dot: 'bg-green-500',
      text: 'text-green-600',
      pulse: true
    },
    delayed: {
      dot: 'bg-yellow-500',
      text: 'text-yellow-600',
      pulse: false
    },
    offline: {
      dot: 'bg-red-500',
      text: 'text-red-600',
      pulse: false
    }
  }

  const { dot, text, pulse } = config[status]

  return (
    <div className="inline-flex items-center gap-1.5">
      <span className="relative flex h-2 w-2">
        {pulse && (
          <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${dot} opacity-75`} />
        )}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${dot}`} />
      </span>
      {showLabel && (
        <span className={`text-xs font-medium ${text}`}>
          {label}
        </span>
      )}
    </div>
  )
}
