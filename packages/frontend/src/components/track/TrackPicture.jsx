import { MapPin } from 'lucide-react'
import PictureLayer from '@/components/picture/PictureLayer'
import { trackColor } from '@/lib/colors'

/** A track's picture in the common layer, or a pin on its colour. */
export default function TrackPicture({ track, alt = '', className = 'size-8' }) {
  return (
    <PictureLayer img={track.img} color={trackColor(track)} alt={alt} className={className}>
      <MapPin className="size-1/2" />
    </PictureLayer>
  )
}
