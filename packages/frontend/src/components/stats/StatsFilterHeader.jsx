import { useContext } from 'react'
import { FilterHeader } from '@/components/ui/filter-header'
import { StatsFilterContext } from './statsFilterContext'

/**
 * A laps column header filtering on `column.columnDef.meta.filter`. The filters come from the context,
 * so the header stays the same component while they change and its menu stays open.
 */
export default function StatsFilterHeader({ column }) {
  const { filters, setFilter, options } = useContext(StatsFilterContext)
  const { filter, label } = column.columnDef.meta
  const value = filters[filter] || []
  return (
    <FilterHeader
      column={column}
      label={label}
      active={value.length > 0}
      value={value}
      options={options[filter] || []}
      onChange={(v) => setFilter(filter, v)}
    />
  )
}
