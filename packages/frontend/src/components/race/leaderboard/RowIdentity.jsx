import { useTranslation } from 'react-i18next'
import { useApp } from '@/context/AppContext'
import DriverAvatar from '@/components/driver/DriverAvatar'
import CarPicture from '@/components/car/CarPicture'
import { DivisionBadges } from '@/components/division/DivisionBadge'

const BLACK = ['#000', '#000000', 'black']

const numberSize = (number, expanded) => {
  const long = String(number).length >= 3
  if (expanded) return long ? 'text-5xl' : 'text-6xl'
  return long ? 'text-4xl' : 'text-5xl'
}

// Photo, number, car picture, name and car of a board row, each with its divisions
export default function RowIdentity({ driver, car, color, expanded }) {
  const { isDark } = useApp()
  const { t } = useTranslation('race')
  const pictureSize = expanded ? 'size-16' : 'size-14'
  return (
    <>
      <DriverAvatar
        driver={{ ...driver, name: driver.name || 'D', color }}
        alt={driver.name || 'Driver'}
        className={`${pictureSize} font-black`}
      />

      {/* Number - Large NASCAR style (supports 3 digits) */}
      {driver.number && (
        <div className={`flex-shrink-0 w-20 ${expanded ? 'mr-6' : 'mr-2'}`}>
          <span
            className={`font-black italic ${numberSize(driver.number, expanded)}`}
            style={{
              color,
              // A black number stays readable on a dark background
              WebkitTextStroke: isDark && BLACK.includes(color?.toLowerCase()) ? '2px white' : 'none',
            }}
          >
            {driver.number}
          </span>
        </div>
      )}

      {/* As big as the driver's picture: a car is wider than tall, a smaller square makes it tiny */}
      {car.img && <CarPicture car={car} className={pictureSize} />}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          {/* Room on the right for the italic slant, which truncate would clip */}
          <span
            className={`font-black ${expanded ? 'text-2xl' : 'text-xl'} text-foreground uppercase italic truncate pr-[0.2em]`}
          >
            {(driver.name || t('common:unknown')).split(' ').pop()}
          </span>
          <DivisionBadges divisions={driver.divisions} className="flex shrink-0 items-center gap-1" />
        </div>
        <div className="text-sm text-muted-foreground flex items-center gap-1.5">
          {car.color && (
            <span
              className="w-3 h-3 rounded-full flex-shrink-0 border border-border"
              style={{ backgroundColor: car.color }}
            />
          )}
          {/* Own span: an ellipsis does not apply to bare text in a flex row */}
          <span className="truncate">
            {car.brand} {car.model || car.name || ''}
          </span>
          <DivisionBadges divisions={car.divisions} className="flex shrink-0 items-center gap-1" />
        </div>
      </div>
    </>
  )
}
