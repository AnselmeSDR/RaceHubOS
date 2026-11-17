import { MapPin } from 'lucide-react'
import PictureLayer from '@/components/picture/PictureLayer'
import { trackColor } from '@/lib/colors'

/** A track's picture in the common layer, or a pin on its colour. */
export default function TrackPicture({ track, alt = '', className = 'size-8', transitionName }) {
  return (
    <PictureLayer
      img={track.img}
      color={trackColor(track)}
      alt={alt}
      className={className}
      transitionName={transitionName}
    >
      <MapPin className="size-1/2" />
    </PictureLayer>
  )
}
