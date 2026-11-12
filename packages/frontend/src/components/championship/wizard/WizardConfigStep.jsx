import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChampionshipMode, SessionType } from '@racehubos/shared'
import { ConfirmModal } from '../../ui/Modal'
import WizardAutoConfig from './WizardAutoConfig'
import WizardManualConfig from './WizardManualConfig'
import { raceGroups, sessionsOfType } from './wizardPlan'

const MODES = [
  { mode: ChampionshipMode.AUTO, labelKey: 'wizard.modeAuto', hintKey: 'wizard.modeAutoHint' },
  { mode: ChampionshipMode.MANUAL, labelKey: 'wizard.modeManual', hintKey: 'wizard.modeManualHint' },
]

/**
 * Settings and preview of the sessions together. Automatic by default; the manual mode starts from
 * what the automatic one dealt, and going back to automatic deals everything again once confirmed.
 */
export default function WizardConfigStep({
  mode,
  config,
  participants,
  practiceGroups,
  qualifGroups,
  plan,
  onModeChange,
  onConfigChange,
  onPracticeGroupsChange,
  onQualifGroupsChange,
  onPlanChange,
}) {
  const { t } = useTranslation('championships')
  const [confirming, setConfirming] = useState(false)
  const manual = mode === ChampionshipMode.MANUAL
  const counts = manual
    ? [SessionType.PRACTICE, SessionType.QUALIF, SessionType.RACE].map((type) => sessionsOfType(plan, type).length)
    : [practiceGroups.length, qualifGroups.length, raceGroups(participants, config.driversPerRace).length]

  function pick(next) {
    if (next === mode) return
    if (next === ChampionshipMode.AUTO) setConfirming(true)
    else onModeChange(next)
  }

  return (
    <div data-testid="championship-wizard-config" className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div
          role="radiogroup"
          aria-label={t('wizard.mode')}
          className="inline-flex rounded-lg border border-border p-0.5"
        >
          {MODES.map((m) => (
            <button
              key={m.mode}
              type="button"
              role="radio"
              aria-checked={mode === m.mode}
              onClick={() => pick(m.mode)}
              className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
                mode === m.mode ? 'bg-yellow-500 text-white' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t(m.labelKey)}
            </button>
          ))}
        </div>
        <p className="flex-1 min-w-60 text-xs text-muted-foreground">{t(MODES.find((m) => m.mode === mode).hintKey)}</p>
      </div>

      {manual ? (
        <WizardManualConfig
          config={config}
          participants={participants}
          plan={plan}
          onConfigChange={onConfigChange}
          onPlanChange={onPlanChange}
        />
      ) : (
        <WizardAutoConfig
          config={config}
          participants={participants}
          practiceGroups={practiceGroups}
          qualifGroups={qualifGroups}
          onConfigChange={onConfigChange}
          onPracticeGroupsChange={onPracticeGroupsChange}
          onQualifGroupsChange={onQualifGroupsChange}
        />
      )}

      <p data-testid="championship-wizard-total" className="text-sm text-muted-foreground">
        {t('wizard.totalSummary', {
          total: counts[0] + counts[1] + counts[2],
          groups: [
            counts[0] > 0 && t('wizard.groupPractices', { count: counts[0] }),
            t('wizard.groupQualifs', { count: counts[1] }),
            t('wizard.groupRaces', { count: counts[2] }),
          ]
            .filter(Boolean)
            .join(' + '),
        })}
      </p>

      <ConfirmModal
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false)
          onModeChange(ChampionshipMode.AUTO)
        }}
        title={t('wizard.backToAutoTitle')}
        message={t('wizard.backToAuto')}
        confirmLabel={t('wizard.backToAutoAction')}
        variant="warning"
      />
    </div>
  )
}
