import { PlusIcon, Squares2X2Icon, ListBulletIcon } from '@heroicons/react/24/outline'

/**
 * Reusable CRUD page header with title, count, view toggle, and add button
 *
 * @param {object} props
 * @param {string} props.title - Page title
 * @param {React.ReactNode} props.icon - Title icon component
 * @param {number} props.count - Number of items
 * @param {string} props.countLabel - Label for count (e.g., "pilotes", "voitures")
 * @param {function} props.onAdd - Add button click handler
 * @param {string} props.addLabel - Add button label (default: "Ajouter")
 * @param {string} props.primaryColor - Primary color for styling
 * @param {boolean} props.showViewToggle - Show grid/list toggle
 * @param {'grid' | 'list'} props.viewMode - Current view mode
 * @param {function} props.onViewModeChange - View mode change handler
 */
export default function PageHeader({
  title,
  icon,
  count = 0,
  countLabel = 'éléments',
  onAdd,
  addLabel = 'Ajouter',
  primaryColor = '#3B82F6',
  showViewToggle = false,
  viewMode = 'grid',
  onViewModeChange
}) {
  return (
    <div className="flex items-center justify-between mb-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
          {icon && (
            <span style={{ color: primaryColor }}>
              {icon}
            </span>
          )}
          {title}
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          {count} {countLabel}
        </p>
      </div>

      <div className="flex items-center gap-3">
        {showViewToggle && onViewModeChange && (
          <ViewToggleButtons
            mode={viewMode}
            onChange={onViewModeChange}
            primaryColor={primaryColor}
          />
        )}

        <button
          onClick={onAdd}
          style={{ backgroundColor: primaryColor }}
          className="flex items-center gap-2 px-4 py-2 text-white rounded-lg hover:opacity-90 transition-opacity"
        >
          <PlusIcon className="w-5 h-5" />
          {addLabel}
        </button>
      </div>
    </div>
  )
}

/**
 * Grid/List view toggle buttons
 */
export function ViewToggleButtons({ mode, onChange }) {
  return (
    <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
      <button
        onClick={() => onChange('grid')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
          mode === 'grid'
            ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
        }`}
      >
        <Squares2X2Icon className="w-4 h-4" />
        Grille
      </button>
      <button
        onClick={() => onChange('list')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
          mode === 'list'
            ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
        }`}
      >
        <ListBulletIcon className="w-4 h-4" />
        Liste
      </button>
    </div>
  )
}
