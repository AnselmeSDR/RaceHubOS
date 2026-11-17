import { useTranslation } from 'react-i18next'
import { useDevice } from '@/context/DeviceContext'

/** What the Control Unit reports (start lights, mode, display, fuel), while one is connected. */
export default function CuStatusCard() {
  const { t } = useTranslation('settings')
  const { connected, cuStatus } = useDevice()
  if (!connected || !cuStatus) return null

  return (
    <div
      data-testid="settings-cu-status"
      className="flex flex-wrap gap-x-6 gap-y-1 border-t border-border px-4 py-3 text-sm"
    >
      {[
        { label: t('cuStatus.start'), value: cuStatus.start },
        { label: t('cuStatus.mode'), value: cuStatus.mode || '-' },
        { label: t('cuStatus.display'), value: cuStatus.display || '-' },
        { label: t('cuStatus.fuel'), value: cuStatus.fuel?.join(', ') || '-' },
      ].map((s) => (
        <div key={s.label} className="flex items-baseline gap-1.5">
          <p className="text-xs text-muted-foreground">{s.label}</p>
          <p className="font-mono">{s.value}</p>
        </div>
      ))}
    </div>
  )
}
