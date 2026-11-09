/**
 * The Control Unit only knows 10 levels per setting (manual 30352), sent as a
 * 4-bit value. Stepping by 10 keeps the familiar percentage while making every
 * position match one real level: 70 % is level 7, and nothing exists between.
 */
export default function CarLevelField({
  label,
  value,
  onChange,
  min = 10,
  max = 100,
  step = 10,
  color = 'var(--color-primary)',
}) {
  const level = Math.round(value / 10)
  // The filled part follows the thumb, so the track reads as a gauge
  const filled = ((value - min) / (max - min)) * 100
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value))}
          className="flex-1 h-2 rounded-full appearance-none cursor-pointer"
          style={{
            accentColor: color,
            background: `linear-gradient(to right, ${color} 0%, ${color} ${filled}%, var(--color-muted) ${filled}%, var(--color-muted) 100%)`,
          }}
        />
        <span className="text-sm font-medium w-12 text-right tabular-nums">
          {level}
          <span className="text-muted-foreground">/10</span>
        </span>
      </div>
    </div>
  )
}
