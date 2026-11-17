import { useId } from 'react'
import { motion } from 'framer-motion'

/**
 * A choice between a few values, all in sight: the pill glides to the one picked. `options` are
 * `{ value, label }`, `label` names the group.
 */
export default function Segmented({ options, value, onChange, label }) {
  const pill = useId()
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg bg-muted p-0.5">
      {options.map((option) => {
        const on = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => !on && onChange(option.value)}
            className={`relative h-7 rounded-md px-3 text-xs font-medium transition-colors ${on ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {on && (
              <motion.span
                layoutId={pill}
                transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
                className="absolute inset-0 rounded-md bg-background shadow-sm"
              />
            )}
            <span className="relative">{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}
