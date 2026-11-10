import { getImgUrl } from '@/utils/image'

/**
 * A car's picture as it is: the car cut out on a transparent background, shown whole (never cropped)
 * and on its own, with no frame, ring or background around it.
 */
export default function CarPicture({ car, alt = `${car.brand} ${car.model}`, className = '' }) {
  return <img src={getImgUrl(car.img)} alt={alt} className={`shrink-0 object-contain ${className}`} />
}
