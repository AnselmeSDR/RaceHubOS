import { FormField } from './FormModal'

/**
 * Range slider field with label showing current value
 */
export default function RangeField({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  unit = '%',
  color = '#3B82F6'
}) {
  return (
    <FormField label={`${label} (${value}${unit})`}>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value))}
          className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
          style={{
            accentColor: color
          }}
        />
        <span
          className="text-sm font-bold w-12 text-right"
          style={{ color }}
        >
          {value}{unit}
        </span>
      </div>
    </FormField>
  )
}
