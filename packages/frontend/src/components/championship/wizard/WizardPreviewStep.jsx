import { useTranslation } from 'react-i18next'
import { qualifGroups, raceGroups } from './wizardPlan'

export default function WizardPreviewStep({ participants, config }) {
  const { t } = useTranslation('championships')
  return (
    <div data-testid="championship-wizard-preview" className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
        <div>
          <h3 className="font-semibold mb-2 text-blue-600 dark:text-blue-400">{t('wizard.qualifications')}</h3>
          {qualifGroups(participants, config.driversPerQualif).map((group, g) => (
            <div
              key={g}
              data-testid="championship-wizard-qualif-group"
              className="mb-3 border border-blue-200 dark:border-blue-800 rounded-lg p-2 bg-blue-50/50 dark:bg-blue-950/30"
            >
              <div className="font-medium text-xs mb-1">
                Q{g + 1} ({t('wizard.groupDrivers', { count: group.length })})
              </div>
              {group.map((p, i) => (
                <div key={i} className="text-xs text-muted-foreground truncate">
                  {p.driver.name}
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="flex flex-col items-center justify-center">
          <div className="text-xs text-muted-foreground mb-2">{t('wizard.globalRanking')}</div>
          <div className="text-xs text-muted-foreground">{t('wizard.globalRankingHint')}</div>
          <div className="mt-2 text-lg rotate-90 sm:rotate-0">→</div>
        </div>

        <div>
          <h3 className="font-semibold mb-2 text-green-600 dark:text-green-400">{t('wizard.races')}</h3>
          {raceGroups(participants.length, config.driversPerRace).map((group, g) => (
            <div
              key={g}
              data-testid="championship-wizard-race-group"
              className="mb-3 border border-green-200 dark:border-green-800 rounded-lg p-2 bg-green-50/50 dark:bg-green-950/30"
            >
              <div className="font-medium text-xs mb-1">
                R{g + 1} ({t('wizard.groupDrivers', { count: group.count })})
              </div>
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
  )
}
