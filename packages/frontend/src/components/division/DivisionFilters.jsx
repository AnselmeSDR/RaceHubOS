import { useTranslation } from 'react-i18next'
import { Car, Medal } from 'lucide-react'
import DivisionPicker from './DivisionPicker'

/**
 * The divisions and categories a championship is run for (`filter` from `useDivisionFilter`), one row
 * each; `onChange` gets every id chosen, both scopes together.
 */
export default function DivisionFilters({ filter, onChange, hint }) {
  const { t } = useTranslation('divisions')
  const rows = [
    {
      key: 'divisions',
      Icon: Medal,
      tone: 'text-purple-600',
      label: t('filters.divisions'),
      divisions: filter.divisions,
      value: filter.driverIds,
      change: (ids) => onChange([...ids, ...filter.carIds]),
      addLabel: t('addDivision'),
    },
    {
      key: 'categories',
      Icon: Car,
      tone: 'text-green-600',
      label: t('filters.categories'),
      divisions: filter.categories,
      value: filter.carIds,
      change: (ids) => onChange([...filter.driverIds, ...ids]),
      addLabel: t('addCategory'),
    },
  ]
  return (
    <div data-testid="division-filters" className="rounded-lg border border-border bg-muted/30 px-3 py-2 space-y-1.5">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        {rows.map(({ key, Icon, tone, label, divisions, value, change, addLabel }) => (
          <div key={key} className="flex flex-wrap items-center gap-2 text-sm font-medium">
            <Icon aria-hidden="true" className={`size-4 ${tone}`} />
            {label}
            <DivisionPicker
              testId={`division-filter-${key}`}
              divisions={divisions}
              value={value}
              onChange={change}
              label={addLabel}
            />
          </div>
        ))}
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
