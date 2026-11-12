import { useTranslation } from 'react-i18next'
import { useApp } from '@/context/AppContext'
import DriverAvatar from '@/components/driver/DriverAvatar'
import CarPicture from '@/components/car/CarPicture'
import { DivisionBadges } from '@/components/division/DivisionBadge'

const BLACK = ['#000', '#000000', 'black']

// Sizes by width of the board (container queries): tight below @3xl, full above, larger again from @5xl
// when the board is expanded. Written out whole: Tailwind only builds the classes it finds in the source.
const SIZES = {
  compact: {
    picture: 'size-10 @3xl:size-14',
    number: 'text-lg @3xl:text-xl',
    // Exactly the number's line: a division wrapped to the next one stays out of sight
    firstLine: 'h-7',
    // Smaller as the name gets longer, so that it keeps to its place
    name: { short: 'text-4xl @3xl:text-5xl', medium: 'text-3xl @3xl:text-4xl', long: 'text-2xl @3xl:text-3xl' },
  },
  expanded: {
    picture: 'size-10 @3xl:size-14 @5xl:size-16',
    number: 'text-lg @3xl:text-xl @5xl:text-2xl',
    firstLine: 'h-7 @5xl:h-8',
    name: {
      short: 'text-4xl @3xl:text-5xl @5xl:text-6xl',
      medium: 'text-3xl @3xl:text-4xl @5xl:text-5xl',
      long: 'text-2xl @3xl:text-3xl @5xl:text-4xl',
    },
  },
}

const nameLength = (name) => (name.length >= 5 ? 'long' : name.length >= 3 ? 'medium' : 'short')

// Last name in large, photo, car picture, then number and car of a board row, each with its divisions
export default function RowIdentity({ driver, car, color, expanded }) {
  const { isDark } = useApp()
  const { t } = useTranslation('race')
  const sizes = expanded ? SIZES.expanded : SIZES.compact
  const lastName = (driver.name || t('common:unknown')).split(' ').pop()
  return (
    <>
      {/* Last name - Large NASCAR style, room on the right for the italic slant */}
      <div>
        <span
          className={`font-black italic uppercase whitespace-nowrap pr-[0.15em] ${sizes.name[nameLength(lastName)]}`}
          style={{
            color,
            // A black name stays readable on a dark background
            WebkitTextStroke: isDark && BLACK.includes(color?.toLowerCase()) ? '2px white' : 'none',
          }}
        >
          {lastName}
        </span>
      </div>

      {/* The pictures hide one after the other as the board narrows, the car first, before it scrolls;
          their cells stay, empty, so that the columns keep in line */}
      <div className="flex">
        <DriverAvatar
          driver={{ ...driver, name: driver.name || 'D', color }}
          alt={driver.name || 'Driver'}
          className={`${sizes.picture} font-black @max-[32rem]:hidden`}
        />
      </div>

      {/* As big as the driver's picture: a car is wider than tall, a smaller square makes it tiny */}
      <div className="flex">
        {car.img && <CarPicture car={car} className={`${sizes.picture} @max-[35rem]:hidden`} />}
      </div>

      {/* Number and car, in the rest of the width: hidden first when the board narrows (before it scrolls),
          clipped rather than drawn over the figures */}
      <div data-testid="leaderboard-number-car" className="min-w-0 overflow-hidden @max-[40rem]:invisible">
        {/* One line: a division that does not fit wraps out of sight, whole, rather than cut in two */}
        <div className={`flex flex-wrap items-center content-start gap-x-2 ${sizes.firstLine} overflow-hidden min-w-0`}>
          {driver.number && (
            <span className={`font-black ${sizes.number} text-foreground italic pr-[0.2em]`}>{driver.number}</span>
          )}
          <DivisionBadges divisions={driver.divisions} className="contents" />
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
