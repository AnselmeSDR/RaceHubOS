import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'

const API_URL = import.meta.env.VITE_API_URL || ''
export default function OfflineVoiceSettings({ onChanged, voiceState }) {
  const { t, i18n } = useTranslation('offlineVoices')
  const [status, setStatus] = useState(null)
  const [error, setError] = useState(false)
  const [revision, setRevision] = useState(0)
  const busy = status?.phase === 'installing' || status?.phase === 'removing'
  useEffect(() => {
    let active = true
    let timer
    async function load() {
      try {
        const response = await fetch(`${API_URL}/api/voice/status`)
        if (!response.ok) throw new Error()
        const data = await response.json()
        if (!active) return
        setStatus(data)
        if (data.phase === 'installing' || data.phase === 'removing') timer = setTimeout(load, 750)
        else onChanged()
      } catch {
        if (active) setError(true)
      }
    }
    load()
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [revision, onChanged])
  async function change(method, endpoint) {
    setError(false)
    setStatus((previous) => ({ ...previous, phase: method === 'POST' ? 'installing' : 'removing' }))
    try {
      const response = await fetch(`${API_URL}/api/voice/${endpoint}`, { method })
      if (!response.ok) throw new Error()
      setStatus(await response.json())
    } catch {
      setError(true)
      setStatus((previous) => ({ ...previous, phase: 'idle' }))
    }
    setRevision((value) => value + 1)
  }
  const size = new Intl.NumberFormat(i18n.resolvedLanguage, { maximumFractionDigits: 1 }).format(
    (status?.downloadBytes || 0) / 1024 / 1024
  )
  return (
    <section className="space-y-2 border-t pt-4" data-testid="offline-voices">
      <h3 className="font-medium">{t('title')}</h3>
      <p className="text-sm text-muted-foreground">{t('description')}</p>
      {status && (
        <p data-testid="offline-download-size" className="text-sm">
          {t('downloadSize', { size })}
        </p>
      )}
      <p data-testid="offline-status" role="status" className="text-sm">
        {t(busy ? status.phase : status?.installed ? 'installed' : 'missing')}
      </p>
      {voiceState === 'fallback' && <p data-testid="offline-fallback">{t('fallback')}</p>}
      {(error || status?.error) && <p role="alert">{t('operationFailed')}</p>}
      {status && !status.supported && <p>{t('unsupported')}</p>}
      <div className="flex gap-2 flex-wrap">
        <Button
          data-testid="offline-install"
          disabled={!status?.supported || busy || status?.installed}
          onClick={() => change('POST', 'install')}
        >
          {t('install')}
        </Button>
        <Button
          data-testid="offline-remove"
          variant="outline"
          disabled={busy || !status?.removable}
          onClick={() => change('DELETE', 'installation')}
        >
          {t('remove')}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{t('credits')}</p>
    </section>
  )
}
