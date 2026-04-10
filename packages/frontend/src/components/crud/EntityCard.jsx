import { Trophy } from 'lucide-react'
import LapTime from '../race/LapTime'

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
      className="group bg-card rounded-2xl shadow-sm border border-border overflow-hidden cursor-pointer hover:shadow-md transition-all duration-200 relative"
    >
      {/* Racing stripe */}
      <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ backgroundColor: color }} />

      {/* Header */}
      <div
        className="relative h-24 flex items-center justify-center overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${color}15 0%, ${color}30 100%)` }}
      >
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `repeating-linear-gradient(45deg, ${color} 0, ${color} 1px, transparent 0, transparent 50%)`,
            backgroundSize: '10px 10px'
          }}
        />
        <div
          className="relative w-16 h-16 rounded-full ring-4 ring-card shadow-lg overflow-hidden flex items-center justify-center"
          style={{ backgroundColor: color }}
        >
          {image ? (
            <img src={image} alt={title} className="w-full h-full object-cover" />
          ) : icon ? (
            <span className="text-white">{icon}</span>
          ) : (
            <span className="text-2xl font-bold text-white">{title?.charAt(0) || '?'}</span>
          )}
        </div>
        {badge && <div className="absolute top-3 right-3">{badge}</div>}
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-bold text-lg text-foreground mb-1 truncate">{title}</h3>
        {subtitle && <p className="text-sm text-muted-foreground mb-3 truncate">{subtitle}</p>}

        {stats.length > 0 && (
          <div className="grid grid-cols-2 gap-2 mb-3">
            {stats.map((stat, idx) => (
              <StatBadge key={idx} {...stat} />
            ))}
          </div>
        )}

        {record && record.time && (
          <div className="mt-3 p-2 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2">
              <Trophy className="size-4 text-yellow-500" />
              <span className="text-xs text-muted-foreground">Record:</span>
              <LapTime time={record.time} size="sm" />
            </div>
            {record.holder && (
              <p className="text-xs text-muted-foreground mt-1 truncate">par {record.holder}</p>
            )}
          </div>
        )}

        {footer && <div className="mt-3 pt-3 border-t border-border">{footer}</div>}
      </div>
    </div>
  )
}

export function StatBadge({ icon, label, value, highlight }) {
  return (
    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs ${highlight ? 'bg-yellow-500/10' : 'bg-muted/50'}`}>
      {icon && <span className={highlight ? 'text-yellow-500' : 'text-muted-foreground'}>{icon}</span>}
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-bold ${highlight ? 'text-yellow-600 dark:text-yellow-400' : 'text-foreground'}`}>{value}</span>
    </div>
  )
}
