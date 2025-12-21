import { PlusIcon } from '@heroicons/react/24/outline'

/**
 * Empty state component for lists with no items
 *
 * @param {object} props
 * @param {React.ReactNode} props.icon - Icon to display
 * @param {string} props.title - Empty state title
 * @param {string} props.message - Empty state message
 * @param {string} props.actionLabel - Action button label
 * @param {function} props.onAction - Action button click handler
 * @param {string} props.primaryColor - Primary color for styling
 */
export default function EmptyState({
  icon,
  title = 'Aucun élément',
  message = "Commencez par en ajouter un",
  actionLabel = 'Ajouter',
  onAction,
  primaryColor = '#3B82F6'
}) {
  return (
    <div className="text-center py-16 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
      {icon && (
        <div
          className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
          style={{ backgroundColor: `${primaryColor}20` }}
        >
          <span style={{ color: primaryColor }}>
            {icon}
          </span>
        </div>
      )}

      <h3 className="text-lg font-medium text-gray-900 mb-1">{title}</h3>
      <p className="text-gray-500 mb-6">{message}</p>

      {onAction && (
        <button
          onClick={onAction}
          style={{ backgroundColor: primaryColor }}
          className="inline-flex items-center gap-2 px-6 py-3 text-white rounded-lg hover:opacity-90 transition-opacity"
        >
          <PlusIcon className="w-5 h-5" />
          {actionLabel}
        </button>
      )}
    </div>
  )
}
