import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { Tooltip } from 'radix-ui'
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

/** How many more divisions there are, shown in a bubble when hovered or focused. */
function MoreDivisions({ divisions, ...props }) {
  const { t } = useTranslation('divisions')
  return (
    <Tooltip.Provider delayDuration={0}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <span
            tabIndex={0}
            data-testid="division-more"
            aria-label={t('more', { count: divisions.length })}
            className="shrink-0 rounded-full bg-muted px-2 py-px text-[11px] font-extrabold leading-[18px] text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            +{divisions.length}
          </span>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="bottom"
            align="start"
            sideOffset={4}
            className="z-50 flex flex-col items-start gap-1 rounded-lg border border-border bg-popover p-2 shadow-lg"
          >
            {divisions.map((division) => (
              <DivisionBadge key={division.id} division={division} {...props} />
            ))}
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  )
}

/** The badges of `divisions`, nothing without one; past `max`, the others wait behind a "+n". */
export function DivisionBadges({ divisions, max, className = 'flex flex-wrap items-center gap-1', ...props }) {
  if (!divisions?.length) return null
  const shown = max == null ? divisions : divisions.slice(0, max)
  // min-w-0: a long name is cut rather than widening its row
  return (
    <span className={`min-w-0 max-w-full ${className}`}>
      {shown.map((division) => (
        <DivisionBadge key={division.id} division={division} {...props} />
      ))}
      {shown.length < divisions.length && <MoreDivisions divisions={divisions.slice(shown.length)} {...props} />}
    </span>
  )
}
