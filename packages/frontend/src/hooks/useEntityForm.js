import { useState } from 'react'
import { useTranslation } from 'react-i18next'

const API_URL = import.meta.env.VITE_API_URL || ''

/**
 * State and saving of a create/edit form: POST to `endpoint` for a new record, PUT to
 * `endpoint/:id` for `record`. `toBody` shapes what is sent. Once saved, `savedMessage`
 * shows and the form closes after 1.5 s.
 */
export function useEntityForm({ endpoint, record, initial, toBody = (data) => data, savedMessage, onClose }) {
  const { t } = useTranslation('common')
  const [formData, setFormData] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  /** Change handler for one field. */
  const setField = (field) => (value) => setFormData((f) => ({ ...f, [field]: value }))

  async function submit() {
    setSaving(true)
    setError('')
    try {
      const url = record ? `${API_URL}${endpoint}/${record.id}` : `${API_URL}${endpoint}`
      const res = await fetch(url, {
        method: record ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toBody(formData)),
      })
      if (res.ok) {
        setSuccess(savedMessage)
        setTimeout(() => onClose(), 1500)
      } else {
        const data = await res.json()
        setError(data.error || t('saveError'))
      }
    } catch {
      setError(t('connectionError'))
    } finally {
      setSaving(false)
    }
  }

  return {
    formData,
    setFormData,
    setField,
    setError,
    // The props FormModal expects
    formProps: { open: true, onClose, onSubmit: submit, isEditing: !!record, saving, error, success },
  }
}
