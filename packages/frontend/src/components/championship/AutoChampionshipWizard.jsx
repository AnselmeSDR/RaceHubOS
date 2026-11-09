import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Modal, { ModalFooter } from '../ui/Modal'
import ErrorMessage from '../ErrorMessage'
import WizardConfigStep from './wizard/WizardConfigStep'
import WizardInfoStep from './wizard/WizardInfoStep'
import WizardParticipantsStep from './wizard/WizardParticipantsStep'
import WizardPreviewStep from './wizard/WizardPreviewStep'
import WizardSteps from './wizard/WizardSteps'
import {
  championshipBody,
  createAutoChampionship,
  DEFAULT_WIZARD_CONFIG,
  isConfigValid,
  WIZARD_STEPS,
} from './wizard/wizardPlan'

const API_URL = import.meta.env.VITE_API_URL || ''

export default function AutoChampionshipWizard({
  tracks,
  initialName = '',
  initialTrackId = '',
  onFormChange,
  onClose,
  onCreated,
  onSwitchManual,
}) {
  const { t } = useTranslation('championships')
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [drivers, setDrivers] = useState([])
  const [name, setName] = useState(initialName)
  const [trackId, setTrackId] = useState(initialTrackId)
  const [participants, setParticipants] = useState([])
  const [config, setConfig] = useState(DEFAULT_WIZARD_CONFIG)

  useEffect(() => {
    fetch(`${API_URL}/api/drivers`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setDrivers(d.data || [])
      })
      .catch(() => {})
  }, [])

  // Name and track are shared with the manual form, in case the user switches
  function changeInfo(info) {
    const next = { name, trackId, ...info }
    setName(next.name)
    setTrackId(next.trackId)
    onFormChange?.(next)
  }

  const complete = participants.filter((p) => p.driverId)

  function canNext() {
    if (step === 0) return name.trim() && trackId
    if (step === 1) return complete.length >= 2
    if (step === 2) return isConfigValid(config)
    return true
  }

  async function handleCreate() {
    setSaving(true)
    setError('')
    try {
      const data = await createAutoChampionship(championshipBody({ name, trackId, participants: complete, config }))
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

  return (
    <Modal
      open
      onClose={onClose}
      title={t('wizard.title')}
      icon={<Trophy className="w-5 h-5 text-primary" />}
      size="2xl"
    >
      <WizardSteps step={step} onStep={setStep} />

      {error && <ErrorMessage message={error} type="error" />}

      {step === 0 && (
        <WizardInfoStep
          name={name}
          trackId={trackId}
          tracks={tracks}
          onNameChange={(value) => changeInfo({ name: value })}
          onTrackChange={(value) => changeInfo({ trackId: value })}
          onSwitchManual={onSwitchManual}
        />
      )}
      {step === 1 && (
        <WizardParticipantsStep participants={participants} drivers={drivers} onChange={setParticipants} />
      )}
      {step === 2 && <WizardConfigStep config={config} participantCount={complete.length} onChange={setConfig} />}
      {step === 3 && <WizardPreviewStep participants={complete} config={config} />}

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
