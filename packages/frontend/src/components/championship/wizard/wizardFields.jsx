import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'

/** Keeps `value` a whole number from `min` to `max`; anything else becomes `min`. */
const clampCount = (value, min, max) => Math.max(min, Math.min(max, parseInt(value) || min))

/** A number of sessions or drivers, its label on the left and an optional `hint` after it. */
export function CountField({ label, hint, value, min, max, onChange }) {
  return (
    <label className="flex items-center justify-between gap-2 text-xs text-foreground/80">
      <span>
        {label}
        {hint && <span className="text-muted-foreground"> · {hint}</span>}
      </span>
      <Input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(clampCount(e.target.value, min, max))}
        className="w-14 h-7 text-center"
      />
    </label>
  )
}

/** Why a drop was refused, read out as it appears. */
export function Refusal({ message }) {
  const { t } = useTranslation('championships')
  return (
    <p role="status" className="min-h-4 text-xs text-destructive">
      {message && t(message.key, message.vars)}
    </p>
  )
}
