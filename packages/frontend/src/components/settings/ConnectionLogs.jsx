import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronRight, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

/** The connection log, folded under its count; open, it stays scrolled to its last line. */
export default function ConnectionLogs({ logs, onClear }) {
  const { t } = useTranslation('settings')
  const logsContainerRef = useRef(null)

  useEffect(() => {
    const el = logsContainerRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [logs])

  return (
    <details data-testid="settings-logs" className="group border-t border-border">
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 text-sm font-medium [&::-webkit-details-marker]:hidden">
        <ChevronRight className="size-3.5 text-muted-foreground transition-transform group-open:rotate-90" />
        {t('logs.journal')}
        <span className="font-normal text-muted-foreground">
          · {logs.length ? t('logs.count', { count: logs.length }) : t('logs.none')}
        </span>
      </summary>
      <div ref={logsContainerRef} className="h-48 overflow-y-auto bg-muted/30 p-4 font-mono text-xs space-y-1">
        {logs.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">{t('logs.empty')}</p>
        ) : (
          logs.map((log, idx) => (
            <div key={idx} className="flex gap-3">
              <span className="text-muted-foreground">[{log.time}]</span>
              <span>{log.message}</span>
            </div>
          ))
        )}
      </div>
      {logs.length > 0 && (
        <div className="flex justify-end border-t border-border px-4 py-1.5">
          <Button variant="ghost" size="sm" onClick={onClear}>
            <Trash2 className="size-3" />
            {t('common:clear')}
          </Button>
        </div>
      )}
    </details>
  )
}
