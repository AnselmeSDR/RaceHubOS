import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Play, RefreshCw, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { useApp } from '@/context/AppContext'
import { useDevice } from '@/context/DeviceContext'
import { offeredDevices } from '@/lib/devices'

/**
 * Starts a draft, and always answers. Without a Control Unit, it opens the known ones above itself, to
 * connect one or search for another: once connected, the session starts. A half-set controller is
 * pointed at instead (`onIncomplete`).
 */
export default function StartButton({ deviceConnected, incomplete, onStart, onIncomplete }) {
  const { t } = useTranslation('championships')
  const { devices, scanResults, scanning, connecting, scan, connect } = useDevice()
  const { isAdmin } = useApp()
  const [starting, setStarting] = useState(false)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState(null)
  const offered = offeredDevices(devices, scanResults, isAdmin)

  async function start() {
    setStarting(true)
    try {
      await onStart()
    } finally {
      setStarting(false)
    }
  }

  function press() {
    if (incomplete) return onIncomplete?.()
    if (!deviceConnected) return setOpen(true)
    start()
  }

  async function connectTo(device) {
    setError(null)
    const result = await connect(device.address)
    if (!result.success) return setError(result.error || t('sessionSection.connectFailed'))
    setOpen(false)
    start()
  }

  return (
    <Popover open={open && !deviceConnected} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <Button onClick={press} disabled={starting}>
          {starting ? (
            <>
              <RefreshCw className="size-4 animate-spin" /> {t('sessionSection.starting')}
            </>
          ) : (
            <>
              <Play className="size-4" /> {t('sessionSection.start')}
            </>
          )}
        </Button>
      </PopoverAnchor>
      <PopoverContent side="top" align="end" data-testid="start-devices" className="w-80">
        <p className="font-semibold">{t('sessionSection.connectCu')}</p>
        {offered.length === 0 && <p className="text-muted-foreground">{t('sessionSection.noKnownCu')}</p>}
        <ul className="flex flex-col gap-1">
          {offered.map((device) => (
            <li key={device.address} className="flex items-center justify-between gap-2">
              <span className="min-w-0">
                <span className="block truncate font-medium">{device.name}</span>
                <span className="block truncate font-mono text-[11px] text-muted-foreground">{device.address}</span>
              </span>
              <Button size="sm" variant="secondary" disabled={connecting} onClick={() => connectTo(device)}>
                {t(connecting ? 'settings:devices.connecting' : 'settings:devices.connect')}
              </Button>
            </li>
          ))}
        </ul>
        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
        <Button variant="outline" size="sm" disabled={scanning} onClick={() => scan()}>
          <Search className="size-3.5" />
          {t(scanning ? 'settings:devices.scanning' : 'settings:devices.scan')}
        </Button>
      </PopoverContent>
    </Popover>
  )
}
