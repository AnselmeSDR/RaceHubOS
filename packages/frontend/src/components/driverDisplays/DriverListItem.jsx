import { useTranslation } from 'react-i18next'
import { getImgUrl } from '@/utils/image'

/**
 * DriverListItem - Format horizontal compact pour listes et sélections
 * Inspiré du style NASCAR Starting Grid
 */
export default function DriverListItem({ driver, position, selected, onClick, showStats = false }) {
  const { t } = useTranslation('displays')
  return (
    <div
      onClick={onClick}
      className={`
        flex items-center gap-3 p-3 rounded-lg transition-all duration-200 cursor-pointer
        ${selected ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-700'}
      `}
    >
      {/* Position number if provided */}
      {position !== undefined && (
        <div className="w-8 text-center">
          <span className="text-lg font-bold text-gray-400 dark:text-gray-500">{position}</span>
        </div>
      )}

      {/* Driver photo/avatar */}
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center text-white font-black text-lg ring-2 ring-white shadow-md flex-shrink-0"
        style={{
          background: `linear-gradient(135deg, ${driver.color} 0%, ${driver.color}CC 100%)`,
        }}
      >
        {driver.img ? (
          <img src={getImgUrl(driver.img)} alt={driver.name} className="w-full h-full rounded-full object-cover" />
        ) : (
          <span>{driver.name.charAt(0)}</span>
        )}
      </div>

      {/* Driver number - NASCAR style (supports 3 digits) */}
      {driver.number && (
        <div
          className="w-20 h-12 rounded flex items-center justify-center shadow-md flex-shrink-0"
          style={{ backgroundColor: driver.color }}
        >
          <span
            className={`font-black text-white italic ${String(driver.number).length >= 3 ? 'text-xl' : 'text-2xl'}`}
            style={{ textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}
          >
            {driver.number}
          </span>
        </div>
      )}

      {/* Driver info */}
      <div className="flex-1 min-w-0">
        <div className="font-bold text-gray-900 dark:text-white truncate uppercase tracking-wide">{driver.name}</div>
        {driver.team && <div className="text-sm text-gray-500 dark:text-gray-400 truncate">{driver.team.name}</div>}
      </div>

      {/* Stats if enabled */}
      {showStats && (
        <div className="flex gap-4 text-sm">
          <div className="text-center">
            <div className="text-gray-500 dark:text-gray-400 text-xs">{t('driverDisplays.races')}</div>
            <div className="font-bold text-gray-900 dark:text-white">{driver._count?.sessions || 0}</div>
          </div>
          <div className="text-center">
            <div className="text-gray-500 dark:text-gray-400 text-xs">{t('driverDisplays.wins')}</div>
            <div className="font-bold text-yellow-600">{driver.wins || 0}</div>
          </div>
        </div>
      )}
    </div>
  )
}
