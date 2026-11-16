import { useTranslation } from 'react-i18next'
import { Lock } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { FormField } from '../../crud/FormModal'
import { validity } from './validity'

/** Name and track; the track is frozen once `ran` sessions (any) have run on it. */
export default function WizardInfoStep({ name, trackId, tracks, ran = 0, onNameChange, onTrackChange }) {
  const { t } = useTranslation('championships')
  return (
    <div data-testid="championship-wizard-info" className="space-y-4">
      <FormField label={t('wizard.name')} required>
        <Input
          value={name}
          required
          ref={validity(!name.trim() && t('wizard.nameRequired'))}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder={t('wizard.namePlaceholder')}
        />
      </FormField>
      <FormField label={t('wizard.track')} required>
        <select
          value={trackId}
          required
          ref={validity(!trackId && t('wizard.trackRequired'))}
          disabled={ran > 0}
          aria-label={t('wizard.track')}
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
        {ran > 0 && (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Lock aria-hidden="true" className="size-3" />
            {t('wizard.trackLocked', { count: ran })}
          </p>
        )}
      </FormField>
    </div>
  )
}
