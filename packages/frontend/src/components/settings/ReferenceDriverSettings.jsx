import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Loader2, RefreshCw, UserCog } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const API_URL = import.meta.env.VITE_API_URL || ''

/** The reference driver, who owns every balancing lap: choose one, create the Stig, move the old laps to them. */
export default function ReferenceDriverSettings() {
  const { t } = useTranslation('settings')
  const [drivers, setDrivers] = useState([])
  const [referenceDriver, setReferenceDriver] = useState(null)
  const [referenceBusy, setReferenceBusy] = useState(null) // 'create' | 'migrate' | 'select'
  const [referenceMessage, setReferenceMessage] = useState(null)

  function loadReferenceDriver() {
    fetch(`${API_URL}/api/drivers`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setDrivers(d.data || [])
      })
      .catch(() => {})

    fetch(`${API_URL}/api/drivers/reference`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setReferenceDriver(d.data)
      })
      .catch(() => {})
  }

  useEffect(() => {
    loadReferenceDriver()
  }, [])

  async function callReference(action, request) {
    setReferenceBusy(action)
    setReferenceMessage(null)
    try {
      const res = await request()
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      return json.data
    } catch (err) {
      setReferenceMessage({ type: 'error', text: t('referenceDriver.error', { message: err.message }) })
      return null
    } finally {
      setReferenceBusy(null)
    }
  }

  async function handleSelectReference(driverId) {
    const driver = await callReference('select', () =>
      fetch(`${API_URL}/api/drivers/reference`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverId: driverId || null }),
      })
    )
    if (driver !== null) setReferenceDriver(driver)
  }

  async function handleCreateStig() {
    const driver = await callReference('create', () =>
      fetch(`${API_URL}/api/drivers/reference/stig`, { method: 'POST' })
    )
    if (driver) {
      setReferenceDriver(driver)
      setReferenceMessage({ type: 'success', text: t('referenceDriver.created') })
      loadReferenceDriver()
    }
  }

  async function handleMigrateBalancing() {
    const result = await callReference('migrate', () =>
      fetch(`${API_URL}/api/drivers/reference/migrate-balancing`, { method: 'POST' })
    )
    if (result) {
      setReferenceMessage({
        type: 'success',
        text: t('referenceDriver.migrated', { count: result.laps, name: result.driver.name }),
      })
    }
  }

  return (
    <Card data-testid="settings-reference-driver">
      <CardContent className=" space-y-4">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <UserCog className="size-4 text-muted-foreground" />
            {t('referenceDriver.title')}
          </h3>
          <p className="text-xs text-muted-foreground mt-1">{t('referenceDriver.description')}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={referenceDriver?.id ?? ''}
            onValueChange={handleSelectReference}
            disabled={referenceBusy !== null}
          >
            <SelectTrigger className="w-64" aria-label={t('referenceDriver.select')}>
              <SelectValue placeholder={t('referenceDriver.select')} />
            </SelectTrigger>
            <SelectContent>
              {drivers.map((driver) => (
                <SelectItem key={driver.id} value={driver.id}>
                  {driver.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" onClick={handleCreateStig} disabled={referenceBusy !== null}>
            {referenceBusy === 'create' ? <Loader2 className="size-4 animate-spin" /> : <UserCog className="size-4" />}
            {referenceBusy === 'create' ? t('referenceDriver.creating') : t('referenceDriver.createStig')}
          </Button>
        </div>

        {!referenceDriver && (
          <div className="flex items-start gap-2 rounded-md border border-yellow-500/50 bg-yellow-500/10 p-3">
            <AlertTriangle className="size-4 text-yellow-500 shrink-0 mt-0.5" />
            <p className="text-xs">{t('referenceDriver.noneWarning')}</p>
          </div>
        )}

        <div className="border-t border-border" />

        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-medium text-sm">{t('referenceDriver.migrate')}</p>
            <p className="text-xs text-muted-foreground">{t('referenceDriver.migrateDesc')}</p>
          </div>
          <Button
            variant="outline"
            onClick={handleMigrateBalancing}
            disabled={referenceBusy !== null || !referenceDriver}
          >
            {referenceBusy === 'migrate' ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            {referenceBusy === 'migrate' ? t('referenceDriver.migrating') : t('referenceDriver.migrateButton')}
          </Button>
        </div>

        {referenceMessage && (
          <p
            className={`text-xs ${referenceMessage.type === 'error' ? 'text-destructive' : 'text-green-600 dark:text-green-500'}`}
          >
            {referenceMessage.text}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
