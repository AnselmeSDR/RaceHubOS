import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle, Radio, RefreshCw, Trash2, Wifi } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useApp } from '@/context/AppContext'
import { useDevice, SIMULATOR_ADDRESS } from '@/context/DeviceContext'
import SettingSwitch from './SettingSwitch'

const API_URL = import.meta.env.VITE_API_URL || ''

/**
 * Known and scanned devices, to connect, forget or scan for; the simulator only in admin mode.
 * `onLog` receives each step for the connection log.
 */
export default function DeviceList({ onLog }) {
  const { t } = useTranslation('settings')
  const { connected, deviceAddress, devices, scanResults, scanning, connecting, scan, connect, removeDevice } =
    useDevice()
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

  const allDevices = [...devices].filter((d) => isAdmin || d.type !== 'simulator')
  for (const scanDevice of scanResults) {
    if (!allDevices.find((d) => d.address === scanDevice.address)) {
      if (!isAdmin && scanDevice.type === 'simulator') continue
      allDevices.push({ ...scanDevice, isNew: true })
    }
  }

  return (
    <Card data-testid="settings-devices">
      <CardContent className="">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold flex items-center gap-2">
            <Wifi className="size-4 text-blue-500" />
            {t('devices.title')}
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {autoConnect ? t('devices.auto') : t('devices.manual')}
            </span>
            <SettingSwitch
              on={autoConnect}
              onToggle={() => handleAutoConnectChange(!autoConnect)}
              color="bg-blue-600"
              label={t('devices.auto')}
            />
          </div>
        </div>

        <div className="space-y-2">
          {allDevices.map((device) => (
            <div
              key={device.id || device.address}
              data-testid="settings-device"
              className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                connected && deviceAddress === device.address
                  ? 'border-green-500/50 bg-green-500/10'
                  : device.isNew
                    ? 'border-blue-500/50 bg-blue-500/10'
                    : 'border-border hover:bg-muted'
              }`}
            >
              <div className="flex items-center gap-3">
                <Radio className={`size-4 ${device.type === 'simulator' ? 'text-purple-500' : 'text-blue-500'}`} />
                <div>
                  <p className="font-medium text-sm">
                    {device.name}
                    {device.isNew && <span className="ml-2 text-xs text-blue-500">{t('devices.new')}</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">{device.address}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {connected && deviceAddress === device.address ? (
                  <CheckCircle className="size-5 text-green-500" />
                ) : (
                  <Button size="sm" onClick={() => handleConnect(device.address)} disabled={connecting || connected}>
                    {connecting ? t('devices.connecting') : t('devices.connect')}
                  </Button>
                )}
                {device.type !== 'simulator' && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleDelete(device)}
                    title={t('common:delete')}
                  >
                    <Trash2 className="size-4 text-muted-foreground hover:text-destructive" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>

        <Button variant="outline" className="w-full mt-3" onClick={handleScan} disabled={scanning || connected}>
          {scanning && <RefreshCw className="size-4 animate-spin" />}
          {scanning ? t('devices.scanning') : t('devices.scan')}
        </Button>
      </CardContent>
    </Card>
  )
}
