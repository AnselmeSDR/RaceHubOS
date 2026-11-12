import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import { DivisionScope } from '@racehubos/shared'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import DivisionBadge from './DivisionBadge'

/** How many drivers a division holds, or cars a category, out of the bin. */
const membersOf = (division) => division._count?.[division.scope === DivisionScope.CAR ? 'cars' : 'drivers'] ?? 0

/**
 * None, one or several of `divisions` (ids in `value`): the chosen ones as removable badges, the others
 * ticked in a menu, from the highest rank, with how many drivers or cars each holds. `label` names the add button for screen readers.
 */
export default function DivisionPicker({ divisions, value, onChange, label, testId }) {
  const { t } = useTranslation('divisions')
  const chosen = divisions.filter((division) => value.includes(division.id))
  const toggle = (id) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id])

  return (
    <div data-testid={testId} className="flex flex-wrap items-center gap-1.5">
      {chosen.map((division) => (
        <DivisionBadge key={division.id} division={division} large onRemove={() => toggle(division.id)} />
      ))}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={label}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-muted-foreground/40 px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground hover:border-foreground/40"
          >
            <Plus aria-hidden="true" className="size-3" />
            {chosen.length === 0 && t('add')}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56 max-h-72 overflow-y-auto">
          {divisions.map((division) => (
            <DropdownMenuCheckboxItem
              key={division.id}
              checked={value.includes(division.id)}
              onCheckedChange={() => toggle(division.id)}
              onSelect={(e) => e.preventDefault()}
            >
              <DivisionBadge division={division} />
              <span className="flex-1" />
              <span
                className="text-[11px] text-muted-foreground tabular-nums"
                title={t(division.scope === DivisionScope.CAR ? 'picker.cars' : 'picker.drivers', {
                  count: membersOf(division),
                })}
              >
                {membersOf(division)}
              </span>
            </DropdownMenuCheckboxItem>
          ))}
          {divisions.length === 0 && <p className="px-2 py-1.5 text-xs text-muted-foreground">{t('noneYet')}</p>}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
