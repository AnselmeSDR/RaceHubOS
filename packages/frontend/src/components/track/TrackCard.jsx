import { useTranslation } from 'react-i18next'
import PictureLayer from '@/components/picture/PictureLayer'
import { trackColor } from '@/lib/colors'
import { pictureName } from '@/lib/viewTransition'
import { PRESS } from '@/lib/press'

/** A track in the grid of the tracks page: its picture or its colour, then its length, corners and sessions. */
export default function TrackCard({ track, onClick }) {
  const { t } = useTranslation('tracks')
  const sessions = track._count?.sessions || 0
  const facts = [
    track.length && `${track.length}m`,
    track.corners && t('profile.cornersCount', { count: track.corners }),
    `${sessions} ${t('glossary:session', { count: sessions })}`,
  ].filter(Boolean)

  return (
    <article
      data-testid="entity-card"
      data-entity-id={track.id}
      onClick={onClick}
      className={`flex h-[60px] cursor-pointer items-center gap-2.5 rounded-xl border border-border bg-card px-2.5 hover:border-foreground/30 ${PRESS}`}
    >
      <PictureLayer
        img={track.img}
        color={trackColor(track)}
        className="size-10"
        transitionName={pictureName('track', track.id)}
      />
      <div className="min-w-0">
        <h3 className="truncate text-sm font-bold text-foreground">{track.name}</h3>
        <p className="truncate text-[11px] text-muted-foreground">{facts.join(' · ')}</p>
      </div>
    </article>
  )
}
