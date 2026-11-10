import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

const API_URL = import.meta.env.VITE_API_URL || ''

/**
 * Balancing laps are credited to the reference driver: a warning leading to the settings when none is set.
 * Nothing while it is not known, or could not be read.
 */
export default function ReferenceDriverWarning() {
  const { t } = useTranslation('balancing')
  const navigate = useNavigate()
  const [referenceDriver, setReferenceDriver] = useState(undefined)

  useEffect(() => {
    fetch(`${API_URL}/api/drivers/reference`)
      .then((r) => r.json())
      .then((body) => {
        if (body.success) setReferenceDriver(body.data)
      })
      .catch(() => {})
  }, [])

  if (referenceDriver !== null) return null
  return (
    <div className="mb-4 flex items-start gap-3 rounded-md border border-yellow-500/50 bg-yellow-500/10 p-3">
      <AlertTriangle className="size-4 text-yellow-500 shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm font-medium">{t('referenceWarning.title')}</p>
        <p className="text-xs text-muted-foreground">{t('referenceWarning.message')}</p>
      </div>
      <Button variant="outline" size="sm" onClick={() => navigate('/settings')}>
        {t('referenceWarning.action')}
      </Button>
    </div>
  )
}
