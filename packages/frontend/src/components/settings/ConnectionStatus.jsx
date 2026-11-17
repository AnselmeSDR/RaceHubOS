import { useTranslation } from 'react-i18next'
import { useDevice, SIMULATOR_ADDRESS } from '@/context/DeviceContext'

/** Whether a device is connected, and which: the state shown in the title of the Control Unit panel. */
export default function ConnectionStatus() {
  const { t } = useTranslation('settings')
  const { connected, deviceAddress } = useDevice()

  return (
    <span
      data-testid="settings-connection"
      className="flex items-center gap-2 text-xs font-normal text-muted-foreground"
    >
      <span className={`size-2 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground/30'}`} />
      {connected
        ? t('connection.connected', {
            device: deviceAddress === SIMULATOR_ADDRESS ? t('glossary:simulator') : deviceAddress,
          })
        : t('connection.noDevice')}
    </span>
  )
}
