import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CAR_SPECS } from '@racehubos/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const API_URL = import.meta.env.VITE_API_URL || ''
const fields = ['brand', 'model', 'year', 'img', ...CAR_SPECS]

export default function CatalogLookup({ serial, onSerial, onApply }) {
  // Keying the result by reference prevents applying a stale lookup.
  return <Lookup key={serial} serial={serial} onSerial={onSerial} onApply={onApply} />
}

function Lookup({ serial, onSerial, onApply }) {
  const { t } = useTranslation('catalog')
  const [entry, setEntry] = useState(null)
  const [selected, setSelected] = useState({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  async function lookup() {
    setLoading(true)
    setError('')
    setEntry(null)
    try {
      const response = await fetch(`${API_URL}/api/catalog/lookup/${encodeURIComponent(serial.trim())}`)
      const result = await response.json()
      if (!response.ok) throw new Error()
      setEntry(result.data)
      setSelected(Object.fromEntries(fields.filter((key) => result.data[key] != null).map((key) => [key, false])))
    } catch {
      setError(t('lookupError'))
    } finally {
      setLoading(false)
    }
  }
  return (
    <section className="space-y-3" data-testid="catalog-lookup">
      <label className="block">
        {t('serial')}
        <Input data-testid="car-serial" value={serial} onChange={(e) => onSerial(e.target.value)} />
      </label>
      <Button type="button" data-testid="catalog-search" disabled={!serial.trim() || loading} onClick={lookup}>
        {t('lookup')}
      </Button>
      {error && <p role="alert">{error}</p>}
      {entry && (
        <div className="space-y-2" data-testid="catalog-result">
          <p>
            {entry.brand} · {entry.model}
          </p>
          {Object.keys(selected).map((key) => (
            <label key={key} className="flex gap-2">
              <input
                type="checkbox"
                data-testid={`catalog-apply-${key}`}
                checked={selected[key]}
                onChange={(e) => setSelected((s) => ({ ...s, [key]: e.target.checked }))}
              />
              {key === 'img' ? t('common:photo.label') : t(`cars:fields.${key}`)}: {entry[key]}
            </label>
          ))}
          <Button
            type="button"
            data-testid="catalog-apply"
            onClick={() =>
              onApply(Object.fromEntries(fields.filter((key) => selected[key]).map((key) => [key, entry[key]])))
            }
          >
            {t('apply')}
          </Button>
        </div>
      )}
    </section>
  )
}
