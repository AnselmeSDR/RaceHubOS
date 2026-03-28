import { Trophy } from 'lucide-react'
import LapTime from '../race/LapTime'

/**
 * Reusable entity card with NASCAR-style design
 * Used by Drivers, Cars, Teams, Tracks, Championships pages
 *
 * @param {object} props
 * @param {string} props.title - Main title (name)
 * @param {string} props.subtitle - Subtitle (team, brand, etc.)
 * @param {string} props.image - Image URL
 * @param {string} props.color - Entity color
 * @param {React.ReactNode} props.icon - Fallback icon if no image
 * @param {Array} props.stats - Array of { icon, label, value, highlight }
 * @param {object} props.record - Optional record { time, holder }
 * @param {function} props.onClick - Card click handler
 * @param {React.ReactNode} props.badge - Optional badge component
 * @param {React.ReactNode} props.footer - Optional footer content
 */
export default function EntityCard({
  title,
  subtitle,
  image,
  color = '#6B7280',
  icon,
  stats = [],
  record,
  onClick,
  badge,
  footer
}) {
  return (
    <div
      onClick={onClick}
      className="group bg-white rounded-2xl shadow-lg overflow-hidden cursor-pointer transform hover:scale-[1.02] transition-all duration-300 hover:shadow-xl relative"
    >
      {/* Racing stripe effect */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1.5"
        style={{ backgroundColor: color }}
      />

      {/* Header with gradient */}
      <div
        className="relative h-24 flex items-center justify-center overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${color}15 0%, ${color}30 100%)`
        }}
      >
        {/* Pattern overlay */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `repeating-linear-gradient(45deg, ${color} 0, ${color} 1px, transparent 0, transparent 50%)`,
            backgroundSize: '10px 10px'
          }}
        />

        {/* Avatar/Logo */}
        <div
          className="relative w-16 h-16 rounded-full ring-4 ring-white shadow-lg overflow-hidden flex items-center justify-center"
          style={{ backgroundColor: color }}
        >
          {image ? (
            <img src={image} alt={title} className="w-full h-full object-cover" />
          ) : icon ? (
            <span className="text-white">{icon}</span>
          ) : (
            <span className="text-2xl font-bold text-white">
              {title?.charAt(0) || '?'}
            </span>
          )}
        </div>

        {/* Optional badge */}
        {badge && (
          <div className="absolute top-3 right-3">
            {badge}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Title */}
        <h3 className="font-bold text-lg text-gray-900 mb-1 truncate">
          {title}
        </h3>

        {subtitle && (
          <p className="text-sm text-gray-500 mb-3 truncate">{subtitle}</p>
        )}

        {/* Stats grid */}
        {stats.length > 0 && (
          <div className="grid grid-cols-2 gap-2 mb-3">
            {stats.map((stat, idx) => (
              <StatBadge key={idx} {...stat} color={color} />
            ))}
          </div>
        )}

        {/* Record section */}
        {record && record.time && (
          <div
            className="mt-3 p-2 rounded-lg"
            style={{ backgroundColor: `${color}10` }}
          >
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-yellow-500" />
              <span className="text-xs text-gray-600">Record:</span>
              <LapTime time={record.time} size="sm" />
            </div>
            {record.holder && (
              <p className="text-xs text-gray-500 mt-1 truncate">
                par {record.holder}
              </p>
            )}
          </div>
        )}

        {/* Footer */}
        {footer && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            {footer}
          </div>
        )}
      </div>

      {/* Hover glow effect */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
        style={{
          boxShadow: `0 0 30px ${color}40`
        }}
      />
    </div>
  )
}

/**
 * Stat badge component
 */
export function StatBadge({ icon, label, value, highlight }) {
  return (
    <div
      className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs ${
        highlight ? 'bg-yellow-50' : 'bg-gray-50'
      }`}
    >
      {icon && (
        <span className={highlight ? 'text-yellow-500' : 'text-gray-400'}>
          {icon}
        </span>
      )}
      <span className="text-gray-500">{label}</span>
      <span className={`font-bold ${highlight ? 'text-yellow-600' : 'text-gray-700'}`}>
        {value}
      </span>
    </div>
  )
}
