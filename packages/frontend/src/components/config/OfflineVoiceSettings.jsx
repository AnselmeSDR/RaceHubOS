import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'

const API_URL = import.meta.env.VITE_API_URL || ''
export default function OfflineVoiceSettings(props) {
  const { i18n } = useTranslation('offlineVoices')
  const language = ['de', 'en', 'fr'].includes(i18n.resolvedLanguage) ? i18n.resolvedLanguage : 'en'
  return <OfflineVoiceInstallation key={language} {...props} language={language} />
}

function OfflineVoiceInstallation({ onChanged, voiceState, language }) {
  const { t, i18n } = useTranslation('offlineVoices')
  const [extraLanguages, setExtraLanguages] = useState([])
  const selection = [language, ...extraLanguages.filter((value) => value !== language)].sort().join(',')
  const languageName = (value) => new Intl.DisplayNames([i18n.resolvedLanguage], { type: 'language' }).of(value)
  const [storedStatus, setStatus] = useState(null)
  const status = storedStatus?.selection === selection ? storedStatus.data : null
  const [error, setError] = useState(false)
  const [revision, setRevision] = useState(0)
  const busy = status?.phase === 'installing' || status?.phase === 'removing'
  useEffect(() => {
    let active = true
    let timer
    async function load() {
      try {
        const response = await fetch(`${API_URL}/api/voice/status?languages=${selection}`)
        if (!response.ok) throw new Error()
        const data = await response.json()
        if (!active) return
        setStatus({ selection, data })
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
  }, [revision, onChanged, selection])
  async function change(method, endpoint) {
    setError(false)
    setStatus((previous) => ({
      selection,
      data: { ...previous?.data, phase: method === 'POST' ? 'installing' : 'removing' },
    }))
    try {
      const response = await fetch(`${API_URL}/api/voice/${endpoint}`, {
        method,
        ...(endpoint === 'install'
          ? {
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ languages: selection.split(',') }),
            }
          : {}),
      })
      if (!response.ok) throw new Error()
      setStatus({ selection, data: await response.json() })
    } catch {
      setError(true)
      setStatus((previous) => ({ selection, data: { ...previous?.data, phase: 'idle' } }))
    }
    setRevision((value) => value + 1)
  }
  const received = new Intl.NumberFormat(i18n.resolvedLanguage, { maximumFractionDigits: 1 }).format(
    (status?.downloadedBytes || 0) / 1024 / 1024
  )
  const size = new Intl.NumberFormat(i18n.resolvedLanguage, { maximumFractionDigits: 1 }).format(
    (status?.downloadBytes || 0) / 1024 / 1024
  )
  return (
    <section className="space-y-2 border-t pt-4" data-testid="offline-voices">
      <h3 className="font-medium">{t('title')}</h3>
      <p className="text-sm text-muted-foreground">{t('description')}</p>
      <fieldset disabled={busy} className="space-y-2">
        <legend className="text-sm">{t('interfaceLanguage', { language: languageName(language) })}</legend>
        <p className="text-xs text-muted-foreground">{t('optionalLanguages')}</p>
        {['de', 'en', 'fr']
          .filter((value) => value !== language)
          .map((value) => (
            <label key={value} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                data-testid={'offline-language-' + value}
                checked={extraLanguages.includes(value)}
                onChange={(event) =>
                  setExtraLanguages((previous) =>
                    event.target.checked ? [...previous, value] : previous.filter((item) => item !== value)
                  )
                }
              />
              {languageName(value)}
            </label>
          ))}
      </fieldset>
      {status && (
        <p data-testid="offline-download-size" className="text-sm">
          {t('downloadSize', { size })}
        </p>
      )}
      <p data-testid="offline-status" role="status" className="text-sm">
        {t(busy ? status.phase : status?.installed ? 'installed' : 'missing')}
      </p>
      {status?.phase === 'installing' && status.fileCount > 0 && (
        <div data-testid="offline-progress" className="space-y-1 text-sm" aria-live="polite">
          <p>{t('progress', { received, size })}</p>
          <progress
            aria-label={t('progressLabel')}
            className="w-full"
            max={status.downloadBytes || 1}
            value={Math.min(status.downloadedBytes || 0, status.downloadBytes || 1)}
          />
          <p>
            {t('packageProgress', { current: status.fileIndex, total: status.fileCount })} · {t('stage' + status.stage)}
          </p>
          <p>{t('verifiedProgress', { verified: status.verifiedFiles, total: status.fileCount })}</p>
        </div>
      )}
      {status?.cancelled && !busy && <p data-testid="offline-cancelled">{t('cancelled')}</p>}
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
        {status?.phase === 'installing' && (
          <Button
            data-testid="offline-cancel"
            variant="outline"
            disabled={status.stage === 'publishing' || status.stage === 'cancelling'}
            onClick={() => change('POST', 'cancel')}
          >
            {t('cancel')}
          </Button>
        )}
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
