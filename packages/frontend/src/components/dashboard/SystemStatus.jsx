import { useTranslation } from 'react-i18next'
import { Card, CardContent } from '@/components/ui/card'
import { useDevice } from '@/context/DeviceContext'

/** Whether the API, the WebSocket, the Control Unit and the database answer. */
export default function SystemStatus() {
  const { t } = useTranslation('dashboard')
  const { connected: cuConnected, socketConnected } = useDevice()
  const parts = [
    { label: t('system.backendApi'), ok: true },
    { label: t('glossary:system.websocket'), ok: socketConnected },
    { label: t('glossary:system.controlUnit'), ok: cuConnected },
    { label: t('system.database'), ok: true, text: 'SQLite' },
  ]

  return (
    <Card data-testid="dashboard-system">
      <CardContent>
        <h2 className="font-semibold text-sm mb-3">{t('system.title')}</h2>
        <div className="space-y-2.5">
          {parts.map((s) => (
            <div key={s.label} className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{s.label}</span>
              <div className="flex items-center gap-1.5">
                <div className={`size-1.5 rounded-full ${s.ok ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className={`text-xs ${s.ok ? 'text-green-500' : 'text-red-500'}`}>
                  {s.text || (s.ok ? t('system.ok') : t('system.off'))}
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
