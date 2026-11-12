import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, GripVertical } from 'lucide-react'
import { SessionType, sessionTypeAbbrKey } from '@racehubos/shared'
import DriverToken, { DropGhost } from './DriverToken'
import { useDragAndDrop } from './useDragAndDrop'
import WizardLimitsCard from './WizardLimitsCard'
import { CountField, Refusal } from './wizardFields'
import {
  benchOf,
  carLookup,
  MAX_GROUPS,
  MAX_PRACTICES,
  maxDuration,
  maxLaps,
  moveSession,
  placeDriver,
  refusalMessage,
  sessionsOfType,
  setSessionCount,
} from './wizardPlan'

const TYPES = [
  { type: SessionType.PRACTICE, labelKey: 'wizard.practiceCount', tone: 'purple', max: MAX_PRACTICES },
  { type: SessionType.QUALIF, labelKey: 'wizard.qualifications', tone: 'blue', max: MAX_GROUPS },
  { type: SessionType.RACE, labelKey: 'wizard.races', tone: 'green', max: MAX_GROUPS },
]
const COLORS = {
  [SessionType.PRACTICE]: 'text-session-practice',
  [SessionType.QUALIF]: 'text-session-qualif',
  [SessionType.RACE]: 'text-session-race',
}
const BADGES = {
  [SessionType.PRACTICE]: 'bg-session-practice',
  [SessionType.QUALIF]: 'bg-session-qualif',
  [SessionType.RACE]: 'bg-session-race',
}

/**
 * The championship planned by hand, starting from what the automatic mode would run: the sessions
 * side by side in running order, each with its six controllers. Drivers are dragged between
 * controllers, sessions and the drivers set aside; a session is dragged by its header. The place
 * hovered shows where the driver would land (in red when refused), a bar where a session would go.
 */
export default function WizardManualConfig({ config, participants, plan, onConfigChange, onPlanChange }) {
  const { t } = useTranslation('championships')
  const { dragged, over, source, target } = useDragAndDrop() // { driverId, from } | { session }
  const [refusal, setRefusal] = useState(null)
  const [editing, setEditing] = useState(null)
  const byId = new Map(participants.map((p) => [p.driverId, p]))
  const nameOf = (driverId) => byId.get(driverId)?.driver.name
  const carOf = carLookup(participants)
  const bench = benchOf(plan, participants)
  const abbr = (type) => t(sessionTypeAbbrKey(type))
  const isDriver = (item) => item.driverId !== undefined
  const isSession = (item) => item.session !== undefined

  function limitsText(limits) {
    const parts = [
      maxDuration(limits) && `${limits.duration} ${t('configModal.fields.minUnit')}`,
      maxLaps(limits) && `${limits.laps} ${t('configModal.fields.lapsUnit')}`,
    ].filter(Boolean)
    return parts.length ? parts.join(' / ') : t('wizard.noLimit')
  }

  function dropDriver({ driverId, from }, to) {
    const result = placeDriver(plan, driverId, from, to, carOf)
    if (result.refused) {
      setRefusal(refusalMessage(result.refused, nameOf(driverId), nameOf(result.with)))
      return
    }
    setRefusal(null)
    onPlanChange(result.plan)
  }

  // What dropping the dragged driver on controller `slot` of session `s` would do, while hovered
  function landing(s, slot) {
    if (!dragged || !isDriver(dragged) || over !== `slot:${s}:${slot}`) return null
    const { driverId, from } = dragged
    if (from?.session === s && from.slot === slot) return null
    const occupant = plan[s].slots[slot]
    const result = placeDriver(plan, driverId, from, { session: s, slot }, carOf)
    // The occupant swaps only when free to take the driver's place, else goes aside
    const swapped = occupant && from && result.plan?.[from.session].slots[from.slot] === occupant
    return { name: nameOf(driverId), swapWith: swapped ? nameOf(occupant) : undefined, refused: result.refused }
  }

  const token = (driverId, from) => (
    <DriverToken
      participant={byId.get(driverId)}
      drag={source({ driverId, from })}
      dragging={dragged?.driverId === driverId && dragged.from?.session === from?.session}
      onRemove={from ? () => onPlanChange(placeDriver(plan, driverId, from, null).plan) : undefined}
    />
  )

  const benchHovered = dragged && isDriver(dragged) && dragged.from && over === 'bench'

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        {TYPES.map(({ type, labelKey, max }) => (
          <div key={type} className={`w-44 font-semibold ${COLORS[type]}`}>
            <CountField
              label={t(labelKey)}
              value={sessionsOfType(plan, type).length}
              min={0}
              max={max}
              onChange={(count) => onPlanChange(setSessionCount(plan, type, count))}
            />
          </div>
        ))}
        {TYPES.map(({ type }) => (
          <button
            key={type}
            type="button"
            aria-expanded={editing === type}
            onClick={() => setEditing(editing === type ? null : type)}
            className={`flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs ${COLORS[type]}`}
          >
            {t('wizard.limitsOf', { type: abbr(type), limits: limitsText(config[type]) })}
            <ChevronDown aria-hidden="true" className="size-3" />
          </button>
        ))}
      </div>
      {editing && (
        <WizardLimitsCard
          testId={`championship-wizard-${editing}-limits`}
          title={t(TYPES.find((type) => type.type === editing).labelKey)}
          tone={TYPES.find((type) => type.type === editing).tone}
          limits={config[editing]}
          onChange={(limits) => onConfigChange({ ...config, [editing]: limits })}
          hint={editing === SessionType.PRACTICE ? t('wizard.practiceLimitsHint') : undefined}
        />
      )}

      <div
        data-testid="championship-wizard-bench"
        {...target('bench', isDriver, (item) => dropDriver(item, null))}
        className={`flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-colors ${
          benchHovered
            ? 'border-primary ring-2 ring-primary/40 bg-primary/5'
            : 'border-dashed border-muted-foreground/40 bg-muted/30'
        }`}
      >
        <span className="font-semibold">{t('wizard.aside')}</span>
        {bench.map((p) => (
          <div key={p.driverId} className="w-40">
            {token(p.driverId, null)}
          </div>
        ))}
        {benchHovered && (
          <div className="w-40">
            <DropGhost name={nameOf(dragged.driverId)} />
          </div>
        )}
        <span className="text-muted-foreground">{bench.length ? t('wizard.asideHint') : t('wizard.asideEmpty')}</span>
      </div>

      <div className="flex gap-2 overflow-x-auto px-1 pb-2">
        {plan.map((session, s) => {
          const rank = sessionsOfType(plan.slice(0, s + 1), session.type).length
          const placed = session.slots.filter(Boolean).length
          // A session dropped here takes this place: after this one when it comes from before it
          const insertion =
            dragged && isSession(dragged) && dragged.session !== s && over === `lane:${s}`
              ? dragged.session < s
                ? '-right-1.5'
                : '-left-1.5'
              : null
          return (
            <div
              key={session.key}
              data-testid="championship-wizard-session"
              {...target(`lane:${s}`, isSession, (item) => onPlanChange(moveSession(plan, item.session, s)))}
              className={`relative w-40 shrink-0 rounded-lg border bg-card transition-opacity ${
                dragged?.session === s ? 'border-primary border-dashed opacity-40' : 'border-border'
              }`}
            >
              {insertion && (
                <span
                  data-testid="championship-wizard-insertion"
                  aria-hidden="true"
                  className={`absolute inset-y-0 ${insertion} w-1 rounded-full bg-primary`}
                />
              )}
              <div
                {...source({ session: s })}
                className="flex items-center gap-1.5 border-b border-border px-2 py-1.5 cursor-grab"
              >
                <GripVertical aria-hidden="true" className="size-3 text-muted-foreground" />
                <span className={`rounded px-1.5 py-0.5 text-xs font-bold text-white ${BADGES[session.type]}`}>
                  {abbr(session.type)}
                  {rank}
                </span>
                <span className="ml-auto text-[11px] text-muted-foreground">{placed} / 6</span>
              </div>
              <div className="space-y-1 p-1.5">
                {session.slots.map((driverId, k) => {
                  const landed = landing(s, k)
                  const ring = landed
                    ? landed.refused
                      ? 'ring-2 ring-destructive/40 bg-destructive/5'
                      : 'ring-2 ring-primary/40 bg-primary/5'
                    : ''
                  return (
                    <div
                      key={k}
                      data-testid="championship-wizard-slot"
                      {...target(`slot:${s}:${k}`, isDriver, (item) => dropDriver(item, { session: s, slot: k }))}
                      className={`flex items-center gap-1 rounded-md transition-colors ${ring}`}
                    >
                      <span className="w-2.5 text-center text-[10px] text-muted-foreground">{k + 1}</span>
                      <div className="flex-1 min-w-0">
                        {landed ? (
                          <DropGhost {...landed} />
                        ) : driverId ? (
                          token(driverId, { session: s, slot: k })
                        ) : (
                          <div className="rounded-md border border-dashed border-border px-1.5 py-1 text-[11px] text-muted-foreground">
                            {t('wizard.freeController')}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
      <Refusal message={refusal} />
    </div>
  )
}
