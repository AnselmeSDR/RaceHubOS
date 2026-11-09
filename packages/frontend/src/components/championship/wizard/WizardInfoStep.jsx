import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import { FormField } from '../../crud/FormModal'

export default function WizardInfoStep({ name, trackId, tracks, onNameChange, onTrackChange, onSwitchManual }) {
  const { t } = useTranslation('championships')
  return (
    <div data-testid="championship-wizard-info" className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{t('wizard.autoMode')}</span>
        <button
          type="button"
          role="switch"
          aria-checked="true"
          aria-label={t('wizard.autoMode')}
          onClick={() => onSwitchManual?.()}
          className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors bg-yellow-500"
        >
          <span className="inline-block size-4 transform rounded-full bg-white shadow-sm transition-transform translate-x-6" />
        </button>
      </div>
      <FormField label={t('wizard.name')} required>
        <Input value={name} onChange={(e) => onNameChange(e.target.value)} placeholder={t('wizard.namePlaceholder')} />
      </FormField>
      <FormField label={t('wizard.track')} required>
        <select
          value={trackId}
          onChange={(e) => onTrackChange(e.target.value)}
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
        >
          <option value="">{t('wizard.selectTrack')}</option>
          {tracks.map((track) => (
            <option key={track.id} value={track.id}>
              {track.name}
            </option>
          ))}
        </select>
      </FormField>
    </div>
  )
}
