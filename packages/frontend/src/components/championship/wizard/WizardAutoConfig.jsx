import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowRight } from 'lucide-react'
import { MAX_SESSION_DRIVERS, SessionType, sessionTypeAbbrKey, sessionTypeFullKey } from '@racehubos/shared'
import WizardGroups from './WizardGroups'
import WizardLimitsCard from './WizardLimitsCard'
import { CountField, Refusal } from './wizardFields'
import { MAX_PRACTICES, practiceCountFor, raceGroups } from './wizardPlan'

// On a wide screen the columns share two rows: the settings cards side by side, the same height
const COLUMN = 'flex flex-col gap-2 @3xl:row-span-2 @3xl:grid @3xl:grid-rows-subgrid'

/**
 * The automatic mode, settings and preview together, three columns of the same width: per kind of
 * session its count and limits above its sessions. Drivers are dragged between free practices and
 * between qualifying groups; races fill from the ranking.
 */
export default function WizardAutoConfig({
  config,
  participants,
  practiceGroups,
  qualifGroups,
  onConfigChange,
  onPracticeGroupsChange,
  onQualifGroupsChange,
}) {
  const { t } = useTranslation('championships')
  const [refusal, setRefusal] = useState(null)
  const set = (field, value) => onConfigChange({ ...config, [field]: value })
  const races = raceGroups(participants, config.driversPerRace)
  const fewestPractices = practiceCountFor(participants, 1)
  const abbr = (type) => t(sessionTypeAbbrKey(type))

  return (
    <div className="@container space-y-2">
      <div className="grid gap-3 @3xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_minmax(0,1fr)] @3xl:grid-rows-[auto_1fr]">
        <div className={COLUMN}>
          <WizardLimitsCard
            testId="championship-wizard-practice-limits"
            title={t(sessionTypeFullKey(SessionType.PRACTICE))}
            tone="purple"
            limits={config.practice}
            onChange={(limits) => set('practice', limits)}
            hint={t('wizard.practiceLimitsHint')}
          >
            <CountField
              label={t('wizard.practiceCount')}
              hint={fewestPractices > 1 ? t('wizard.practiceAtLeast', { n: fewestPractices }) : undefined}
              value={practiceGroups.length}
              min={0}
              max={MAX_PRACTICES}
              onChange={(count) => set('practiceCount', count)}
            />
          </WizardLimitsCard>
          <div className="space-y-2">
            <WizardGroups
              testId="championship-wizard-practice"
              groups={practiceGroups}
              label={abbr(SessionType.PRACTICE)}
              tone="purple"
              perGroup={MAX_SESSION_DRIVERS}
              keepOne={false}
              participants={participants}
              onChange={onPracticeGroupsChange}
              onRefuse={setRefusal}
            />
          </div>
        </div>

        <div className={COLUMN}>
          <WizardLimitsCard
            testId="championship-wizard-qualif-limits"
            title={t('wizard.qualifications')}
            tone="blue"
            limits={config.qualif}
            onChange={(limits) => set('qualif', limits)}
          >
            <CountField
              label={t('wizard.driversPerQualif')}
              hint={t('wizard.qualifGroups', { count: qualifGroups.length })}
              value={config.driversPerQualif}
              min={2}
              max={6}
              onChange={(count) => set('driversPerQualif', count)}
            />
          </WizardLimitsCard>
          <div className="space-y-2">
            <WizardGroups
              testId="championship-wizard-qualif-group"
              groups={qualifGroups}
              label={abbr(SessionType.QUALIF)}
              tone="blue"
              perGroup={config.driversPerQualif}
              keepOne
              participants={participants}
              onChange={onQualifGroupsChange}
              onRefuse={setRefusal}
            />
          </div>
        </div>

        <ArrowRight
          aria-hidden="true"
          className="hidden @3xl:block @3xl:row-span-2 self-center size-5 text-muted-foreground"
        />

        <div className={COLUMN}>
          <WizardLimitsCard
            testId="championship-wizard-race-limits"
            title={t('wizard.races')}
            tone="green"
            limits={config.race}
            onChange={(limits) => set('race', limits)}
          >
            <CountField
              label={t('wizard.driversPerRace')}
              hint={t('wizard.raceGroups', { count: races.length })}
              value={config.driversPerRace}
              min={2}
              max={6}
              onChange={(count) => set('driversPerRace', count)}
            />
          </WizardLimitsCard>
          <div className="space-y-2">
            <p className="px-1 text-[11px] text-muted-foreground">{t('wizard.racesFromRanking')}</p>
            {races.map((race, r) => (
              <div
                key={r}
                data-testid="championship-wizard-race-group"
                className="rounded-lg border border-green-200 dark:border-green-800 p-2 space-y-1.5"
              >
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-session-race">
                    {abbr(SessionType.RACE)}
                    {r + 1}
                  </span>
                  <span className="text-muted-foreground">
                    {t('wizard.positionsRange', { start: race.start, end: race.end })}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {Array.from({ length: race.count }, (_, k) => (
                    <span key={k} className="rounded border border-green-200 dark:border-green-800 px-1.5 text-[11px]">
                      P{race.start + k}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <Refusal message={refusal} />
      <p className="text-xs text-muted-foreground">{t('wizard.autoDragHint')}</p>
    </div>
  )
}
