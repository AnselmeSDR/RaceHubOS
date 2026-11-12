import { useApp } from '@/context/AppContext'
import { getImgUrl } from '@/utils/image'
import { DivisionBadges } from '@/components/division/DivisionBadge'

/**
 * DriverGridPosition - Format grille de départ NASCAR
 * Affichage ROW 1, ROW 2, etc. `subtitle` sous le nom (la voiture), puis les divisions.
 */
export default function DriverGridPosition({ driver, subtitle, side = 'left' }) {
  const { isDark } = useApp()
  const driverColor = driver.color || '#3B82F6'

  return (
    <div
      data-testid="driver-grid-position"
      className={`flex items-center gap-3 min-w-0 ${side === 'right' ? 'flex-row-reverse' : ''}`}
    >
      {/* Driver card */}
      <div
        className="flex items-center gap-3 p-3 rounded-lg flex-1 min-w-0 shadow-sm dark:shadow-none"
        style={{
          background: `linear-gradient(to right, ${driverColor}45, ${driverColor}25 50%, ${driverColor}08 70%, var(--card))`,
          borderLeft: `5px solid ${driverColor}`,
        }}
      >
        {/* Photo */}
        <div
          className="w-14 h-14 rounded-lg flex items-center justify-center text-white font-black text-xl shadow-md overflow-hidden flex-shrink-0"
          style={{ backgroundColor: driverColor }}
        >
          {driver.img ? (
            <img src={getImgUrl(driver.img)} alt={driver.name} className="w-full h-full object-cover" />
          ) : (
            <span>{driver.name.charAt(0)}</span>
          )}
        </div>

        {/* Number - Large NASCAR style (supports 3 digits) */}
        {driver.number && (
          <div className="flex-shrink-0 w-20">
            <span
              className={`font-black italic ${String(driver.number).length >= 3 ? 'text-4xl' : 'text-5xl'}`}
              style={{
                color: driverColor,
                WebkitTextStroke:
                  isDark && ['#000', '#000000', 'black'].includes(driverColor?.toLowerCase()) ? '2px white' : 'none',
              }}
            >
              {driver.number}
            </span>
          </div>
        )}

        {/* Name */}
        <div className="flex-1 min-w-0">
          <div className="font-black text-xl text-gray-900 dark:text-white uppercase italic truncate">
            {driver.name.split(' ').pop()}
          </div>
          {subtitle && <div className="text-sm text-gray-600 dark:text-gray-400 truncate">{subtitle}</div>}
          <DivisionBadges divisions={driver.divisions} className="flex flex-wrap gap-1 mt-0.5" />
        </div>
      </div>
    </div>
  )
}
