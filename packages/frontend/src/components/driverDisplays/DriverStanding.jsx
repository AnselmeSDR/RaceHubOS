import DriverBadge from './DriverBadge'
import { useTranslation } from 'react-i18next'

/**
 * DriverStanding - Pour classements avec position
 * Style F1/NASCAR standings
 */
export default function DriverStanding({ driver, position, points, change }) {
  const { t } = useTranslation('displays')
  const positionColors = {
    1: 'bg-yellow-400 text-yellow-900',
    2: 'bg-gray-300 text-gray-900',
    3: 'bg-orange-400 text-orange-900',
  }

  return (
    <div className="flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow">
      {/* Position */}
      <div
        className={`
          w-12 h-12 rounded-lg flex items-center justify-center font-black text-xl flex-shrink-0
          ${positionColors[position] || 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}
        `}
      >
        {position}
      </div>

      {/* Change indicator */}
      {change !== undefined && change !== 0 && (
        <div className="flex-shrink-0">
          {change > 0 ? (
            <div className="text-green-500 text-sm font-bold">↑{change}</div>
          ) : (
            <div className="text-red-500 text-sm font-bold">↓{Math.abs(change)}</div>
          )}
        </div>
      )}

      {/* Driver badge */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <DriverBadge driver={driver} size="md" showName={false} />
        <div className="flex-1 min-w-0">
          <div className="font-bold text-gray-900 dark:text-white truncate uppercase">{driver.name}</div>
          {driver.team && <div className="text-sm text-gray-500 dark:text-gray-400 truncate">{driver.team.name}</div>}
        </div>
      </div>

      {/* Points */}
      {points !== undefined && (
        <div className="text-right flex-shrink-0">
          <div className="text-2xl font-black" style={{ color: driver.color }}>
            {points}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 uppercase">{t('driverDisplays.points')}</div>
        </div>
      )}
    </div>
  )
}
