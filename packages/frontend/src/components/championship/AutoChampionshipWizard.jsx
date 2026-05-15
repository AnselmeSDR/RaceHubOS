import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Trophy, Users, Settings, Eye, ChevronLeft, ChevronRight, X } from 'lucide-react'
import Modal, { ModalFooter } from '../ui/Modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormField } from '../crud/FormModal'
import ErrorMessage from '../ErrorMessage'

const API_URL = import.meta.env.VITE_API_URL || ''

const STEPS = [
  { key: 'info', labelKey: 'wizard.steps.info', icon: Trophy },
  { key: 'participants', labelKey: 'wizard.steps.participants', icon: Users },
  { key: 'config', labelKey: 'wizard.steps.config', icon: Settings },
  { key: 'preview', labelKey: 'wizard.steps.preview', icon: Eye },
]

export default function AutoChampionshipWizard({ tracks, initialName = '', initialTrackId = '', onFormChange, onClose, onCreated, onSwitchManual }) {
  const { t } = useTranslation('championships')
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [drivers, setDrivers] = useState([])

  // Step 1: Info
  const [name, setNameLocal] = useState(initialName)
  const [trackId, setTrackIdLocal] = useState(initialTrackId)

  const setName = (v) => { setNameLocal(v); onFormChange?.({ name: v, trackId }) }
  const setTrackId = (v) => { setTrackIdLocal(v); onFormChange?.({ name, trackId: v }) }

  // Step 2: Participants
  const [participants, setParticipants] = useState([])

  // Step 3: Config
  const [driversPerQualif, setDriversPerQualif] = useState(4)
  const [driversPerRace, setDriversPerRace] = useState(6)
  const [qualifDuration, setQualifDuration] = useState(5)
  const [qualifLaps, setQualifLaps] = useState(0)
  const [raceDuration, setRaceDuration] = useState(10)
  const [raceLaps, setRaceLaps] = useState(0)
  const [useQualifTime, setUseQualifTime] = useState(true)
  const [useQualifLaps, setUseQualifLaps] = useState(false)
  const [useRaceTime, setUseRaceTime] = useState(true)
  const [useRaceLaps, setUseRaceLaps] = useState(false)

  useEffect(() => {
    fetch(`${API_URL}/api/drivers`).then(r => r.json()).then(d => {
      if (d.success) setDrivers(d.data || [])
    }).catch(() => {})
  }, [])

  // Available drivers/cars for a given row (exclude used by other rows)
  function getAvailableDrivers(currentIndex) {
    const usedIds = new Set(participants.filter((_, i) => i !== currentIndex).map(p => p.driverId).filter(Boolean))
    return drivers.filter(d => !usedIds.has(d.id))
  }

  function updateParticipant(index, value) {
    setParticipants(prev => {
      const next = [...prev]
      next[index] = {
        driverId: value || null,
        driver: drivers.find(d => d.id === value) || null,
      }
      return next
    })
  }

  function removeParticipant(index) {
    setParticipants(prev => prev.filter((_, i) => i !== index))
  }

  // Auto-add empty row at the end when last row is filled
  const participantsWithEmpty = useMemo(() => {
    const lastRow = participants[participants.length - 1]
    const needsEmptyRow = !lastRow || lastRow.driverId
    if (needsEmptyRow) return [...participants, { driverId: null, driver: null }]
    return participants
  }, [participants])

  // Complete participants only (for preview and submission)
  const completeParticipants = useMemo(() => participants.filter(p => p.driverId), [participants])

  // Preview calculations
  const numQualifGroups = Math.ceil(completeParticipants.length / driversPerQualif) || 0
  const numRaceGroups = Math.ceil(completeParticipants.length / driversPerRace) || 0
  const totalSessions = numQualifGroups + numRaceGroups + 1 // +1 for practice

  const previewQualifGroups = useMemo(() => {
    if (!completeParticipants.length) return []
    const groups = Array.from({ length: numQualifGroups }, () => [])
    completeParticipants.forEach((p, i) => groups[i % numQualifGroups].push(p))
    return groups
  }, [completeParticipants, numQualifGroups])

  const previewRaceGroups = useMemo(() => {
    const n = completeParticipants.length
    if (!n) return []
    const numGroups = Math.ceil(n / driversPerRace)
    const baseSize = Math.floor(n / numGroups)
    const extra = n % numGroups
    const groups = []
    let offset = 0
    for (let g = 0; g < numGroups; g++) {
      const size = baseSize + (g < extra ? 1 : 0)
      groups.push({ start: offset + 1, end: offset + size, count: size })
      offset += size
    }
    return groups
  }, [completeParticipants.length, driversPerRace])

  function canNext() {
    if (step === 0) return name.trim() && trackId
    if (step === 1) return completeParticipants.length >= 2
    if (step === 2) return (useQualifTime || useQualifLaps) && (useRaceTime || useRaceLaps)
    return true
  }

  async function handleCreate() {
    setSaving(true)
    setError('')
    try {
      const body = {
        name: name.trim(),
        season: new Date().getFullYear().toString(),
        trackId,
        mode: 'auto',
        driversPerQualif,
        driversPerRace,
        qualifMaxDuration: useQualifTime && qualifDuration > 0 ? qualifDuration * 60000 : null,
        qualifMaxLaps: useQualifLaps && qualifLaps > 0 ? qualifLaps : null,
        raceMaxDuration: useRaceTime && raceDuration > 0 ? raceDuration * 60000 : null,
        raceMaxLaps: useRaceLaps && raceLaps > 0 ? raceLaps : null,
        participants: completeParticipants.map(p => ({ driverId: p.driverId })),
      }
      const res = await fetch(`${API_URL}/api/championships`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.success) {
        onCreated?.(data.data)
        onClose()
      } else {
        setError(data.error || t('wizard.createError'))
      }
    } catch {
      setError(t('wizard.connectionError'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={t('wizard.title')} icon={<Trophy className="w-5 h-5 text-primary" />} size="2xl">
      {/* Step indicators */}
      <div className="flex items-center gap-2 mb-6">
        {STEPS.map((s, i) => {
          const Icon = s.icon
          const isActive = i === step
          const isDone = i < step
          return (
            <button
              key={s.key}
              onClick={() => i < step && setStep(i)}
              disabled={i > step}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                isActive ? 'bg-yellow-500 text-white' :
                isDone ? 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 cursor-pointer' :
                'bg-muted text-muted-foreground'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t(s.labelKey)}
            </button>
          )
        })}
      </div>

      {error && <ErrorMessage message={error} type="error" />}

      {/* Step 1: Info */}
      {step === 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{t('wizard.autoMode')}</span>
            <button
              type="button"
              onClick={() => onSwitchManual?.()}
              className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors bg-yellow-500"
            >
              <span className="inline-block size-4 transform rounded-full bg-white shadow-sm transition-transform translate-x-6" />
            </button>
          </div>
          <FormField label={t('wizard.name')} required>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder={t('wizard.namePlaceholder')} />
          </FormField>
          <FormField label={t('wizard.track')} required>
            <select
              value={trackId}
              onChange={e => setTrackId(e.target.value)}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            >
              <option value="">{t('wizard.selectTrack')}</option>
              {tracks.map(track => <option key={track.id} value={track.id}>{track.name}</option>)}
            </select>
          </FormField>
        </div>
      )}

      {/* Step 2: Participants */}
      {step === 1 && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {t('wizard.participantsCount', { count: completeParticipants.length })}
          </p>

          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground text-xs uppercase bg-muted/50">
                  <th className="px-3 py-2 font-medium w-8">#</th>
                  <th className="px-3 py-2 font-medium">{t('glossary:driver_one')}</th>
                  <th className="px-3 py-2 font-medium w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {participantsWithEmpty.map((p, i) => {
                  const isComplete = !!p.driverId
                  const isEmptyRow = !p.driverId
                  return (
                    <tr key={i} className={isEmptyRow ? 'bg-muted/20' : ''}>
                      <td className="px-3 py-1.5 text-xs text-muted-foreground">{isComplete ? i + 1 : ''}</td>
                      <td className="px-3 py-1.5">
                        <select
                          value={p.driverId || ''}
                          onChange={e => updateParticipant(i, e.target.value)}
                          className="w-full px-2 py-1 border-none bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-ring rounded"
                        >
                          <option value="">{t('wizard.driverPlaceholder')}</option>
                          {getAvailableDrivers(i).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-1.5">
                        {!isEmptyRow && (
                          <button onClick={() => removeParticipant(i)} className="p-0.5 hover:bg-destructive/10 rounded text-muted-foreground hover:text-destructive">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Step 3: Config */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <FormField label={t('wizard.driversPerQualif')}>
              <Input
                type="number"
                min={2}
                max={6}
                value={driversPerQualif}
                onChange={e => setDriversPerQualif(Math.max(2, Math.min(6, parseInt(e.target.value) || 2)))}
              />
              <p className="text-xs text-muted-foreground mt-1">{t('wizard.qualifGroups', { count: numQualifGroups })}</p>
            </FormField>
            <FormField label={t('wizard.driversPerRace')}>
              <Input
                type="number"
                min={2}
                max={6}
                value={driversPerRace}
                onChange={e => setDriversPerRace(Math.max(2, Math.min(6, parseInt(e.target.value) || 2)))}
              />
              <p className="text-xs text-muted-foreground mt-1">{t('wizard.raceGroups', { count: numRaceGroups })}</p>
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Qualif config */}
            <div className="space-y-3 border border-blue-200 dark:border-blue-800 rounded-lg p-3 bg-blue-50/30 dark:bg-blue-950/20">
              <h3 className="text-sm font-semibold text-blue-600 dark:text-blue-400">{t('wizard.qualifications')}</h3>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={useQualifTime} onChange={e => setUseQualifTime(e.target.checked)} className="rounded" />
                  {t('wizard.duration')}
                </label>
                {useQualifTime && (
                  <div className="flex items-center gap-1">
                    <Input type="number" min={1} value={qualifDuration} onChange={e => setQualifDuration(parseInt(e.target.value) || 1)} className="w-16 h-7" />
                    <span className="text-xs text-muted-foreground">{t('configModal.fields.minUnit')}</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={useQualifLaps} onChange={e => setUseQualifLaps(e.target.checked)} className="rounded" />
                  {t('wizard.laps')}
                </label>
                {useQualifLaps && (
                  <Input type="number" min={1} value={qualifLaps} onChange={e => setQualifLaps(parseInt(e.target.value) || 1)} className="w-16 h-7" />
                )}
              </div>
            </div>

            {/* Race config */}
            <div className="space-y-3 border border-green-200 dark:border-green-800 rounded-lg p-3 bg-green-50/30 dark:bg-green-950/20">
              <h3 className="text-sm font-semibold text-green-600 dark:text-green-400">{t('wizard.races')}</h3>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={useRaceTime} onChange={e => setUseRaceTime(e.target.checked)} className="rounded" />
                  {t('wizard.duration')}
                </label>
                {useRaceTime && (
                  <div className="flex items-center gap-1">
                    <Input type="number" min={1} value={raceDuration} onChange={e => setRaceDuration(parseInt(e.target.value) || 1)} className="w-16 h-7" />
                    <span className="text-xs text-muted-foreground">{t('configModal.fields.minUnit')}</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={useRaceLaps} onChange={e => setUseRaceLaps(e.target.checked)} className="rounded" />
                  {t('wizard.laps')}
                </label>
                {useRaceLaps && (
                  <Input type="number" min={1} value={raceLaps} onChange={e => setRaceLaps(parseInt(e.target.value) || 1)} className="w-16 h-7" />
                )}
              </div>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            {t('wizard.totalSummary', {
              total: totalSessions,
              qualifs: t('wizard.groupQualifs', { count: numQualifGroups }),
              races: t('wizard.groupRaces', { count: numRaceGroups }),
            })}
          </p>
        </div>
      )}

      {/* Step 4: Preview */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4 text-sm">
            {/* Qualifs */}
            <div>
              <h3 className="font-semibold mb-2 text-blue-600 dark:text-blue-400">{t('wizard.qualifications')}</h3>
              {previewQualifGroups.map((group, g) => (
                <div key={g} className="mb-3 border border-blue-200 dark:border-blue-800 rounded-lg p-2 bg-blue-50/50 dark:bg-blue-950/30">
                  <div className="font-medium text-xs mb-1">Q{g + 1} ({t('wizard.groupDrivers', { count: group.length })})</div>
                  {group.map((p, i) => (
                    <div key={i} className="text-xs text-muted-foreground truncate">
                      {p.driver.name}
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Arrow */}
            <div className="flex flex-col items-center justify-center">
              <div className="text-xs text-muted-foreground mb-2">{t('wizard.globalRanking')}</div>
              <div className="text-xs text-muted-foreground">{t('wizard.globalRankingHint')}</div>
              <div className="mt-2 text-lg">→</div>
            </div>

            {/* Races */}
            <div>
              <h3 className="font-semibold mb-2 text-green-600 dark:text-green-400">{t('wizard.races')}</h3>
              {previewRaceGroups.map((group, g) => (
                <div key={g} className="mb-3 border border-green-200 dark:border-green-800 rounded-lg p-2 bg-green-50/50 dark:bg-green-950/30">
                  <div className="font-medium text-xs mb-1">R{g + 1} ({t('wizard.groupDrivers', { count: group.count })})</div>
                  <div className="text-xs text-muted-foreground">
                    {t('wizard.positionsRange', { start: group.start, end: group.end })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="text-xs text-muted-foreground space-y-1">
            <p>{t('wizard.previewNote1')}</p>
            <p>{t('wizard.previewNote2')}</p>
          </div>
        </div>
      )}

      {/* Footer */}
      <ModalFooter className="border-t mt-6 pt-4">
        <Button type="button" variant="outline" onClick={onClose}>{t('common:cancel')}</Button>
        {step > 0 && (
          <Button type="button" variant="outline" onClick={() => setStep(s => s - 1)}>
            <ChevronLeft className="w-4 h-4 mr-1" />
            {t('common:back')}
          </Button>
        )}
        {step < STEPS.length - 1 ? (
          <Button type="button" onClick={() => setStep(s => s + 1)} disabled={!canNext()} className="bg-yellow-500 hover:bg-yellow-600 text-white">
            {t('wizard.next')}
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        ) : (
          <Button type="button" onClick={handleCreate} disabled={saving || !canNext()} className="bg-yellow-500 hover:bg-yellow-600 text-white">
            {saving ? t('wizard.creating') : t('wizard.createChampionship')}
          </Button>
        )}
      </ModalFooter>
    </Modal>
  )
}
