import PictureLayer from '@/components/picture/PictureLayer'
import { carColor } from '@/lib/colors'

/**
 * A car's picture in the common layer, shown whole (an older picture that is not square is never
 * cropped), or the brand's initial on the car's colour.
 */
export default function CarPicture({ car, alt = `${car.brand} ${car.model}`, className = 'size-8' }) {
  return (
    <PictureLayer img={car.img} color={carColor(car)} alt={alt} fit="contain" className={className}>
      <span className="text-[42cqw] font-black">{car.brand?.charAt(0)}</span>
    </PictureLayer>
  )
}
