import { useTranslation } from 'react-i18next'
import TrackPicture from './TrackPicture'
import { trackColor } from '@/lib/colors'

/** Picture, name and figures of a track, at the top of its profile. */
export default function TrackIdentity({ track }) {
  const { t } = useTranslation('tracks')
  const color = trackColor(track)

  return (
    <div className="flex items-center gap-3" data-testid="track-identity">
      <TrackPicture track={track} alt={track.name} className="size-10" />
      <div>
        <h1 className="font-black text-lg" style={{ color }}>
          {track.name}
        </h1>
        <div className="text-xs text-muted-foreground flex items-center gap-3">
          {track.length && <span>{track.length}m</span>}
          {track.corners && <span>{t('profile.cornersCount', { count: track.corners })}</span>}
          <span>
            {track._count?.sessions || 0} {t('glossary:session', { count: track._count?.sessions || 0 })}
          </span>
        </div>
      </div>
    </div>
  )
}
