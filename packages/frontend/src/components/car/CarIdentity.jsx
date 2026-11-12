import { useTranslation } from 'react-i18next'
import { Zap, Flame, FlaskConical } from 'lucide-react'
import { formatLevel } from '@racehubos/shared'
import LapTime from '@/components/race/LapTime'
import { carColor } from '@/lib/colors'
import CarPicture from '@/components/car/CarPicture'
import { DivisionBadges } from '@/components/division/DivisionBadge'

/** Picture, name and figures of a car, at the top of its profile. */
export default function CarIdentity({ car }) {
  const { t } = useTranslation('cars')
  const color = carColor(car)

  return (
    <div className="flex items-center gap-3" data-testid="car-identity">
      {car.img ? (
        <CarPicture car={car} className="w-16 h-10" />
      ) : (
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold flex-shrink-0"
          style={{ backgroundColor: color }}
        >
          {car.brand.charAt(0)}
        </div>
      )}
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-black text-lg" style={{ color }}>
            {car.brand} {car.model}
          </h1>
          {car.year && <span className="text-sm text-muted-foreground">{car.year}</span>}
          <DivisionBadges divisions={car.divisions} />
        </div>
        <div className="text-xs text-muted-foreground flex items-center gap-3">
          <span className="flex items-center gap-1">
            <Zap className="size-3 text-green-500" />
            {formatLevel(car.maxSpeed)}
          </span>
          <span className="flex items-center gap-1">
            <Flame className="size-3 text-red-500" />
            {formatLevel(car.brakeForce)}
          </span>
          <span className="flex items-center gap-1">
            <FlaskConical className="size-3 text-blue-500" />
            {formatLevel(car.fuelCapacity)}
          </span>
          <span>
            {car._count?.sessions || 0} {t('glossary:session', { count: car._count?.sessions || 0 })}
          </span>
          {car.bestLap && (
            <span className="flex items-center gap-1">
              {t('common:record')} <LapTime time={car.bestLap} size="sm" />
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
