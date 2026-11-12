import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'

const TONES = {
  purple: {
    card: 'border-purple-200 dark:border-purple-800 bg-purple-50/30 dark:bg-purple-950/20',
    title: 'text-purple-600 dark:text-purple-400',
  },
  blue: {
    card: 'border-blue-200 dark:border-blue-800 bg-blue-50/30 dark:bg-blue-950/20',
    title: 'text-blue-600 dark:text-blue-400',
  },
  green: {
    card: 'border-green-200 dark:border-green-800 bg-green-50/30 dark:bg-green-950/20',
    title: 'text-green-600 dark:text-green-400',
  },
}

// The limits of one kind of session: a duration in minutes, a number of laps, or both; `children` above
// them (how many sessions), `hint` below
export default function WizardLimitsCard({ title, tone, limits, onChange, testId, hint, children }) {
  const { t } = useTranslation('championships')
  const set = (field, value) => onChange({ ...limits, [field]: value })
  return (
    <div data-testid={testId} className={`space-y-3 border rounded-lg p-3 ${TONES[tone].card}`}>
      <h3 className={`text-sm font-semibold ${TONES[tone].title}`}>{title}</h3>
      {children}
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={limits.useTime}
            onChange={(e) => set('useTime', e.target.checked)}
            className="rounded"
          />
          {t('wizard.duration')}
        </label>
        {limits.useTime && (
          <div className="flex items-center gap-1">
            <Input
              type="number"
              min={1}
              aria-label={t('wizard.duration')}
              value={limits.duration}
              onChange={(e) => set('duration', parseInt(e.target.value) || 1)}
              className="w-16 h-7"
            />
            <span className="text-xs text-muted-foreground">{t('configModal.fields.minUnit')}</span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={limits.useLaps}
            onChange={(e) => set('useLaps', e.target.checked)}
            className="rounded"
          />
          {t('wizard.laps')}
        </label>
        {limits.useLaps && (
          <Input
            type="number"
            min={1}
            aria-label={t('wizard.laps')}
            value={limits.laps}
            onChange={(e) => set('laps', parseInt(e.target.value) || 1)}
            className="w-16 h-7"
          />
        )}
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
