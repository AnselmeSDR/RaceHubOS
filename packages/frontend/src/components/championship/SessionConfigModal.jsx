import { useState, useMemo } from 'react'
import {
  TrashIcon,
  ArrowPathIcon,
  ClockIcon,
  FlagIcon,
  BeakerIcon,
  DocumentDuplicateIcon
} from '@heroicons/react/24/outline'
import Modal, { ModalFooter, ModalButton } from '../ui/Modal'

const SESSION_TYPE_LABELS = {
  practice: 'Essais Libres',
  qualif: 'Qualifications',
  race: 'Course'
}

const SESSION_TYPE_ICONS = {
  practice: BeakerIcon,
  qualif: ClockIcon,
  race: FlagIcon
}

// Controllers are 0-indexed in DB (0-5), displayed as 1-6
const CONTROLLER_COLORS = [
  'bg-red-500',    // 0 -> displayed as 1
  'bg-blue-500',   // 1 -> displayed as 2
  'bg-yellow-500', // 2 -> displayed as 3
  'bg-green-500',  // 3 -> displayed as 4
  'bg-purple-500', // 4 -> displayed as 5
  'bg-orange-500'  // 5 -> displayed as 6
]

/**
 * SessionConfigModal - Modal to configure a session
 * Form: Name, Type (readonly), Duration OR Laps
 * Controller config table (6 rows): Controller | Driver (select) | Car (select)
 * Radio: Status - Draft / Ready
 * Buttons: [Delete] [Reset] depending on status
 * [Cancel] [Save]
 */
export default function SessionConfigModal({
  session,
  sessions = [],
  drivers = [],
  cars = [],
  sessionDrivers = [],
  open,
  onClose,
  onSave,
  onDelete,
  onReset
}) {
  // Form state
  const [name, setName] = useState(session?.name || '')
  // Duration in DB is ms, UI shows minutes
  const [durationMinutes, setDurationMinutes] = useState(session?.maxDuration ? Math.round(session.maxDuration / 60000) : 0)
  const [maxLaps, setMaxLaps] = useState(session?.maxLaps || 0)
  // Grace period in DB is ms, UI shows seconds (default 30s)
  const [gracePeriodSeconds, setGracePeriodSeconds] = useState(session?.gracePeriod ? Math.round(session.gracePeriod / 1000) : 30)
  const [status, setStatus] = useState(session?.status || 'draft')
  const [controllerConfigs, setControllerConfigs] = useState(() => {
    // Initialize from sessionDrivers
    // Controllers in DB are 0-indexed (0-5), UI shows 1-6
    const configs = {}
    for (let i = 0; i < 6; i++) {
      const sd = sessionDrivers.find(d => Number(d.controller) === i)
      configs[i] = {
        driverId: sd?.driverId || null,
        carId: sd?.carId || null
      }
    }
    return configs
  })
  const [saving, setSaving] = useState(false)

  const TypeIcon = SESSION_TYPE_ICONS[session?.type] || FlagIcon
  const isPractice = session?.type === 'practice'
  const isActive = session?.status === 'active'
  const isFinished = session?.status === 'finished'
  const canEdit = ['draft', 'ready'].includes(session?.status)
  const canDelete = canEdit || isFinished
  const canReset = session?.status === 'ready' || isActive || isFinished

  // Find practice session to copy from (only for non-practice sessions in a championship)
  const practiceSession = useMemo(() => {
    if (isPractice || !session?.championshipId) return null
    return sessions.find(s => s.type === 'practice' && s.drivers?.length > 0)
  }, [sessions, isPractice, session?.championshipId])

  // Copy config from practice session
  const handleCopyFromPractice = () => {
    if (!practiceSession?.drivers) return
    const newConfigs = {}
    for (let i = 0; i < 6; i++) {
      const sd = practiceSession.drivers.find(d => Number(d.controller) === i)
      newConfigs[i] = {
        driverId: sd?.driverId || null,
        carId: sd?.carId || null
      }
    }
    setControllerConfigs(newConfigs)
  }

  // Get used driver/car IDs to prevent duplicates
  const usedDriverIds = useMemo(() => {
    return Object.values(controllerConfigs)
      .map(c => c.driverId)
      .filter(Boolean)
  }, [controllerConfigs])

  const usedCarIds = useMemo(() => {
    return Object.values(controllerConfigs)
      .map(c => c.carId)
      .filter(Boolean)
  }, [controllerConfigs])

  // Handle controller config change
  const handleControllerChange = (controller, field, value) => {
    setControllerConfigs(prev => ({
      ...prev,
      [controller]: {
        ...prev[controller],
        [field]: value || null
      }
    }))
  }

  // Get available drivers for a controller (excluding already used)
  const getAvailableDrivers = (controller) => {
    const currentDriverId = controllerConfigs[controller]?.driverId
    return drivers.filter(d =>
      d.id === currentDriverId || !usedDriverIds.includes(d.id)
    )
  }

  // Get available cars for a controller (excluding already used)
  const getAvailableCars = (controller) => {
    const currentCarId = controllerConfigs[controller]?.carId
    return cars.filter(c =>
      c.id === currentCarId || !usedCarIds.includes(c.id)
    )
  }

  // Handle save
  const handleSave = async () => {
    setSaving(true)
    try {
      // Build drivers array from configs (controller is 0-indexed)
      const driversPayload = Object.entries(controllerConfigs)
        .filter(([, config]) => config.driverId && config.carId)
        .map(([controller, config]) => ({
          controller: Number(controller), // 0-indexed
          driverId: config.driverId,
          carId: config.carId
        }))

      await onSave({
        name: name || null,
        maxDuration: durationMinutes > 0 ? durationMinutes * 60000 : null, // Convert minutes to ms
        maxLaps: maxLaps > 0 ? maxLaps : null,
        gracePeriod: gracePeriodSeconds > 0 ? gracePeriodSeconds * 1000 : 30000, // Convert seconds to ms
        status,
        drivers: driversPayload
      })
      onClose()
    } catch (err) {
      console.error('Failed to save session config:', err)
    } finally {
      setSaving(false)
    }
  }

  // Handle delete
  const handleDelete = async () => {
    try {
      await onDelete(session.id)
      onClose()
    } catch (err) {
      console.error('Failed to delete session:', err)
    }
  }

  // Handle reset
  const handleReset = async () => {
    try {
      await onReset(session.id)
      onClose()
    } catch (err) {
      console.error('Failed to reset session:', err)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Configuration Session"
      icon={<TypeIcon className="w-5 h-5 text-gray-500" />}
      size="2xl"
    >
      <div className="space-y-6">
        {/* Session info */}
        <div className="grid grid-cols-2 gap-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Nom
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={SESSION_TYPE_LABELS[session?.type]}
              disabled={!canEdit}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          {/* Type (readonly) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Type
            </label>
            <div className="px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300">
              {SESSION_TYPE_LABELS[session?.type]}
            </div>
          </div>
        </div>

        {/* Duration / MaxLaps / GracePeriod (not for practice) */}
        {!isPractice && (
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Duree (minutes)
              </label>
              <input
                type="number"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(parseInt(e.target.value) || 0)}
                min="0"
                disabled={!canEdit}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Max tours
              </label>
              <input
                type="number"
                value={maxLaps}
                onChange={(e) => setMaxLaps(parseInt(e.target.value) || 0)}
                min="0"
                disabled={!canEdit}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Grace period (sec)
              </label>
              <input
                type="number"
                value={gracePeriodSeconds}
                onChange={(e) => setGracePeriodSeconds(parseInt(e.target.value) || 30)}
                min="5"
                max="300"
                disabled={!canEdit}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>
        )}

        {/* Controller config table */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Configuration Controllers
            </label>
            {canEdit && practiceSession && (
              <button
                onClick={handleCopyFromPractice}
                className="flex items-center gap-1.5 px-2 py-1 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
              >
                <DocumentDuplicateIcon className="w-4 h-4" />
                Copier depuis EL
              </button>
            )}
          </div>
          <div className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  <th className="px-3 py-2">Ctrl</th>
                  <th className="px-3 py-2">Pilote</th>
                  <th className="px-3 py-2">Voiture</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {[0, 1, 2, 3, 4, 5].map(controller => (
                  <tr key={controller}>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-white text-xs font-bold ${CONTROLLER_COLORS[controller]}`}>
                        {controller + 1}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={controllerConfigs[controller]?.driverId || ''}
                        onChange={(e) => handleControllerChange(controller, 'driverId', e.target.value)}
                        disabled={!canEdit}
                        className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-yellow-500 focus:border-transparent text-sm disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="">---</option>
                        {getAvailableDrivers(controller).map(driver => (
                          <option key={driver.id} value={driver.id}>
                            {driver.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={controllerConfigs[controller]?.carId || ''}
                        onChange={(e) => handleControllerChange(controller, 'carId', e.target.value)}
                        disabled={!canEdit}
                        className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-yellow-500 focus:border-transparent text-sm disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="">---</option>
                        {getAvailableCars(controller).map(car => (
                          <option key={car.id} value={car.id}>
                            {car.brand} {car.model}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Status radio (only for draft/ready) */}
        {canEdit && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Statut
            </label>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="status"
                  value="draft"
                  checked={status === 'draft'}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-4 h-4 text-yellow-600 focus:ring-yellow-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Brouillon</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="status"
                  value="ready"
                  checked={status === 'ready'}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Pret</span>
              </label>
            </div>
          </div>
        )}

        {/* Action buttons row */}
        <div className="flex items-center justify-between pt-4 border-t dark:border-gray-700">
          <div className="flex items-center gap-2">
            {canDelete && !isPractice && (
              <button
                onClick={handleDelete}
                className="flex items-center gap-1.5 px-3 py-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors text-sm"
              >
                <TrashIcon className="w-4 h-4" />
                Supprimer
              </button>
            )}
            {canReset && (
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 px-3 py-1.5 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/30 rounded-lg transition-colors text-sm"
              >
                <ArrowPathIcon className="w-4 h-4" />
                Reinitialiser
              </button>
            )}
          </div>

          <ModalFooter>
            <ModalButton variant="secondary" onClick={onClose}>
              Annuler
            </ModalButton>
            <ModalButton
              variant="primary"
              onClick={handleSave}
              disabled={saving || (!canEdit && !isFinished)}
            >
              {saving ? 'Sauvegarde...' : 'Enregistrer'}
            </ModalButton>
          </ModalFooter>
        </div>
      </div>
    </Modal>
  )
}
