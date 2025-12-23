import { useState } from 'react'
import { PlayIcon, FlagIcon, ClockIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import Modal, { ModalFooter, ModalButton } from '../../ui/Modal'

/**
 * Unified session modal for both Qualifying and Race
 * Replaces QualifyingModal.jsx and RaceModal.jsx
 *
 * @param {object} props
 * @param {boolean} props.open - Modal visibility
 * @param {function} props.onClose - Close handler
 * @param {function} props.onStart - Start session handler
 * @param {'qualif' | 'race'} props.type - Session type
 * @param {object} props.initialValues - Initial form values
 */
export default function SessionModal({
  open,
  onClose,
  onStart,
  type = 'qualif',
  initialValues = {}
}) {
  const isQualifying = type === 'qualif'

  const [form, setForm] = useState({
    name: initialValues.name || '',
    duration: initialValues.duration ?? (isQualifying ? 10 : 0),
    maxLaps: initialValues.maxLaps ?? (isQualifying ? 0 : 20),
    useQualifyingGrid: initialValues.useQualifyingGrid ?? false
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    onStart({
      name: form.name,
      duration: form.duration > 0 ? form.duration : null,
      maxLaps: form.maxLaps > 0 ? form.maxLaps : null,
      useQualifyingGrid: !isQualifying && form.useQualifyingGrid
    })
  }

  const title = isQualifying ? 'Qualifications' : 'Course'
  const Icon = isQualifying ? PlayIcon : FlagIcon
  const buttonVariant = isQualifying ? 'primary' : 'success'

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      icon={<Icon className={`w-5 h-5 ${isQualifying ? 'text-blue-500' : 'text-green-500'}`} />}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Session name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nom de la session
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder={isQualifying ? 'Qualifications' : 'Course'}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Duration and laps */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <ClockIcon className="w-4 h-4 inline mr-1" />
              Durée (min)
            </label>
            <input
              type="number"
              value={form.duration}
              onChange={(e) => setForm(f => ({ ...f, duration: parseInt(e.target.value) || 0 }))}
              min="0"
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">0 = illimité</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <ArrowPathIcon className="w-4 h-4 inline mr-1" />
              Max tours
            </label>
            <input
              type="number"
              value={form.maxLaps}
              onChange={(e) => setForm(f => ({ ...f, maxLaps: parseInt(e.target.value) || 0 }))}
              min="0"
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">0 = illimité</p>
          </div>
        </div>

        {/* Race-specific: use qualifying grid */}
        {!isQualifying && (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.useQualifyingGrid}
              onChange={(e) => setForm(f => ({ ...f, useQualifyingGrid: e.target.checked }))}
              className="w-4 h-4 text-green-500 rounded focus:ring-green-500"
            />
            <span className="text-sm text-gray-700">
              Utiliser la grille des qualifications
            </span>
          </label>
        )}

        <ModalFooter>
          <ModalButton variant="secondary" onClick={onClose}>
            Annuler
          </ModalButton>
          <ModalButton type="submit" variant={buttonVariant}>
            {isQualifying ? 'Démarrer les qualifs' : 'Lancer la course'}
          </ModalButton>
        </ModalFooter>
      </form>
    </Modal>
  )
}
