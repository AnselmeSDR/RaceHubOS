import { TrophyIcon, FlagIcon, ChartBarIcon } from '@heroicons/react/24/outline'
import { TrophyIcon as TrophySolidIcon } from '@heroicons/react/24/solid'
import { useTheme } from '../context/ThemeContext'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

const getImgUrl = (img) => {
  if (!img) return null
  return img.startsWith('http') ? img : `${API_URL}${img}`
}

/**
 * DriverListItem - Format horizontal compact pour listes et sélections
 * Inspiré du style NASCAR Starting Grid
 */
export function DriverListItem({ driver, position, selected, onClick, showStats = false }) {
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
          <img
            src={getImgUrl(driver.img)}
            alt={driver.name}
            className="w-full h-full rounded-full object-cover"
          />
        ) : (
          <span>{driver.name.charAt(0)}</span>
        )}
      </div>

      {/* Driver number - NASCAR style */}
      {driver.number && (
        <div
          className="w-16 h-12 rounded flex items-center justify-center shadow-md flex-shrink-0"
          style={{ backgroundColor: driver.color }}
        >
          <span
            className="text-2xl font-black text-white italic"
            style={{ textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}
          >
            {driver.number}
          </span>
        </div>
      )}

      {/* Driver info */}
      <div className="flex-1 min-w-0">
        <div className="font-bold text-gray-900 dark:text-white truncate uppercase tracking-wide">
          {driver.name}
        </div>
        {driver.team && (
          <div className="text-sm text-gray-500 dark:text-gray-400 truncate">{driver.team.name}</div>
        )}
      </div>

      {/* Stats if enabled */}
      {showStats && (
        <div className="flex gap-4 text-sm">
          <div className="text-center">
            <div className="text-gray-500 dark:text-gray-400 text-xs">Courses</div>
            <div className="font-bold text-gray-900 dark:text-white">{driver._count?.sessions || 0}</div>
          </div>
          <div className="text-center">
            <div className="text-gray-500 dark:text-gray-400 text-xs">Victoires</div>
            <div className="font-bold text-yellow-600">{driver.wins || 0}</div>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * DriverBadge - Badge compact avec numéro
 * Pour affichage live, mini-cartes, etc.
 */
export function DriverBadge({ driver, size = 'md', showName = true }) {
  const sizes = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-12 h-12 text-lg',
    lg: 'w-16 h-16 text-2xl',
    xl: 'w-20 h-20 text-3xl'
  }

  return (
    <div className="inline-flex items-center gap-2">
      <div
        className={`
          ${sizes[size]} rounded-lg flex items-center justify-center
          text-white font-black italic shadow-lg flex-shrink-0
        `}
        style={{
          background: `linear-gradient(135deg, ${driver.color} 0%, ${driver.color}DD 100%)`,
        }}
      >
        <span style={{ textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
          {driver.number || driver.name.charAt(0)}
        </span>
      </div>
      {showName && (
        <span className="font-bold text-gray-900 dark:text-white uppercase tracking-wide">
          {driver.name}
        </span>
      )}
    </div>
  )
}

/**
 * DriverGridPosition - Format grille de départ NASCAR
 * Affichage ROW 1, ROW 2, etc.
 */
export function DriverGridPosition({ driver, side = 'left' }) {
  const { isDark } = useTheme()
  const gradientEnd = isDark ? '#1f2937' : 'white'
  const driverColor = driver.color || '#3B82F6'

  return (
    <div className={`flex items-center gap-3 ${side === 'right' ? 'flex-row-reverse' : ''}`}>
      {/* Driver card */}
      <div
        className="flex items-center gap-3 p-3 rounded-lg flex-1"
        style={{
          background: `linear-gradient(to ${side === 'left' ? 'right' : 'left'}, ${driverColor}45, ${driverColor}25 50%, ${driverColor}08 70%, ${gradientEnd})`,
          borderLeft: side === 'left' ? `5px solid ${driverColor}` : 'none',
          borderRight: side === 'right' ? `5px solid ${driverColor}` : 'none',
          boxShadow: isDark ? 'none' : `0 2px 12px ${driverColor}40`,
        }}
      >
        {/* Photo */}
        <div
          className="w-14 h-14 rounded-lg flex items-center justify-center text-white font-black text-xl shadow-md overflow-hidden flex-shrink-0"
          style={{ backgroundColor: driverColor }}
        >
          {driver.img ? (
            <img
              src={getImgUrl(driver.img)}
              alt={driver.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <span>{driver.name.charAt(0)}</span>
          )}
        </div>

        {/* Number - Large NASCAR style */}
        {driver.number && (
          <div className="flex-shrink-0 w-16">
            <span
              className="text-5xl font-black italic"
              style={{
                color: driverColor,
                WebkitTextStroke: isDark && ['#000', '#000000', 'black'].includes(driverColor?.toLowerCase()) ? '2px white' : 'none',
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
          {driver.team && (
            <div className="text-sm text-gray-600 dark:text-gray-400 truncate">{driver.team.name}</div>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * DriverProfileHeader - En-tête de profil détaillé
 * Style F1 avec toutes les stats
 */
export function DriverProfileHeader({ driver }) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl shadow-2xl"
      style={{
        background: `linear-gradient(135deg, ${driver.color}20 0%, ${driver.color}05 100%)`,
      }}
    >
      {/* Background pattern */}
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `repeating-linear-gradient(
            45deg,
            ${driver.color},
            ${driver.color} 10px,
            transparent 10px,
            transparent 20px
          )`
        }}
      />

      <div className="relative p-8">
        <div className="flex items-start gap-6">
          {/* Large avatar */}
          <div className="relative flex-shrink-0">
            <div
              className="absolute inset-0 rounded-2xl blur-xl opacity-50"
              style={{ backgroundColor: driver.color }}
            />
            <div
              className="relative w-32 h-32 rounded-2xl flex items-center justify-center text-white font-black text-5xl ring-4 ring-white shadow-2xl overflow-hidden"
              style={{
                background: `linear-gradient(135deg, ${driver.color} 0%, ${driver.color}CC 100%)`,
              }}
            >
              {driver.img ? (
                <img
                  src={getImgUrl(driver.img)}
                  alt={driver.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="drop-shadow-lg">{driver.name.charAt(0)}</span>
              )}
            </div>

            {/* Number badge overlay */}
            {driver.number && (
              <div
                className="absolute -bottom-3 -right-3 w-16 h-16 rounded-xl flex items-center justify-center shadow-xl ring-4 ring-white"
                style={{ backgroundColor: driver.color }}
              >
                <span className="text-3xl font-black text-white italic">
                  {driver.number}
                </span>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1">
            {/* Team badge */}
            {driver.team && (
              <div
                className="inline-block px-4 py-1 rounded-full text-sm font-bold text-white shadow-md mb-3"
                style={{ backgroundColor: driver.team.color || driver.color }}
              >
                {driver.team.name}
              </div>
            )}

            {/* Name */}
            <h1
              className="font-black text-5xl tracking-tight mb-2"
              style={{
                color: driver.color,
                textShadow: '0 2px 8px rgba(0,0,0,0.1)'
              }}
            >
              {driver.name.toUpperCase()}
            </h1>

            {/* Stats row */}
            <div className="grid grid-cols-4 gap-4 mt-6">
              <StatBox
                icon={<FlagIcon className="w-5 h-5" />}
                label="Courses"
                value={driver._count?.sessions || 0}
                color={driver.color}
              />
              <StatBox
                icon={<TrophySolidIcon className="w-5 h-5" />}
                label="Victoires"
                value={driver.wins || 0}
                color="#EAB308"
                highlight
              />
              <StatBox
                icon={<TrophyIcon className="w-5 h-5" />}
                label="Podiums"
                value={driver.podiums || 0}
                color={driver.color}
              />
              <StatBox
                icon={<ChartBarIcon className="w-5 h-5" />}
                label="Tours"
                value={driver._count?.laps || 0}
                color={driver.color}
              />
            </div>

            {/* Best lap */}
            {driver.bestLap && (
              <div className="mt-4 inline-block">
                <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-lg px-6 py-3 shadow-md">
                  <div className="text-xs text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">
                    Meilleur Tour
                  </div>
                  <div
                    className="text-3xl font-black tabular-nums"
                    style={{ color: driver.color }}
                  >
                    {(driver.bestLap / 1000).toFixed(3)}s
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Racing stripe */}
      <div
        className="absolute top-0 left-0 w-2 h-full"
        style={{ backgroundColor: driver.color }}
      />
    </div>
  )
}

/**
 * DriverStanding - Pour classements avec position
 * Style F1/NASCAR standings
 */
export function DriverStanding({ driver, position, points, change }) {
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
          <div className="font-bold text-gray-900 dark:text-white truncate uppercase">
            {driver.name}
          </div>
          {driver.team && (
            <div className="text-sm text-gray-500 dark:text-gray-400 truncate">{driver.team.name}</div>
          )}
        </div>
      </div>

      {/* Points */}
      {points !== undefined && (
        <div className="text-right flex-shrink-0">
          <div className="text-2xl font-black" style={{ color: driver.color }}>
            {points}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 uppercase">Points</div>
        </div>
      )}
    </div>
  )
}

/**
 * DriverSelectCard - Carte pour sélection multi-pilotes
 * Style TV NASCAR avec constructeur
 */
export function DriverSelectCard({ driver, selected, onToggle }) {
  return (
    <button
      onClick={onToggle}
      className={`
        relative w-full p-4 rounded-xl transition-all duration-200 text-left
        ${selected
          ? 'ring-4 ring-blue-500 bg-blue-50 dark:bg-blue-900/30 shadow-xl scale-105'
          : 'bg-white dark:bg-gray-800 shadow hover:shadow-lg'
        }
      `}
    >
      {/* Selection indicator */}
      {selected && (
        <div className="absolute top-2 right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
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
            <img
              src={getImgUrl(driver.img)}
              alt={driver.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <span>{driver.name.charAt(0)}</span>
          )}
        </div>

        {/* Number - Large */}
        {driver.number && (
          <div
            className="w-20 h-16 rounded-lg flex items-center justify-center shadow-md flex-shrink-0"
            style={{ backgroundColor: driver.color }}
          >
            <span className="text-4xl font-black text-white italic">
              {driver.number}
            </span>
          </div>
        )}

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="font-black text-lg text-gray-900 dark:text-white uppercase truncate">
            {driver.name}
          </div>
          {driver.team && (
            <div
              className="inline-block mt-1 px-2 py-0.5 rounded text-xs font-bold text-white"
              style={{ backgroundColor: driver.team.color || driver.color }}
            >
              {driver.team.name}
            </div>
          )}
        </div>
      </div>
    </button>
  )
}

// Helper component for stats
function StatBox({ icon, label, value, color, highlight }) {
  return (
    <div
      className={`
        p-3 rounded-lg text-center transition-all
        ${highlight ? 'bg-yellow-50 dark:bg-yellow-900/30 ring-2 ring-yellow-400' : 'bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm'}
      `}
    >
      <div
        className="flex items-center justify-center mb-1"
        style={{ color: highlight ? '#EAB308' : color }}
      >
        {icon}
      </div>
      <div className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">
        {label}
      </div>
      <div
        className="text-xl font-black tabular-nums"
        style={{ color: highlight ? '#EAB308' : color }}
      >
        {value}
      </div>
    </div>
  )
}
