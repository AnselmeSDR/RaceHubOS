import { useTranslation } from 'react-i18next'
import { Cpu } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { useDevice } from '@/context/DeviceContext'

/** What the Control Unit reports (start lights, mode, display, fuel), while one is connected. */
export default function CuStatusCard() {
  const { t } = useTranslation('settings')
  const { connected, cuStatus } = useDevice()
  if (!connected || !cuStatus) return null

  return (
    <Card data-testid="settings-cu-status">
      <CardContent className="">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <Cpu className="size-4 text-muted-foreground" />
          {t('cuStatus.title')}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          {[
            { label: t('cuStatus.start'), value: cuStatus.start },
            { label: t('cuStatus.mode'), value: cuStatus.mode || '-' },
            { label: t('cuStatus.display'), value: cuStatus.display || '-' },
            { label: t('cuStatus.fuel'), value: cuStatus.fuel?.join(', ') || '-' },
          ].map((s) => (
            <div key={s.label}>
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="font-mono">{s.value}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
