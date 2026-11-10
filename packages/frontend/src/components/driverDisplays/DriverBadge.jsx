/**
 * DriverBadge - Badge compact avec numéro
 * Pour affichage live, mini-cartes, etc.
 */
export default function DriverBadge({ driver, size = 'md', showName = true }) {
  const sizes = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-12 h-12 text-lg',
    lg: 'w-16 h-16 text-2xl',
    xl: 'w-20 h-20 text-3xl',
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
        <span style={{ textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>{driver.number || driver.name.charAt(0)}</span>
      </div>
      {showName && (
        <span className="font-bold text-gray-900 dark:text-white uppercase tracking-wide">{driver.name}</span>
      )}
    </div>
  )
}
