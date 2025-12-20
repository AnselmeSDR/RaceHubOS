import { CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/solid'

export default function ConfigStatus({
  isComplete,
  unconfiguredCount,
  unconfiguredSlots
}) {
  if (isComplete) {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-100 text-green-700 rounded-full text-sm font-medium">
        <CheckCircleIcon className="w-4 h-4" />
        <span>All controllers configured</span>
      </div>
    )
  }

  const slotsText = unconfiguredSlots?.join(', ') || ''

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-yellow-100 text-yellow-700 rounded-full text-sm font-medium">
      <ExclamationTriangleIcon className="w-4 h-4" />
      <span>
        {unconfiguredCount} controller{unconfiguredCount > 1 ? 's' : ''} not configured
        {slotsText && `: ${slotsText}`}
      </span>
    </div>
  )
}
