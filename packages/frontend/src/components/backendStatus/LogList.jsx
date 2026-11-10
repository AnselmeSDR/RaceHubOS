import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

const LEVEL_COLORS = {
  error: 'text-red-400',
  warn: 'text-yellow-400',
  info: 'text-blue-400',
  debug: 'text-muted-foreground',
}
const BOTTOM_MARGIN_PX = 50

/** The log lines, following the newest while scrolled to the bottom. */
export default function LogList({ logs, loading }) {
  const { t } = useTranslation('layout')
  const endRef = useRef(null)
  const [following, setFollowing] = useState(true)

  useEffect(() => {
    if (following) endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs, following])

  const handleScroll = (event) => {
    const { scrollTop, scrollHeight, clientHeight } = event.currentTarget
    setFollowing(scrollHeight - scrollTop - clientHeight < BOTTOM_MARGIN_PX)
  }

  const placeholder = loading ? t('statusPopup.loading') : logs.length === 0 ? t('statusPopup.noLogs') : null

  return (
    <div
      data-testid="status-logs"
      onScroll={handleScroll}
      className="flex-1 overflow-auto px-4 py-2 font-mono text-[11px] bg-muted/30"
    >
      {placeholder ? (
        <p className="text-muted-foreground text-center py-8">{placeholder}</p>
      ) : (
        logs.map((log, i) => (
          <div key={i} data-testid="log-line" className="flex gap-2 py-0.5">
            <span className="text-muted-foreground/60 shrink-0">{log.timestamp}</span>
            <span className={`shrink-0 uppercase w-10 ${LEVEL_COLORS[log.level]}`}>[{log.level}]</span>
            <span>{log.message}</span>
          </div>
        ))
      )}
      <div ref={endRef} />
    </div>
  )
}
