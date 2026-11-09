import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import SessionDriverRow from './SessionDriverRow'
import { nextController } from './sessionFormData'

/** The session's line-up: one row per controller used, up to the controllers available. */
export default function SessionLineUp({ rows, onRowsChange, drivers, cars, availableSlots }) {
  const { t } = useTranslation('sessions')

  const add = () =>
    onRowsChange([
      ...rows,
      { driverId: '', carId: '', controller: nextController(rows, availableSlots), gridPos: null, position: null },
    ])
  const remove = (index) => onRowsChange(rows.filter((_, i) => i !== index))
  const change = (index, field, value) => onRowsChange(rows.map((r, i) => (i === index ? { ...r, [field]: value } : r)))

  return (
    <div className="space-y-4" data-testid="session-line-up">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-gray-900 dark:text-white">{t('glossary:driver', { count: 2 })}</h3>
          <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full font-medium">
            {t('form.slots', { count: rows.length, total: availableSlots })}
          </span>
        </div>
        <button
          type="button"
          onClick={add}
          disabled={rows.length >= availableSlots}
          className="px-3 py-2 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-900/70 transition-colors flex items-center gap-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" />
          {t('common:add')}
        </button>
      </div>

      <div className="space-y-3">
        {rows.map((row, index) => (
          <SessionDriverRow
            key={index}
            row={row}
            drivers={drivers}
            cars={cars}
            availableSlots={availableSlots}
            usedControllers={rows.filter((_, i) => i !== index).map((r) => r.controller)}
            onChange={(field, value) => change(index, field, value)}
            onRemove={() => remove(index)}
          />
        ))}

        {rows.length === 0 && (
          <p className="text-gray-500 dark:text-gray-400 text-sm text-center py-4">{t('form.noDriversAdded')}</p>
        )}
      </div>
    </div>
  )
}
