import { useTranslation } from 'react-i18next'
import { Trash2 } from 'lucide-react'

const SELECT =
  'px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-600 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm'

/**
 * One line-up row: driver, car, controller (those of the other rows disabled) and grid position.
 * `onChange(field, value)` changes it.
 */
export default function SessionDriverRow({ row, drivers, cars, availableSlots, usedControllers, onChange, onRemove }) {
  const { t } = useTranslation('sessions')

  return (
    <div className="flex gap-3 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg" data-testid="session-driver-row">
      <select
        value={row.driverId}
        onChange={(e) => onChange('driverId', e.target.value)}
        className={`flex-1 ${SELECT}`}
      >
        <option value="">{t('glossary:driver', { count: 1 })}</option>
        {drivers.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>

      <select value={row.carId} onChange={(e) => onChange('carId', e.target.value)} className={`flex-1 ${SELECT}`}>
        <option value="">{t('glossary:car', { count: 1 })}</option>
        {cars.map((c) => (
          <option key={c.id} value={c.id}>
            {c.brand} {c.model}
          </option>
        ))}
      </select>

      <select
        value={row.controller}
        onChange={(e) => onChange('controller', e.target.value)}
        className={`w-24 ${SELECT}`}
      >
        <option value="">{t('form.controllerShort')}</option>
        {Array.from({ length: availableSlots }, (_, i) => i + 1).map((slot) => {
          const isUsed = usedControllers.includes(String(slot))
          return (
            <option key={slot} value={slot} disabled={isUsed}>
              {slot} {isUsed ? t('form.controllerUsed') : ''}
            </option>
          )
        })}
      </select>

      <input
        type="number"
        value={row.gridPos || ''}
        onChange={(e) => onChange('gridPos', e.target.value ? parseInt(e.target.value) : null)}
        placeholder={t('form.gridPlaceholder')}
        className={`w-20 ${SELECT}`}
      />

      <button
        type="button"
        onClick={onRemove}
        className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
      >
        <Trash2 className="w-5 h-5" />
      </button>
    </div>
  )
}
