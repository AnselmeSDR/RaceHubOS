import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Trophy } from 'lucide-react'
import { FormModal, SelectField, TextField } from '@/components/crud'
import { sessionNames } from '@/lib/sessionNames'

const API_URL = import.meta.env.VITE_API_URL || ''

/**
 * Creates a championship by hand: a name and a track, its sessions added afterwards. The switch leads to
 * the automatic wizard; `onFormChange` shares what was typed with it.
 */
export default function ChampionshipFormModal({ tracks, initialData, onFormChange, onClose, onSwitchAuto }) {
  const { t } = useTranslation('championships')
  const [formData, setFormData] = useState(initialData || { name: '', trackId: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const setField = (field) => (value) => {
    const next = { ...formData, [field]: value }
    setFormData(next)
    onFormChange?.(next)
  }

  async function handleSubmit() {
    if (!formData.name || !formData.trackId) return
    setSaving(true)
    try {
      const res = await fetch(`${API_URL}/api/championships`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          trackId: formData.trackId,
          season: new Date().getFullYear().toString(),
          pointsSystem: '{}',
          sessionNames: sessionNames(),
        }),
      })
      if (res.ok) {
        setSuccess(t('form.saved'))
        setTimeout(() => onClose(), 1500)
      } else {
        setError(t('form.createError'))
      }
    } catch {
      setError(t('common:connectionError'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormModal
      open
      onClose={onClose}
      title={t('form.createTitle')}
      icon={<Trophy className="w-5 h-5 text-primary" />}
      onSubmit={handleSubmit}
      saving={saving}
      error={error}
      success={success}
      saveLabel={t('common:create')}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{t('form.autoMode')}</span>
        <button
          type="button"
          onClick={() => onSwitchAuto?.()}
          className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors bg-muted"
        >
          <span className="inline-block size-4 transform rounded-full bg-white shadow-sm transition-transform translate-x-1" />
        </button>
      </div>
      <TextField
        label={t('form.name')}
        value={formData.name}
        onChange={setField('name')}
        placeholder={t('form.namePlaceholder')}
        required
      />
      <SelectField
        label={t('glossary:track', { count: 1 })}
        value={formData.trackId}
        onChange={setField('trackId')}
        options={tracks.map((tr) => ({ value: tr.id, label: tr.name }))}
        placeholder={t('form.selectTrack')}
        required
      />
    </FormModal>
  )
}
