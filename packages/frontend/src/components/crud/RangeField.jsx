import { FormField } from './FormModal'

/**
 * The Control Unit only knows 10 levels per setting, sent as a 4-bit value.
 * Stepping by 10 keeps the familiar percentage while making every position
 * match one real level: 70 % is level 7, and nothing in between exists.
 */
export default function RangeField({
  label,
  value,
  onChange,
  min = 10,
  max = 100,
  step = 10,
}) {
  // The filled part follows the thumb, so the track reads as a gauge
  const filled = ((value - min) / (max - min)) * 100

  return (
    <FormField label={`${label} (${Math.round(value / 10)}/10)`}>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value))}
          className="flex-1 h-2 rounded-lg appearance-none cursor-pointer accent-primary"
          style={{
            background: `linear-gradient(to right, var(--color-primary) 0%, var(--color-primary) ${filled}%, var(--color-muted) ${filled}%, var(--color-muted) 100%)`,
          }}
        />
        <span className="text-sm font-bold w-12 text-right text-foreground tabular-nums">
          {Math.round(value / 10)}<span className="text-muted-foreground">/10</span>
        </span>
      </div>
    </FormField>
  )
}
