import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { loadScreens } from '../../lib/raceScreenStorage'
export default function RaceScreenSettingsCard() {
  const { t } = useTranslation('raceScreens')
  const [enabled, setEnabled] = useState(false)
  useEffect(() => {
    let active = true
    const load = () =>
      loadScreens()
        .then((value) => {
          if (active) setEnabled(value.enabled)
        })
        .catch(() => {})
    load()
    window.addEventListener('race:screen-settings', load)
    return () => {
      active = false
      window.removeEventListener('race:screen-settings', load)
    }
  }, [])
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p>{t('settingsHelp')}</p>
        <div className="flex gap-2">
          <Button asChild>
            <Link to="/settings/race-screen">{t('editor')}</Link>
          </Button>
          <Button
            variant="outline"
            disabled={!enabled}
            onClick={() => window.dispatchEvent(new Event('race:screen-open'))}
          >
            {t('openLive')}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
