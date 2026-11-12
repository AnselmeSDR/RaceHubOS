import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import { FormField } from '../../crud/FormModal'

export default function WizardInfoStep({ name, trackId, tracks, onNameChange, onTrackChange }) {
  const { t } = useTranslation('championships')
  return (
    <div data-testid="championship-wizard-info" className="space-y-4">
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
