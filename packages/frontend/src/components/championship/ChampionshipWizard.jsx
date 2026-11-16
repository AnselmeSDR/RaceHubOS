import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Flag, RefreshCw, Trophy } from 'lucide-react'
import { ChampionshipMode, ChampionshipStatus, sessionTypeAbbrKey } from '@racehubos/shared'
import { Button } from '@/components/ui/button'
import { getData } from '@/lib/sessionApi'
import Modal, { ModalFooter } from '../ui/Modal'
import ErrorMessage from '../ErrorMessage'
import WizardConfigStep from './wizard/WizardConfigStep'
import WizardInfoStep from './wizard/WizardInfoStep'
import WizardParticipantsStep from './wizard/WizardParticipantsStep'
import WizardSteps from './wizard/WizardSteps'
import {
  championshipBody,
  createChampionship,
  dealtPracticeGroups,
  dealtQualifGroups,
  DEFAULT_WIZARD_CONFIG,
  editBody,
  editState,
  holdsEachOnce,
  isConfigValid,
  planFromAuto,
  prunePlan,
  retiredOf,
  saveChampionshipEdit,
  stillToQualify,
  stillToRace,
  withdrawnIn,
  WIZARD_STEPS,
} from './wizard/wizardPlan'

// What deals the groups again when it changes: the line-up and their cars, with the group size or count
const lineUpKey = (participants) => participants.map((p) => `${p.driverId}:${p.carId ?? ''}`).join(',')

// Groups as dealt, or as moved by hand while what dealt them stays the same
const groupsFor = (moved, key, deal) => (moved?.key === key ? moved.groups : deal())

// A step comes in from the side it lies on and leaves by the other: the same path both ways
const STEP_MOTION = {
  enter: (direction) => ({ x: 40 * direction, opacity: 0 }),
  shown: { x: 0, opacity: 1 },
  leave: (direction) => ({ x: -40 * direction, opacity: 0 }),
}
const STEP_SPRING = { type: 'spring', bounce: 0, duration: 0.35 }

// The buttons stay at hand at the bottom of the window, the steps scrolling under them. A sticky
// element stops at the scroll padding: `-bottom-6` takes it down to the edge.
const FOOTER =
  'sticky -bottom-6 z-10 -mx-6 -mb-6 mt-6 px-6 pb-6 bg-card/85 backdrop-blur-md backdrop-saturate-150 before:pointer-events-none before:absolute before:inset-x-0 before:-top-6 before:h-6 before:bg-linear-to-b before:from-transparent before:to-card/85 reduced-transparency:bg-card reduced-transparency:backdrop-blur-none reduced-transparency:before:to-card'

/**
 * The groups of the sessions to come of an automatic championship being edited, kept as they are
 * while they still fit (each driver once, as many groups as would be dealt; a driver may run no
 * practice): [practices, qualifs].
 */
function keptGroups(initial) {
  if (initial?.mode !== ChampionshipMode.AUTO) return [null, null]
  const { participants, config, frozen } = initial
  const { practiceCount } = config
  const qualifiers = stillToQualify(participants, frozen)
  const qualifCount = dealtQualifGroups(qualifiers, config.driversPerQualif).length
  return [
    holdsEachOnce(initial.practiceGroups, participants, practiceCount, { everyone: false })
      ? { key: `${practiceCount}|${lineUpKey(participants)}`, groups: initial.practiceGroups }
      : null,
    holdsEachOnce(initial.qualifGroups, qualifiers, qualifCount)
      ? { key: `${config.driversPerQualif}|${lineUpKey(qualifiers)}`, groups: initial.qualifGroups }
      : null,
  ]
}

/**
 * Creates a championship in three steps: name and track, drivers and their cars, then the sessions,
 * dealt automatically or planned by hand from what the automatic mode dealt.
 *
 * Given a `championship` and its `sessions`, edits it instead, its three steps open at once: a session
 * that has started is shown as it ran and never changes; only those to come are planned. A driver who
 * raced and is taken out stays listed, retired, DNF in the sessions to come they were in.
 */
export default function ChampionshipWizard({
  tracks,
  onClose,
  onCreated,
  championship = null,
  sessions = [],
  drivers: knownDrivers,
  cars: knownCars,
  onSaved,
  onFinish,
  onReopen,
}) {
  const { t } = useTranslation('championships')
  const editing = !!championship
  const [initial] = useState(() => (editing ? editState(championship, sessions, knownCars) : null))
  const [step, setStep] = useState(0)
  const [open, setOpen] = useState(true) // closed, the window goes back where it came from, then `onClose`
  const close = () => setOpen(false)
  const [direction, setDirection] = useState(1)
  const stepsRef = useRef(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [drivers, setDrivers] = useState(knownDrivers ?? [])
  const [cars, setCars] = useState(knownCars ?? [])
  const [name, setName] = useState(initial?.name ?? '')
  const [trackId, setTrackId] = useState(initial?.trackId ?? '')
  const [participants, setParticipants] = useState(initial?.participants ?? [])
  const [divisionIds, setDivisionIds] = useState(initial?.divisionIds ?? []) // driver divisions and car categories
  const [config, setConfig] = useState(initial?.config ?? DEFAULT_WIZARD_CONFIG)
  const [mode, setMode] = useState(initial?.mode ?? ChampionshipMode.AUTO)
  const [kept] = useState(() => keptGroups(initial))
  const [movedPractices, setMovedPractices] = useState(kept[0]) // { key, groups } once a driver was moved
  const [movedGroups, setMovedGroups] = useState(kept[1])
  const [plan, setPlan] = useState(initial?.plan ?? null) // the manual mode's sessions

  useEffect(() => {
    if (!knownDrivers) getData('/api/drivers?limit=1000').then((data) => data && setDrivers(data))
    if (!knownCars) getData('/api/cars?limit=1000').then((data) => data && setCars(data))
  }, [knownDrivers, knownCars])

  const frozen = initial?.frozen ?? []
  const upcoming = initial?.upcoming ?? []
  const complete = participants.filter((p) => p.driverId)
  const retired = editing ? retiredOf(frozen, complete) : []
  const qualifiers = stillToQualify(complete, frozen)
  const practiceKey = `${config.practiceCount}|${lineUpKey(complete)}`
  const practiceGroups = groupsFor(movedPractices, practiceKey, () =>
    dealtPracticeGroups(complete, config.practiceCount)
  )
  const qualifKey = `${config.driversPerQualif}|${lineUpKey(qualifiers)}`
  const qualifGroups = groupsFor(movedGroups, qualifKey, () => dealtQualifGroups(qualifiers, config.driversPerQualif))
  const manual = mode === ChampionshipMode.MANUAL
  const finished = championship?.status === ChampionshipStatus.FINISHED

  // A session's label among all of its type, those that ran first: EL1, Q2…
  const ordered = [...frozen, ...upcoming]
  const labelOf = (session) =>
    `${t(sessionTypeAbbrKey(session.type))}${ordered.filter((s) => s.type === session.type).indexOf(session) + 1}`
  const retiredWhere = (driverId) =>
    upcoming
      .filter((s) => withdrawnIn(s, retired).some((r) => r.driverId === driverId))
      .map(labelOf)
      .join(', ')

  function changeParticipants(next) {
    setParticipants(next)
    const lineUp = next.filter((p) => p.driverId)
    if (plan) setPlan(prunePlan(plan, lineUp))
  }

  function changeMode(next) {
    setMode(next)
    if (next === ChampionshipMode.MANUAL) {
      const racers = stillToRace(complete, frozen)
      setPlan(planFromAuto({ participants: complete, config, practiceGroups, qualifGroups, racers }))
      return
    }
    setPlan(null)
    setMovedPractices(null)
    setMovedGroups(null)
  }

  const stepValid = [() => name.trim() && trackId, () => complete.length >= 2, () => isConfigValid(config, plan)]

  function goTo(next) {
    setDirection(next > step ? 1 : -1)
    setStep(next)
  }

  // The first wrong field of a step shown takes the focus and says why, on itself
  function reportInvalid(shown = step) {
    const field = stepsRef.current
      ?.querySelector(`[data-step="${shown}"]`)
      ?.querySelector('input:invalid, select:invalid, textarea:invalid')
    field?.focus()
    field?.reportValidity()
  }

  function next() {
    if (stepValid[step]()) goTo(step + 1)
    else reportInvalid()
  }

  // Creating or saving checks every step: the first one wrong opens, its field saying why
  function finish(save) {
    const wrong = stepValid.findIndex((valid) => !valid())
    if (wrong === -1) return save()
    if (wrong !== step) flushSync(() => goTo(wrong))
    reportInvalid(wrong)
  }

  const shape = () => ({
    name,
    trackId,
    divisionIds,
    participants: complete,
    config,
    mode,
    practiceGroups,
    qualifGroups,
    plan,
  })

  async function submit(send, done, failure) {
    setSaving(true)
    setError('')
    try {
      const data = await send()
      if (!data.success) {
        setError(data.error || t(failure))
        return
      }
      done(data.data)
      close()
    } catch {
      setError(t('wizard.connectionError'))
    } finally {
      setSaving(false)
    }
  }

  const handleCreate = () =>
    submit(
      () => createChampionship(championshipBody(shape())),
      (data) => onCreated?.(data),
      'wizard.createError'
    )
  const handleSave = () =>
    submit(
      () => saveChampionshipEdit(championship.id, editBody(shape())),
      (data) => onSaved?.(data),
      'wizard.saveError'
    )

  const size = ['3xl', '4xl'][step] ?? (manual ? '7xl' : '5xl')
  const title = editing ? `${t('wizard.editTitle')} · ${championship.name}` : t('wizard.title')

  return (
    <Modal
      open={open}
      onClose={close}
      onExitComplete={onClose}
      title={title}
      icon={<Trophy className="w-5 h-5 text-primary" />}
      size={size}
    >
      <WizardSteps step={step} onStep={goTo} open={editing} />

      {error && <ErrorMessage message={error} type="error" />}
      {finished && (
        <div className="mb-4 rounded-md border border-yellow-500/50 bg-yellow-500/10 px-3 py-2 text-xs">
          {t('configModal.finishedLocked')}
        </div>
      )}

      <div ref={stepsRef} className="relative">
        <AnimatePresence mode="popLayout" initial={false} custom={direction}>
          <motion.div
            key={step}
            data-step={step}
            custom={direction}
            variants={STEP_MOTION}
            initial="enter"
            animate="shown"
            exit="leave"
            transition={STEP_SPRING}
          >
            {step === 0 && (
              <WizardInfoStep
                name={name}
                trackId={trackId}
                tracks={tracks}
                ran={frozen.length}
                onNameChange={setName}
                onTrackChange={setTrackId}
              />
            )}
            {step === 1 && (
              <WizardParticipantsStep
                participants={participants}
                drivers={drivers}
                cars={cars}
                divisionIds={divisionIds}
                retired={retired}
                retiredWhere={retiredWhere}
                onDivisionsChange={setDivisionIds}
                onChange={changeParticipants}
                onRestore={(entry) => changeParticipants([...complete, entry])}
              />
            )}
            {step === 2 && (
              <WizardConfigStep
                mode={mode}
                config={config}
                participants={complete}
                qualifiers={qualifiers}
                practiceGroups={practiceGroups}
                qualifGroups={qualifGroups}
                plan={plan}
                frozen={frozen}
                upcoming={upcoming}
                retired={retired}
                editing={editing}
                onModeChange={changeMode}
                onConfigChange={setConfig}
                onPracticeGroupsChange={(groups) => setMovedPractices({ key: practiceKey, groups })}
                onQualifGroupsChange={(groups) => setMovedGroups({ key: qualifKey, groups })}
                onPlanChange={setPlan}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {editing ? (
        <ModalFooter className={FOOTER}>
          {finished ? (
            <Button type="button" variant="outline" onClick={onReopen} className="mr-auto">
              <RefreshCw className="size-3.5" />
              {t('configModal.reopenChampionship')}
            </Button>
          ) : (
            onFinish && (
              <Button type="button" variant="outline" onClick={onFinish} className="mr-auto text-destructive">
                <Flag className="size-3.5" />
                {t('configModal.finishChampionship')}
              </Button>
            )
          )}
          <Button type="button" variant="outline" onClick={close}>
            {t('common:cancel')}
          </Button>
          <Button
            type="button"
            onClick={() => finish(handleSave)}
            disabled={saving || finished}
            className="bg-yellow-500 hover:bg-yellow-600 text-white"
          >
            {saving ? t('common:saving') : t('common:save')}
          </Button>
        </ModalFooter>
      ) : (
        <ModalFooter className={FOOTER}>
          <Button type="button" variant="outline" onClick={close}>
            {t('common:cancel')}
          </Button>
          {step > 0 && (
            <Button type="button" variant="outline" onClick={() => goTo(step - 1)}>
              <ChevronLeft className="w-4 h-4 mr-1" />
              {t('common:back')}
            </Button>
          )}
          {step < WIZARD_STEPS.length - 1 ? (
            <Button type="button" onClick={next} className="bg-yellow-500 hover:bg-yellow-600 text-white">
              {t('wizard.next')}
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => finish(handleCreate)}
              disabled={saving}
              className="bg-yellow-500 hover:bg-yellow-600 text-white"
            >
              {saving ? t('wizard.creating') : t('wizard.createChampionship')}
            </Button>
          )}
        </ModalFooter>
      )}
    </Modal>
  )
}
