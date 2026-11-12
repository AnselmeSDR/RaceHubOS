import { getImgUrl } from '@/utils/image'
import { DivisionBadges } from '@/components/division/DivisionBadge'

/**
 * DriverSelectCard - Carte pour sélection multi-pilotes
 * Style TV NASCAR avec constructeur
 */
export default function DriverSelectCard({ driver, selected, onToggle }) {
  return (
    <button
      data-testid="driver-select-card"
      onClick={onToggle}
      className={`
        relative w-full p-4 rounded-xl transition-all duration-200 text-left
        ${
          selected
            ? 'ring-4 ring-blue-500 bg-blue-50 dark:bg-blue-900/30 shadow-xl scale-105'
            : 'bg-white dark:bg-gray-800 shadow hover:shadow-lg'
        }
      `}
    >
      {/* Selection indicator */}
      {selected && (
        <div className="absolute top-2 right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      )}

      <div className="flex items-center gap-3">
        {/* Photo */}
        <div
          className="w-16 h-16 rounded-lg flex items-center justify-center text-white font-black text-2xl shadow-lg overflow-hidden flex-shrink-0"
          style={{ backgroundColor: driver.color }}
        >
          {driver.img ? (
            <img src={getImgUrl(driver.img)} alt={driver.name} className="w-full h-full object-cover" />
          ) : (
            <span>{driver.name.charAt(0)}</span>
          )}
        </div>

        {/* Number - Large (supports 3 digits) */}
        {driver.number && (
          <div
            className="w-20 h-16 rounded-lg flex items-center justify-center shadow-md flex-shrink-0"
            style={{ backgroundColor: driver.color }}
          >
            <span
              className={`font-black text-white italic ${String(driver.number).length >= 3 ? 'text-3xl' : 'text-4xl'}`}
            >
              {driver.number}
            </span>
          </div>
        )}

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="font-black text-lg text-gray-900 dark:text-white uppercase truncate">{driver.name}</div>
          <DivisionBadges divisions={driver.divisions} className="flex flex-wrap gap-1 mt-1" />
        </div>
      </div>
    </button>
  )
}
