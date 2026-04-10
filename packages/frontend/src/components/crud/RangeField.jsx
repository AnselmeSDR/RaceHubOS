import { FormField } from './FormModal'

export default function RangeField({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  unit = '%',
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
          className="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
        />
        <span className="text-sm font-bold w-12 text-right text-foreground">
          {value}{unit}
        </span>
      </div>
    </FormField>
  )
}
