import { useTranslation } from 'react-i18next'
import { AnimatePresence, motion } from 'framer-motion'
import DriverToken, { DropGhost } from './DriverToken'
import { WithdrawnToken } from './FrozenSession'
import { useDragAndDrop } from './useDragAndDrop'
import { Refusal } from './wizardFields'
import { carLookup, leftOut, moveInGroups, refusalMessage } from './wizardPlan'

// A group added unfolds where it goes, removed folds away; the others slide to close the gap
const UNFOLD = {
  layout: 'position',
  initial: { opacity: 0, scale: 0.96, y: -6 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.96 },
  transition: { type: 'spring', bounce: 0, duration: 0.35 },
}

const TONES = {
  purple: { border: 'border-purple-200 dark:border-purple-800', label: 'text-session-practice' },
  blue: { border: 'border-blue-200 dark:border-blue-800', label: 'text-session-qualif' },
}

/**
 * Sessions of one kind as groups of drivers, named `label` and their number, from `first`. A driver
 * dragged onto another group joins it unless the move is refused: `onRefuse` gets why and where
 * (`{ at, key, vars }`, null once a move is made), and `refusal` shows under the group it names. The
 * group hovered shows where the driver would land, in red when they can't. Dealt again, each driver
 * glides to their new group. With `keepOne`, no group is ever
 * emptied. `withdrawn[g]`: the retired drivers DNF in group `g`, shown after its drivers. With `out`
 * (`{ label, testId }`), a driver may be in no group: those are listed after the groups, where a driver
 * dragged leaves them.
 */
export default function WizardGroups({
  groups,
  label,
  first = 1,
  withdrawn = [],
  tone,
  perGroup,
  keepOne,
  participants,
  testId,
  out,
  refusal,
  onChange,
  onRefuse,
}) {
  const { t } = useTranslation('championships')
  const { dragged, over, lifted, overlay, source, target } = useDragAndDrop()
  const byId = new Map(participants.map((p) => [p.driverId, p]))
  const move = (driverId, to) => moveInGroups(groups, driverId, to, perGroup, carLookup(participants), { keepOne })
  const nameOf = (driverId) => byId.get(driverId)?.driver.name

  const keyOf = (driverId) => `${testId}:${driverId}`
  const token = (driverId) => {
    const key = keyOf(driverId)
    const participant = byId.get(driverId)
    return (
      <DriverToken
        key={driverId}
        participant={participant}
        // The one let go lands from where it was dropped: it does not glide too
        layoutId={lifted === key ? undefined : key}
        drag={source(driverId, key, <DriverToken participant={participant} />)}
        dragging={lifted === key}
      />
    )
  }

  // Where the driver now lies, or false when the move is refused
  function drop(driverId, to) {
    const result = move(driverId, to)
    if (result.refused) {
      onRefuse({ at: `${testId}:${to}`, ...refusalMessage(result.refused, nameOf(driverId), nameOf(result.with)) })
      return false
    }
    onRefuse(null)
    onChange(result.groups)
    return keyOf(driverId)
  }

  const outside = out ? leftOut(groups, participants) : []
  const outHovered = dragged !== null && over === 'out' && groups.some((group) => group.includes(dragged))

  const lanes = groups.map((group, g) => {
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
      <motion.div
        key={g}
        data-testid={testId}
        {...UNFOLD}
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
            {first + g}
          </span>
          <span className="text-muted-foreground">
            {group.length} / {perGroup}
          </span>
        </div>
        {group.map(token)}
        {(withdrawn[g] ?? []).map((r) => (
          <WithdrawnToken key={r.driverId} driver={r.driver} />
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
        {refusal?.at === `${testId}:${g}` && <Refusal message={refusal} />}
      </motion.div>
    )
  })

  // Shown once a driver is in no group, or while one could be dragged there; the groups stay mounted
  const showOut = out && groups.length > 0 && (outside.length > 0 || dragged !== null)
  return (
    <>
      {overlay}
      <AnimatePresence initial={false}>
        {lanes}
        {showOut && (
          <motion.div
            key="out"
            data-testid={out.testId}
            {...UNFOLD}
            {...target(
              'out',
              () => true,
              (driverId) => drop(driverId, null)
            )}
            className={`rounded-lg border border-dashed p-2 space-y-1 transition-colors ${
              outHovered
                ? 'border-primary ring-2 ring-primary/40 bg-primary/5'
                : 'border-muted-foreground/40 bg-muted/30'
            }`}
          >
            <div className="flex justify-between px-1 text-xs">
              <span className="font-semibold">{out.label}</span>
              <span className="text-muted-foreground">{outside.length}</span>
            </div>
            {outside.map((p) => token(p.driverId))}
            {outHovered && <DropGhost name={nameOf(dragged)} />}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
