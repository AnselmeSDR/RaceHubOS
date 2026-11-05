import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { useSectorTiming, saveSectorTiming } from './useSectorTiming'
export default function SectorTimingSettings() {
  const { t } = useTranslation('sectorTiming')
  const enabled = useSectorTiming()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  async function change(value) {
    setBusy(true)
    setError(false)
    try {
      await saveSectorTiming(value)
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <label className="flex gap-2 items-center">
          <Checkbox data-testid="sector-enabled" checked={enabled} disabled={busy} onCheckedChange={change} />
          {t('enabled')}
        </label>
        <p>{t('help')}</p>
        <p className="text-sm text-muted-foreground">{t('hardware')}</p>
        {error && <p role="alert">{t('failed')}</p>}
      </CardContent>
    </Card>
  )
}
