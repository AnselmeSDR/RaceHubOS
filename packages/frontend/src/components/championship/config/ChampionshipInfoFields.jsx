import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const NO_TRACK = '_none'

export default function ChampionshipInfoFields({
  championship,
  tracks,
  name,
  trackId,
  disabled,
  onNameChange,
  onTrackChange,
}) {
  const { t } = useTranslation('championships')

  // The track list only carries active tracks; a championship run on a since-deleted
  // track would otherwise show an empty field instead of its actual value.
  const trackOptions = useMemo(() => {
    const current = championship?.track
    if (!current || tracks.some((tr) => tr.id === current.id)) return tracks
    return [...tracks, { ...current, isDeleted: true }]
  }, [tracks, championship?.track])

  return (
    <div data-testid="championship-config-info" className="grid grid-cols-2 gap-3">
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">{t('configModal.name')}</label>
        <Input value={name} onChange={(e) => onNameChange(e.target.value)} disabled={disabled} />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">{t('configModal.track')}</label>
        <Select
          value={trackId || NO_TRACK}
          onValueChange={(v) => onTrackChange(v === NO_TRACK ? '' : v)}
          disabled={disabled}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={t('configModal.selectTrack')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_TRACK}>{t('configModal.selectPlaceholder')}</SelectItem>
            {trackOptions.map((track) => (
              <SelectItem key={track.id} value={track.id}>
                {track.isDeleted ? t('configModal.deletedTrack', { name: track.name }) : track.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
