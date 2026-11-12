import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { DivisionScope } from '@racehubos/shared'
import { divisionColor, textOn, textOnDark, textOnWhite } from '@/lib/colors'

/**
 * A division's badge, its short name or else its name: a driver division filled with its colour, a
 * car category outlined in it on a transparent background, its text readable in both themes. `faded`
 * for one outside a filter, `onRemove` adds a cross.
 */
export default function DivisionBadge({ division, large = false, faded = false, onRemove }) {
  const { t } = useTranslation('divisions')
  const color = divisionColor(division)
  const label = division.shortName || division.name
  const category = division.scope === DivisionScope.CAR
  const style = category
    ? { borderColor: color, '--ink': textOnWhite(color), '--ink-dark': textOnDark(color) }
    : { backgroundColor: color, color: textOn(color) }
  return (
    <span
      data-testid="division-badge"
      title={division.name}
      style={style}
      className={`inline-flex min-w-0 max-w-full items-center gap-1 rounded-full font-extrabold tracking-wide whitespace-nowrap leading-[18px] ${
        large ? 'text-xs px-2.5 py-0.5' : 'text-[11px] px-2 py-px'
      } ${category ? 'border-[1.5px] text-(--ink) dark:text-(--ink-dark)' : ''} ${faded ? 'opacity-45' : ''}`}
    >
      {/* A long name is cut, read whole in the title */}
      <span className="truncate">{label}</span>
      {onRemove && (
        <button
          type="button"
          aria-label={t('remove', { name: label })}
          onClick={onRemove}
          className="opacity-60 hover:opacity-100"
        >
          <X aria-hidden="true" className="size-3" />
        </button>
      )}
    </span>
  )
}

/** The badges of `divisions`, nothing without one. */
export function DivisionBadges({ divisions, className = 'flex flex-wrap items-center gap-1', ...props }) {
  if (!divisions?.length) return null
  // min-w-0: a long name is cut rather than widening its row
  return (
    <span className={`min-w-0 max-w-full ${className}`}>
      {divisions.map((division) => (
        <DivisionBadge key={division.id} division={division} {...props} />
      ))}
    </span>
  )
}
