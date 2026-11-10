import { useTranslation } from 'react-i18next'
import { MapPin } from 'lucide-react'
import { getImgUrl } from '@/utils/image'
import { trackColor } from '@/lib/colors'

/** Picture, name and figures of a track, at the top of its profile. */
export default function TrackIdentity({ track }) {
  const { t } = useTranslation('tracks')
  const color = trackColor(track)

  return (
    <div className="flex items-center gap-3" data-testid="track-identity">
      {track.img ? (
        <div
          className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 ring-2 ring-offset-2 ring-offset-background"
          style={{ '--tw-ring-color': color }}
        >
          <img src={getImgUrl(track.img)} alt={track.name} className="w-full h-full object-cover" />
        </div>
      ) : (
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center text-white flex-shrink-0"
          style={{ backgroundColor: color }}
        >
          <MapPin className="size-5" />
        </div>
      )}
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
