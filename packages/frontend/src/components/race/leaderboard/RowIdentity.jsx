import { useTranslation } from 'react-i18next'
import { useApp } from '@/context/AppContext'
import { getImgUrl } from '@/utils/image'

const BLACK = ['#000', '#000000', 'black']

const numberSize = (number, expanded) => {
  const long = String(number).length >= 3
  if (expanded) return long ? 'text-5xl' : 'text-6xl'
  return long ? 'text-4xl' : 'text-5xl'
}

// Photo, number, car picture, name and car of a board row
export default function RowIdentity({ driver, car, color, expanded }) {
  const { isDark } = useApp()
  const { t } = useTranslation('race')
  return (
    <>
      <div
        className={`${expanded ? 'w-16 h-16' : 'w-14 h-14'} rounded-lg flex items-center justify-center text-white font-black text-xl shadow-md overflow-hidden flex-shrink-0`}
        style={{ backgroundColor: color }}
      >
        {driver.img ? (
          <img src={getImgUrl(driver.img)} alt={driver.name || 'Driver'} className="w-full h-full object-cover" />
        ) : (
          <span>{(driver.name || 'D').charAt(0)}</span>
        )}
      </div>

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

      {car.img && (
        <div className="w-14 h-10 rounded flex-shrink-0 overflow-hidden shadow-md">
          <img src={getImgUrl(car.img)} alt={`${car.brand} ${car.model}`} className="w-full h-full object-cover" />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className={`font-black ${expanded ? 'text-2xl' : 'text-xl'} text-foreground uppercase italic truncate`}>
          {(driver.name || t('common:unknown')).split(' ').pop()}
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
        </div>
      </div>
    </>
  )
}
