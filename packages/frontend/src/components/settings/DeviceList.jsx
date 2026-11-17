import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link2, Radio, RefreshCw, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useApp } from '@/context/AppContext'
import { useDevice, SIMULATOR_ADDRESS } from '@/context/DeviceContext'
import { offeredDevices } from '@/lib/devices'
import SettingSwitch from './SettingSwitch'
import { SettingRow } from './SettingsPanel'

const API_URL = import.meta.env.VITE_API_URL || ''

/**
 * The rows of the Control Unit panel: known and scanned devices, to connect, disconnect or forget,
 * the automatic connection, and the search for another unit; the simulator only in admin mode.
 * `onLog` receives each step for the connection log.
 */
export default function DeviceList({ onLog }) {
  const { t } = useTranslation('settings')
  const {
    connected,
    deviceAddress,
    devices,
    scanResults,
    scanning,
    connecting,
    scan,
    connect,
    disconnect,
    removeDevice,
  } = useDevice()
  const { isAdmin } = useApp()
  const [autoConnect, setAutoConnect] = useState(false)

  useEffect(() => {
    fetch(`${API_URL}/api/preferences/autoConnect`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data !== null) setAutoConnect(d.data)
      })
      .catch(() => {})
  }, [])

  function handleAutoConnectChange(value) {
    setAutoConnect(value)
    fetch(`${API_URL}/api/preferences/autoConnect`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    }).catch(() => {})
  }

  async function handleConnect(address) {
    const result = await connect(address)
    onLog(
      result.success
        ? t('logs.connectedTo', { device: address === SIMULATOR_ADDRESS ? t('glossary:simulator') : address })
        : t('logs.errorWith', { error: result.error })
    )
  }

  async function handleScan() {
    onLog(t('logs.scanning'))
    const foundDevices = await scan(15000)
    onLog(t('logs.devicesFound', { count: foundDevices.length }))
  }

  async function handleDelete(device) {
    const result = await removeDevice(device.id)
    onLog(
      result.success ? t('logs.deviceDeleted', { name: device.name }) : t('logs.errorWith', { error: result.error })
    )
  }

  const allDevices = offeredDevices(devices, scanResults, isAdmin)

  return (
    <div data-testid="settings-devices">
      {allDevices.map((device) => {
        const current = connected && deviceAddress === device.address
        return (
          <SettingRow
            key={device.id || device.address}
            testId="settings-device"
            icon={<Radio className={`size-4 ${device.type === 'simulator' ? 'text-purple-500' : 'text-blue-500'}`} />}
            label={
              <>
                {device.name}
                {device.isNew && <span className="ml-2 text-xs text-blue-500">{t('devices.new')}</span>}
              </>
            }
            description={<span className="font-mono">{device.address}</span>}
          >
            {current ? (
              <Button variant="outline" size="sm" onClick={disconnect}>
                {t('connection.disconnect')}
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleConnect(device.address)}
                disabled={connecting || connected}
              >
                {connecting ? t('devices.connecting') : t('devices.connect')}
              </Button>
            )}
            {device.type !== 'simulator' && !current && (
              <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => handleDelete(device)}>
                {t('devices.forget')}
              </Button>
            )}
          </SettingRow>
        )
      })}

      <SettingRow label={t('devices.autoConnect')} icon={<Link2 className="size-4 text-blue-500" />}>
        <SettingSwitch
          on={autoConnect}
          onToggle={() => handleAutoConnectChange(!autoConnect)}
          label={t('devices.autoConnect')}
        />
      </SettingRow>

      {!connected && (
        <SettingRow
          label={<span className="font-normal text-muted-foreground">{t('devices.other')}</span>}
          icon={<Search className="size-4 text-muted-foreground" />}
        >
          <Button variant="outline" size="sm" onClick={handleScan} disabled={scanning}>
            {scanning && <RefreshCw className="size-4 animate-spin" />}
            {scanning ? t('devices.scanning') : t('devices.scan')}
          </Button>
        </SettingRow>
      )}
    </div>
  )
}
