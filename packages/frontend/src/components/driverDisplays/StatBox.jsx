/** One figure of the profile header: icon, label and value, golden when highlighted. */
export default function StatBox({ icon, label, value, color, highlight }) {
  return (
    <div
      className={`
        px-2 py-3 rounded-lg text-center transition-all
        ${highlight ? 'bg-yellow-50 dark:bg-yellow-900/30 ring-2 ring-yellow-400' : 'bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm'}
      `}
    >
      <div className="flex items-center justify-center mb-1" style={{ color: highlight ? '#EAB308' : color }}>
        {icon}
      </div>
      <div className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide break-words mb-1">
        {label}
      </div>
      <div className="text-xl font-black tabular-nums" style={{ color: highlight ? '#EAB308' : color }}>
        {value}
      </div>
    </div>
  )
}
