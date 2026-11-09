import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import SessionGeneralFields from './sessionForm/SessionGeneralFields'
import SessionLineUp from './sessionForm/SessionLineUp'
import { completeRows, initialFormData, loadSessionFormData, saveSession } from './sessionForm/sessionFormData'

const EMPTY_CHOICES = { tracks: [], championships: [], drivers: [], cars: [], availableSlots: 6 }

/** Creates a session, or edits `session`: its settings and its line-up. */
export default function SessionForm({ session, onClose, onSaved }) {
  const { t } = useTranslation('sessions')
  const [formData, setFormData] = useState(() => initialFormData(session))
  const [choices, setChoices] = useState(EMPTY_CHOICES)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadSessionFormData()
      .then(setChoices)
      .catch((err) => {
        console.error('Error loading data:', err)
        setError(t('form.loadError'))
      })
      .finally(() => setLoading(false))
  }, [t])

  const setField = (field, value) => setFormData((f) => ({ ...f, [field]: value }))

  async function handleSubmit(e) {
    e.preventDefault()
    if (!formData.trackId) {
      setError(t('form.trackRequired'))
      return
    }
    // Incomplete rows are left out; a line-up of incomplete rows only is refused
    const drivers = completeRows(formData.drivers)
    if (formData.drivers.length > 0 && drivers.length === 0) {
      setError(t('form.driverRequired'))
      return
    }
    try {
      onSaved(await saveSession(session, { ...formData, drivers }, t('common:saveError')))
      onClose()
    } catch (err) {
      console.error('Error saving session:', err)
      setError(err.message || t('common:saveError'))
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-8 max-w-2xl w-full mx-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">{t('common:loading')}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b dark:border-gray-700 flex-shrink-0">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {session ? t('form.editTitle') : t('form.createTitle')}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form id="session-form" onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto flex-1">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg p-4 text-red-700 dark:text-red-300">
              {error}
            </div>
          )}
          <SessionGeneralFields
            formData={formData}
            setField={setField}
            tracks={choices.tracks}
            championships={choices.championships}
          />
          <SessionLineUp
            rows={formData.drivers}
            onRowsChange={(rows) => setField('drivers', rows)}
            drivers={choices.drivers}
            cars={choices.cars}
            availableSlots={choices.availableSlots}
          />
        </form>

        {/* Actions Footer */}
        <div className="flex gap-3 p-6 border-t dark:border-gray-700 flex-shrink-0 bg-white dark:bg-gray-800">
          <button
            form="session-form"
            type="submit"
            className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
          >
            {session ? t('form.update') : t('form.submit')}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium"
          >
            {t('common:cancel')}
          </button>
        </div>
      </div>
    </div>
  )
}
