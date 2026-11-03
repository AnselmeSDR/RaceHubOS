import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CAR_SPECS, CAR_NUMBER_SPECS } from '@racehubos/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormModal, PhotoUploadField } from '../components/crud'
import { getImgUrl } from '../utils/image'

const API_URL = import.meta.env.VITE_API_URL || ''
const fields = ['serial', 'brand', 'model', 'year', ...CAR_SPECS]
const numberFields = ['year', ...CAR_NUMBER_SPECS]

async function readCatalog() {
  const response = await fetch(`${API_URL}/api/catalog`)
  const result = await response.json()
  if (!response.ok) throw new Error()
  return result.data
}

function EntryForm({ entry, onClose }) {
  const { t } = useTranslation('catalog')
  const [values, setValues] = useState(entry || {})
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  async function save() {
    setSaving(true)
    setError('')
    try {
      const data = Object.fromEntries(
        [...fields, 'img'].map((key) => [
          key,
          numberFields.includes(key)
            ? values[key] === '' || values[key] == null
              ? null
              : Number(values[key])
            : values[key] || null,
        ])
      )
      const response = await fetch(`${API_URL}/api/catalog/${encodeURIComponent(values.serial.trim())}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!response.ok) throw new Error()
      onClose()
    } catch {
      setError(t('saveError'))
    } finally {
      setSaving(false)
    }
  }
  return (
    <FormModal open title={t('edit')} onClose={onClose} onSubmit={save} saving={saving} error={error}>
      {fields.map((key) => (
        <label className="block" key={key}>
          {key === 'serial' ? t('serial') : t(`cars:fields.${key}`)}
          <Input
            data-testid={`catalog-field-${key}`}
            disabled={key === 'serial' && !!entry}
            required={['serial', 'brand', 'model'].includes(key)}
            type={numberFields.includes(key) ? 'number' : 'text'}
            step={key === 'year' || key === 'weightGrams' ? '1' : 'any'}
            value={values[key] ?? ''}
            onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
          />
        </label>
      ))}
      <PhotoUploadField
        value={values.img}
        onChange={(img) => setValues((v) => ({ ...v, img }))}
        uploadType="cars"
        shape="rect"
        onError={() => setError(t('saveError'))}
      />
    </FormModal>
  )
}

export default function Catalog() {
  const { t } = useTranslation('catalog')
  const [entries, setEntries] = useState([])
  const [editing, setEditing] = useState(undefined)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  async function load() {
    try {
      setEntries(await readCatalog())
    } catch {
      setMessage(t('loadError'))
    }
  }
  useEffect(() => {
    let active = true
    readCatalog()
      .then((data) => {
        if (active) setEntries(data)
      })
      .catch(() => {
        if (active) setMessage(t('loadError'))
      })
    return () => {
      active = false
    }
  }, [t])
  async function importFile(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setBusy(true)
    setMessage('')
    try {
      if (file.size > 1024 * 1024) throw new Error()
      const response = await fetch(`${API_URL}/api/catalog/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: await file.text(),
      })
      if (!response.ok) throw new Error()
      setMessage(t('imported'))
      await load()
    } catch {
      setMessage(t('importError'))
    } finally {
      setBusy(false)
    }
  }
  async function remove(serial) {
    try {
      const response = await fetch(`${API_URL}/api/catalog/${encodeURIComponent(serial)}`, { method: 'DELETE' })
      if (!response.ok) throw new Error()
      await load()
    } catch {
      setMessage(t('saveError'))
    }
  }
  return (
    <div className="p-6 space-y-4" data-testid="catalog-page">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <p>{t('description')}</p>
      <div className="flex gap-4 items-center flex-wrap">
        <Button data-testid="catalog-add" onClick={() => setEditing(null)}>
          {t('add')}
        </Button>
        <label>
          {t('import')}
          <Input
            data-testid="catalog-import"
            type="file"
            accept=".json,application/json"
            disabled={busy}
            onChange={importFile}
          />
        </label>
      </div>
      <p>{t('importHelp')}</p>
      {message && <p role="status">{message}</p>}
      {!entries.length && <p data-testid="catalog-empty">{t('empty')}</p>}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {entries.map((entry) => (
          <article key={entry.serial} data-testid="catalog-entry" className="border rounded-lg p-4 space-y-2">
            {entry.img && <img src={getImgUrl(entry.img)} alt={entry.model} className="h-32 object-contain" />}
            <h2>
              {entry.serial} · {entry.brand} · {entry.model}
            </h2>
            <p>
              {entry.scale} · {entry.year}
            </p>
            <p>
              {entry.tyresFront} · {entry.tyresRear}
            </p>
            <Button data-testid="catalog-edit" onClick={() => setEditing(entry)}>
              {t('edit')}
            </Button>
            <Button data-testid="catalog-delete" variant="outline" onClick={() => remove(entry.serial)}>
              {t('delete')}
            </Button>
          </article>
        ))}
      </div>
      {editing !== undefined && (
        <EntryForm
          entry={editing}
          onClose={() => {
            setEditing(undefined)
            load()
          }}
        />
      )}
    </div>
  )
}
