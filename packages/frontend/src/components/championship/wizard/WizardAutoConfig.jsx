import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowRight } from 'lucide-react'
import { MAX_SESSION_DRIVERS, SessionType, sessionTypeAbbrKey, sessionTypeFullKey } from '@racehubos/shared'
import FrozenSession, { WithdrawnToken } from './FrozenSession'
import WizardGroups from './WizardGroups'
import WizardLimitsCard from './WizardLimitsCard'
import { Refusal, SentenceCount } from './wizardFields'
import { MAX_PRACTICES, raceGroups, withdrawnIn } from './wizardPlan'

// On a wide screen the columns share two rows: the settings cards side by side, the same height
const COLUMN = 'flex flex-col gap-2 @3xl:row-span-2 @3xl:grid @3xl:grid-rows-subgrid'

/**
 * The automatic mode, settings and preview together, three columns of the same width: per kind of
 * session its count and limits above its sessions. Drivers are dragged between free practices and
 * between qualifying groups; races fill from the ranking. When editing, the sessions that have started
 * (`frozen`) head their column, greyed and locked; the groups are the sessions to come (`upcoming`,
 * where the `retired` drivers they held show as DNF), and qualify those who haven't yet (`qualifiers`).
 */
export default function WizardAutoConfig({
  config,
  participants,
  qualifiers = participants,
  practiceGroups,
  qualifGroups,
  frozen = [],
  upcoming = [],
  retired = [],
  onConfigChange,
  onPracticeGroupsChange,
  onQualifGroupsChange,
}) {
  const { t, i18n } = useTranslation('championships')
  const [refusal, setRefusal] = useState(null)
  const set = (field, value) => onConfigChange({ ...config, [field]: value })
  const ofType = (list, type) => list.filter((s) => s.type === type)
  const ran = (type) => ofType(frozen, type)
  const ranRaces = ran(SessionType.RACE)
  const races = raceGroups(participants, config.driversPerRace).slice(ranRaces.length)
  const abbr = (type) => t(sessionTypeAbbrKey(type))
  const withdrawn = (type, count) =>
    Array.from({ length: count }, (_, g) => withdrawnIn(ofType(upcoming, type)[g], retired))
  const ranPractices = ran(SessionType.PRACTICE).length
  // The sessions to come, by their sizes: 2 qualifs of 4 and 3 drivers
  const split = (key, sizes) => {
    if (!sizes.length) return t('wizard.noneToCome')
    const distinct = [...new Set(sizes)].sort((a, b) => b - a)
    const list = new Intl.ListFormat(i18n.language, { type: 'conjunction' }).format(distinct.map(String))
    return t(key, { count: sizes.length, drivers: t('wizard.groupDrivers', { count: distinct[0], sizes: list }) })
  }
  const frozenOf = (type) =>
    ran(type).map((session, i) => (
      <FrozenSession
        key={session.id}
        session={session}
        label={`${abbr(type)}${i + 1}`}
        withdrawn={withdrawnIn(session, retired, false)}
      />
    ))

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
            {/* All the practices, never fewer than those that have run; those to come are dealt */}
            <SentenceCount
              text="wizard.practiceSentence"
              value={ranPractices + practiceGroups.length}
              min={ranPractices}
              max={ranPractices + MAX_PRACTICES}
              onChange={(count) => set('practiceCount', count - ranPractices)}
            />
          </WizardLimitsCard>
          <div className="space-y-2">
            {frozenOf(SessionType.PRACTICE)}
            <WizardGroups
              testId="championship-wizard-practice"
              groups={practiceGroups}
              label={abbr(SessionType.PRACTICE)}
              first={ran(SessionType.PRACTICE).length + 1}
              withdrawn={withdrawn(SessionType.PRACTICE, practiceGroups.length)}
              tone="purple"
              perGroup={MAX_SESSION_DRIVERS}
              keepOne={false}
              participants={participants}
              out={{
                label: t('wizard.noPractice'),
                hint: (count) => t('wizard.noPracticeHint', { count }),
                testId: 'championship-wizard-no-practice',
              }}
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
            <SentenceCount
              text="wizard.qualifSentence"
              result={split(
                'wizard.qualifSplit',
                qualifGroups.map((group) => group.length)
              )}
              value={config.driversPerQualif}
              min={2}
              max={6}
              onChange={(count) => set('driversPerQualif', count)}
            />
          </WizardLimitsCard>
          <div className="space-y-2">
            {frozenOf(SessionType.QUALIF)}
            <WizardGroups
              testId="championship-wizard-qualif-group"
              groups={qualifGroups}
              label={abbr(SessionType.QUALIF)}
              first={ran(SessionType.QUALIF).length + 1}
              withdrawn={withdrawn(SessionType.QUALIF, qualifGroups.length)}
              tone="blue"
              perGroup={config.driversPerQualif}
              keepOne
              participants={qualifiers}
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
            <SentenceCount
              text="wizard.raceSentence"
              result={split(
                'wizard.raceSplit',
                races.map((race) => race.count)
              )}
              value={config.driversPerRace}
              min={2}
              max={6}
              onChange={(count) => set('driversPerRace', count)}
            />
          </WizardLimitsCard>
          <div className="space-y-2">
            {frozenOf(SessionType.RACE)}
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
                    {ranRaces.length + r + 1}
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
                {withdrawnIn(ofType(upcoming, SessionType.RACE)[r], retired).map((w) => (
                  <WithdrawnToken key={w.driverId} driver={w.driver} />
                ))}
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
