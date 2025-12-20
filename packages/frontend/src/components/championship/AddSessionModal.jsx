import { useState } from 'react'
import { XMarkIcon, PlayIcon, FlagIcon } from '@heroicons/react/24/outline'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

/**
 * AddSessionModal - Modal to add a new session to a championship
 * Calls POST /api/race/qualifying or /api/race/race with championshipId
 */
export default function AddSessionModal({ type = 'qualifying', championshipId, onClose, onCreated }) {
  const [form, setForm] = useState({
    name: '',
    duration: 5,
    maxLaps: 0
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const isQualifying = type === 'qualifying'
  const title = isQualifying ? 'Nouvelle Qualification' : 'Nouvelle Course'
  const buttonColor = isQualifying ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'
  const ButtonIcon = isQualifying ? PlayIcon : FlagIcon

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const endpoint = isQualifying ? '/api/race/qualifying' : '/api/race/race'
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name || undefined,
          duration: form.duration > 0 ? form.duration : undefined,
          maxLaps: form.maxLaps > 0 ? form.maxLaps : undefined,
          championshipId
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de la creation de la session')
      }

      onCreated(data.data)
      onClose()
    } catch (err) {
      console.error('Failed to create session:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-800">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <XMarkIcon className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nom (optionnel)
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder={isQualifying ? 'Qualifications' : 'Course'}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Duree (min)
              </label>
              <input
                type="number"
                min="0"
                value={form.duration}
                onChange={(e) => setForm(f => ({ ...f, duration: parseInt(e.target.value) || 0 }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tours max
              </label>
              <input
                type="number"
                min="0"
                value={form.maxLaps}
                onChange={(e) => setForm(f => ({ ...f, maxLaps: parseInt(e.target.value) || 0 }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
              />
            </div>
          </div>

          <p className="text-xs text-gray-500">
            Laissez a 0 pour illimite. Au moins une limite (duree ou tours) est recommandee.
          </p>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`flex items-center gap-2 px-6 py-2 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 ${buttonColor}`}
            >
              <ButtonIcon className="w-5 h-5" />
              {loading ? 'Creation...' : 'Creer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
