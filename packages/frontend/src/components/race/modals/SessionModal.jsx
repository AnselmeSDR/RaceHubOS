import { useState } from 'react'
import { Play, Flag, Clock, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation('race')
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

  const title = isQualifying ? t('glossary:qualifying_other') : t('glossary:race_one')
  const Icon = isQualifying ? Play : Flag
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
            {t('sessionModal.nameLabel')}
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder={isQualifying ? t('glossary:qualifying_other') : t('glossary:race_one')}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Duration and laps */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Clock className="w-4 h-4 inline mr-1" />
              {t('sessionModal.durationLabel')}
            </label>
            <input
              type="number"
              value={form.duration}
              onChange={(e) => setForm(f => ({ ...f, duration: parseInt(e.target.value) || 0 }))}
              min="0"
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">{t('sessionModal.unlimitedHint')}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <RefreshCw className="w-4 h-4 inline mr-1" />
              {t('sessionModal.maxLapsLabel')}
            </label>
            <input
              type="number"
              value={form.maxLaps}
              onChange={(e) => setForm(f => ({ ...f, maxLaps: parseInt(e.target.value) || 0 }))}
              min="0"
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">{t('sessionModal.unlimitedHint')}</p>
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
              {t('sessionModal.useQualifyingGrid')}
            </span>
          </label>
        )}

        <ModalFooter>
          <ModalButton variant="secondary" onClick={onClose}>
            {t('common:cancel')}
          </ModalButton>
          <ModalButton type="submit" variant={buttonVariant}>
            {isQualifying ? t('sessionModal.startQualifying') : t('sessionModal.startRace')}
          </ModalButton>
        </ModalFooter>
      </form>
    </Modal>
  )
}
