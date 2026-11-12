import { useTranslation } from 'react-i18next'
import DriverToken, { DropGhost } from './DriverToken'
import { useDragAndDrop } from './useDragAndDrop'
import { carLookup, moveInGroups, refusalMessage } from './wizardPlan'

const TONES = {
  purple: { border: 'border-purple-200 dark:border-purple-800', label: 'text-session-practice' },
  blue: { border: 'border-blue-200 dark:border-blue-800', label: 'text-session-qualif' },
}

/**
 * Sessions of one kind as groups of drivers, named `label` and their number. A driver dragged onto
 * another group joins it unless the move is refused (`onRefuse` gets why); the group hovered shows
 * where the driver would land, in red when they can't. With `keepOne`, no group is ever emptied.
 */
export default function WizardGroups({
  groups,
  label,
  tone,
  perGroup,
  keepOne,
  participants,
  testId,
  onChange,
  onRefuse,
}) {
  const { t } = useTranslation('championships')
  const { dragged, over, source, target } = useDragAndDrop()
  const byId = new Map(participants.map((p) => [p.driverId, p]))
  const move = (driverId, to) => moveInGroups(groups, driverId, to, perGroup, carLookup(participants), { keepOne })
  const nameOf = (driverId) => byId.get(driverId)?.driver.name

  function drop(driverId, to) {
    const result = move(driverId, to)
    if (result.refused) {
      onRefuse(refusalMessage(result.refused, nameOf(driverId), nameOf(result.with)))
      return
    }
    onRefuse(null)
    onChange(result.groups)
  }

  return groups.map((group, g) => {
    const hovered = dragged !== null && over === g && !group.includes(dragged)
    const refused = hovered && move(dragged, g).refused
    const outline = hovered
      ? refused
        ? 'border-destructive ring-2 ring-destructive/30 bg-destructive/5'
        : 'border-primary ring-2 ring-primary/40 bg-primary/5'
      : dragged !== null
        ? 'border-dashed border-primary/50'
        : TONES[tone].border
    return (
      <div
        key={g}
        data-testid={testId}
        {...target(
          g,
          () => true,
          (driverId) => drop(driverId, g)
        )}
        className={`rounded-lg border p-2 space-y-1 transition-colors ${outline}`}
      >
        <div className="flex justify-between px-1 text-xs">
          <span className={`font-semibold ${TONES[tone].label}`}>
            {label}
            {g + 1}
          </span>
          <span className="text-muted-foreground">
            {group.length} / {perGroup}
          </span>
        </div>
        {group.map((driverId) => (
          <DriverToken
            key={driverId}
            participant={byId.get(driverId)}
            drag={source(driverId)}
            dragging={dragged === driverId}
          />
        ))}
        {hovered ? (
          <DropGhost name={nameOf(dragged)} refused={refused} />
        ) : (
          group.length < perGroup && (
            <div className="rounded-md border border-dashed border-border px-2 py-1 text-[11px] text-muted-foreground">
              {t('wizard.freePlace')}
            </div>
          )
        )}
      </div>
    )
  })
}
