import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import { FormField } from '../../crud/FormModal'
import WizardLimitsCard from './WizardLimitsCard'
import { groupCount } from './wizardPlan'

const groupSize = (value) => Math.max(2, Math.min(6, parseInt(value) || 2))

export default function WizardConfigStep({ config, participantCount, onChange }) {
  const { t } = useTranslation('championships')
  const set = (field, value) => onChange({ ...config, [field]: value })
  const qualifs = groupCount(participantCount, config.driversPerQualif)
  const races = groupCount(participantCount, config.driversPerRace)

  return (
    <div data-testid="championship-wizard-config" className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label={t('wizard.driversPerQualif')}>
          <Input
            type="number"
            min={2}
            max={6}
            value={config.driversPerQualif}
            onChange={(e) => set('driversPerQualif', groupSize(e.target.value))}
          />
          <p className="text-xs text-muted-foreground mt-1">{t('wizard.qualifGroups', { count: qualifs })}</p>
        </FormField>
        <FormField label={t('wizard.driversPerRace')}>
          <Input
            type="number"
            min={2}
            max={6}
            value={config.driversPerRace}
            onChange={(e) => set('driversPerRace', groupSize(e.target.value))}
          />
          <p className="text-xs text-muted-foreground mt-1">{t('wizard.raceGroups', { count: races })}</p>
        </FormField>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <WizardLimitsCard
          testId="championship-wizard-qualif-limits"
          title={t('wizard.qualifications')}
          tone="blue"
          limits={config.qualif}
          onChange={(limits) => set('qualif', limits)}
        />
        <WizardLimitsCard
          testId="championship-wizard-race-limits"
          title={t('wizard.races')}
          tone="green"
          limits={config.race}
          onChange={(limits) => set('race', limits)}
        />
      </div>

      <p className="text-sm text-muted-foreground">
        {t('wizard.totalSummary', {
          // +1 for the free practice
          total: qualifs + races + 1,
          qualifs: t('wizard.groupQualifs', { count: qualifs }),
          races: t('wizard.groupRaces', { count: races }),
        })}
      </p>
    </div>
  )
}
