import { useState } from 'react'
import { XMarkIcon, PlayIcon, FlagIcon, ClockIcon, ArrowPathIcon } from '@heroicons/react/24/outline'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

/**
 * AddSessionModal - Modal to add a new session to a championship
 * Calls POST /api/race/qualifying or /api/race/race with championshipId
 */
export default function AddSessionModal({ type = 'qualifying', championshipId, onClose, onCreated }) {
  const [form, setForm] = useState({
    name: '',
    useTime: true,
    useLaps: false,
    duration: 5,
    maxLaps: 10
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const isQualifying = type === 'qualifying'
  const title = isQualifying ? 'Nouvelle Qualification' : 'Nouvelle Course'
  const buttonColor = isQualifying ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'
  const ButtonIcon = isQualifying ? PlayIcon : FlagIcon

  async function handleSubmit(e) {
    e.preventDefault()

    // Validate at least one condition is selected
    if (!form.useTime && !form.useLaps) {
      setError('Selectionnez au moins une condition de fin')
      return
    }

    setLoading(true)
    setError('')

    try {
      const endpoint = isQualifying ? '/api/race/qualifying' : '/api/race/race'
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name || undefined,
          duration: form.useTime && form.duration > 0 ? form.duration : null,
          maxLaps: form.useLaps && form.maxLaps > 0 ? form.maxLaps : null,
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

          {/* End conditions */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Conditions de fin
            </label>

            {/* Time condition */}
            <div className={`p-3 rounded-lg border-2 transition-colors mb-3 ${
              form.useTime ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-gray-50'
            }`}>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.useTime}
                  onChange={(e) => setForm(f => ({ ...f, useTime: e.target.checked }))}
                  className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <ClockIcon className={`w-5 h-5 ${form.useTime ? 'text-blue-600' : 'text-gray-400'}`} />
                <span className={`font-medium ${form.useTime ? 'text-blue-800' : 'text-gray-600'}`}>
                  Limite de temps
                </span>
              </label>
              {form.useTime && (
                <div className="mt-3 ml-8 flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    value={form.duration}
                    onChange={(e) => setForm(f => ({ ...f, duration: parseInt(e.target.value) || 1 }))}
                    className="w-20 px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center"
                  />
                  <span className="text-gray-600">minutes</span>
                </div>
              )}
            </div>

            {/* Laps condition */}
            <div className={`p-3 rounded-lg border-2 transition-colors ${
              form.useLaps ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-gray-50'
            }`}>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.useLaps}
                  onChange={(e) => setForm(f => ({ ...f, useLaps: e.target.checked }))}
                  className="w-5 h-5 rounded border-gray-300 text-green-600 focus:ring-green-500"
                />
                <ArrowPathIcon className={`w-5 h-5 ${form.useLaps ? 'text-green-600' : 'text-gray-400'}`} />
                <span className={`font-medium ${form.useLaps ? 'text-green-800' : 'text-gray-600'}`}>
                  Limite de tours
                </span>
              </label>
              {form.useLaps && (
                <div className="mt-3 ml-8 flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    value={form.maxLaps}
                    onChange={(e) => setForm(f => ({ ...f, maxLaps: parseInt(e.target.value) || 1 }))}
                    className="w-20 px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-center"
                  />
                  <span className="text-gray-600">tours</span>
                </div>
              )}
            </div>
          </div>

          <p className="text-xs text-gray-500">
            {form.useTime && form.useLaps
              ? 'La session se termine quand une des deux conditions est atteinte.'
              : 'Selectionnez au moins une condition de fin.'
            }
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
              disabled={loading || (!form.useTime && !form.useLaps)}
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
