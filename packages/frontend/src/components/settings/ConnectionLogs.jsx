import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

/** The connection log, kept scrolled to its last line. */
export default function ConnectionLogs({ logs, onClear }) {
  const { t } = useTranslation('settings')
  const logsContainerRef = useRef(null)

  useEffect(() => {
    const el = logsContainerRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [logs])

  return (
    <Card className="overflow-hidden" data-testid="settings-logs">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <h3 className="text-sm font-semibold">{t('logs.title')}</h3>
        <Button variant="ghost" size="sm" onClick={onClear}>
          <Trash2 className="size-3" />
          {t('common:clear')}
        </Button>
      </div>
      <div ref={logsContainerRef} className="h-48 overflow-y-auto p-4 font-mono text-xs space-y-1 bg-muted/30">
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
    </Card>
  )
}
