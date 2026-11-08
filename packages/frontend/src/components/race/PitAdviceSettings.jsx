import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { usePitAdvice, savePitAdvice } from './usePitAdvice'
export default function PitAdviceSettings() {
  const { t } = useTranslation('pitAdvice')
  const stored = usePitAdvice()
  const [draft, setDraft] = useState(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const config = draft ?? stored.config
  async function save() {
    setBusy(true)
    try {
      await savePitAdvice(config)
      setMessage(t('saved'))
    } catch {
      setMessage(t('failed'))
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
          <Checkbox
            data-testid="pit-advice-enabled"
            checked={config.enabled}
            disabled={busy || !stored.ready}
            onCheckedChange={(enabled) => setDraft({ ...config, enabled })}
          />
          {t('enabled')}
        </label>
        <label>
          {t('places')}
          <Select
            value={String(config.places)}
            disabled={busy || !stored.ready}
            onValueChange={(value) => setDraft({ ...config, places: Number(value) })}
          >
            <SelectTrigger aria-label={t('places')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1</SelectItem>
              <SelectItem value="2">2</SelectItem>
            </SelectContent>
          </Select>
        </label>
        <p>{t('help')}</p>
        <p className="text-sm text-muted-foreground">{t('limits')}</p>
        <Button disabled={busy || !stored.ready} data-testid="pit-advice-save" onClick={save}>
          {t('save')}
        </Button>
        {message && <p role="status">{message}</p>}
      </CardContent>
    </Card>
  )
}
