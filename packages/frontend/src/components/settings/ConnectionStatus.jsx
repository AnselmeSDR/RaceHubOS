import { useTranslation } from 'react-i18next'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useDevice, SIMULATOR_ADDRESS } from '@/context/DeviceContext'

/** Which device the app is connected to, with the way to disconnect it. */
export default function ConnectionStatus() {
  const { t } = useTranslation('settings')
  const { connected, deviceAddress, disconnect } = useDevice()

  return (
    <Card className={connected ? 'border-green-500/50' : ''} data-testid="settings-connection">
      <CardContent className=" flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`size-2.5 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground/30'}`}
          />
          <p className="font-medium text-sm">
            {connected
              ? t('connection.connected', {
                  device: deviceAddress === SIMULATOR_ADDRESS ? t('glossary:simulator') : deviceAddress,
                })
              : t('connection.noDevice')}
          </p>
        </div>
        {connected && (
          <Button variant="destructive" size="sm" onClick={disconnect}>
            {t('connection.disconnect')}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
