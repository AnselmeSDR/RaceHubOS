import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, Trophy } from 'lucide-react'
import { ChampionshipMode } from '@racehubos/shared'
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
  isConfigValid,
  planFromAuto,
  practiceCountFor,
  prunePlan,
  WIZARD_STEPS,
} from './wizard/wizardPlan'

// What deals the groups again when it changes: the line-up and their cars, with the group size or count
const lineUpKey = (participants) => participants.map((p) => `${p.driverId}:${p.carId ?? ''}`).join(',')

// Groups as dealt, or as moved by hand while what dealt them stays the same
const groupsFor = (moved, key, deal) => (moved?.key === key ? moved.groups : deal())

/**
 * Creates a championship in three steps: name and track, drivers and their cars, then the sessions,
 * dealt automatically or planned by hand from what the automatic mode dealt.
 */
export default function ChampionshipWizard({ tracks, onClose, onCreated }) {
  const { t } = useTranslation('championships')
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [drivers, setDrivers] = useState([])
  const [cars, setCars] = useState([])
  const [name, setName] = useState('')
  const [trackId, setTrackId] = useState('')
  const [participants, setParticipants] = useState([])
  const [divisionIds, setDivisionIds] = useState([]) // driver divisions and car categories
  const [config, setConfig] = useState(DEFAULT_WIZARD_CONFIG)
  const [mode, setMode] = useState(ChampionshipMode.AUTO)
  const [movedPractices, setMovedPractices] = useState(null) // { key, groups } once a driver was moved
  const [movedGroups, setMovedGroups] = useState(null)
  const [plan, setPlan] = useState(null) // the manual mode's sessions

  useEffect(() => {
    getData('/api/drivers?limit=1000').then((data) => data && setDrivers(data))
    getData('/api/cars?limit=1000').then((data) => data && setCars(data))
  }, [])

  const complete = participants.filter((p) => p.driverId)
  const practiceCount = practiceCountFor(complete, config.practiceCount)
  const practiceKey = `${practiceCount}|${lineUpKey(complete)}`
  const practiceGroups = groupsFor(movedPractices, practiceKey, () => dealtPracticeGroups(complete, practiceCount))
  const qualifKey = `${config.driversPerQualif}|${lineUpKey(complete)}`
  const qualifGroups = groupsFor(movedGroups, qualifKey, () => dealtQualifGroups(complete, config.driversPerQualif))
  const manual = mode === ChampionshipMode.MANUAL

  function changeParticipants(next) {
    setParticipants(next)
    const lineUp = next.filter((p) => p.driverId)
    if (plan) setPlan(prunePlan(plan, lineUp))
  }

  function changeMode(next) {
    setMode(next)
    if (next === ChampionshipMode.MANUAL) {
      setPlan(planFromAuto({ participants: complete, config, practiceGroups, qualifGroups }))
      return
    }
    setPlan(null)
    setMovedPractices(null)
    setMovedGroups(null)
  }

  function canNext() {
    if (step === 0) return name.trim() && trackId
    if (step === 1) return complete.length >= 2
    return isConfigValid(config, plan)
  }

  async function handleCreate() {
    setSaving(true)
    setError('')
    try {
      const body = championshipBody({
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
      const data = await createChampionship(body)
      if (!data.success) {
        setError(data.error || t('wizard.createError'))
        return
      }
      onCreated?.(data.data)
      onClose()
    } catch {
      setError(t('wizard.connectionError'))
    } finally {
      setSaving(false)
    }
  }

  const size = step < 2 ? '3xl' : manual ? '7xl' : '5xl'

  return (
    <Modal
      open
      onClose={onClose}
      title={t('wizard.title')}
      icon={<Trophy className="w-5 h-5 text-primary" />}
      size={size}
    >
      <WizardSteps step={step} onStep={setStep} />

      {error && <ErrorMessage message={error} type="error" />}

      {step === 0 && (
        <WizardInfoStep
          name={name}
          trackId={trackId}
          tracks={tracks}
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
          onDivisionsChange={setDivisionIds}
          onChange={changeParticipants}
        />
      )}
      {step === 2 && (
        <WizardConfigStep
          mode={mode}
          config={config}
          participants={complete}
          practiceGroups={practiceGroups}
          qualifGroups={qualifGroups}
          plan={plan}
          onModeChange={changeMode}
          onConfigChange={setConfig}
          onPracticeGroupsChange={(groups) => setMovedPractices({ key: practiceKey, groups })}
          onQualifGroupsChange={(groups) => setMovedGroups({ key: qualifKey, groups })}
          onPlanChange={setPlan}
        />
      )}

      <ModalFooter className="border-t mt-6 pt-4">
        <Button type="button" variant="outline" onClick={onClose}>
          {t('common:cancel')}
        </Button>
        {step > 0 && (
          <Button type="button" variant="outline" onClick={() => setStep((s) => s - 1)}>
            <ChevronLeft className="w-4 h-4 mr-1" />
            {t('common:back')}
          </Button>
        )}
        {step < WIZARD_STEPS.length - 1 ? (
          <Button
            type="button"
            onClick={() => setStep((s) => s + 1)}
            disabled={!canNext()}
            className="bg-yellow-500 hover:bg-yellow-600 text-white"
          >
            {t('wizard.next')}
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        ) : (
          <Button
            type="button"
            onClick={handleCreate}
            disabled={saving || !canNext()}
            className="bg-yellow-500 hover:bg-yellow-600 text-white"
          >
            {saving ? t('wizard.creating') : t('wizard.createChampionship')}
          </Button>
        )}
      </ModalFooter>
    </Modal>
  )
}
