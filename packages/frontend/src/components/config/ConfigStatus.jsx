import { CheckCircle, AlertTriangle } from 'lucide-react'

export default function ConfigStatus({
  isComplete,
  unconfiguredCount,
  unconfiguredSlots
}) {
  if (isComplete) {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-100 text-green-700 rounded-full text-sm font-medium">
        <CheckCircle className="w-4 h-4" />
        <span>Prêt</span>
      </div>
    )
  }

  const slotsText = unconfiguredSlots?.join(', ') || ''

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-yellow-100 text-yellow-700 rounded-full text-sm font-medium">
      <AlertTriangle className="w-4 h-4" />
      <span>
        {unconfiguredCount} manette{unconfiguredCount > 1 ? 's' : ''} à configurer
        {slotsText && ` (${slotsText})`}
      </span>
    </div>
  )
}
