import { TrashIcon } from '@heroicons/react/24/outline'
import Modal, { ModalFooter, ModalButton } from '../ui/Modal'
import ErrorMessage from '../ErrorMessage'

/**
 * Reusable CRUD form modal with consistent styling
 * Reduces ~100 lines of duplicated modal code per CRUD page
 *
 * @param {object} props
 * @param {boolean} props.open - Modal visibility
 * @param {function} props.onClose - Close handler
 * @param {string} props.title - Modal title
 * @param {React.ReactNode} props.icon - Title icon
 * @param {function} props.onSubmit - Form submit handler
 * @param {function} props.onDelete - Optional delete handler (shows delete button)
 * @param {boolean} props.isEditing - Whether editing existing item
 * @param {boolean} props.saving - Whether save is in progress
 * @param {string} props.error - Error message
 * @param {string} props.success - Success message
 * @param {string} props.primaryColor - Primary color for buttons
 * @param {string} props.saveLabel - Save button label
 * @param {string} props.deleteLabel - Delete button label
 * @param {React.ReactNode} props.children - Form fields
 */
export default function FormModal({
  open,
  onClose,
  title,
  icon,
  onSubmit,
  onDelete,
  isEditing = false,
  saving = false,
  error,
  success,
  primaryColor = '#3B82F6',
  saveLabel = 'Enregistrer',
  deleteLabel = 'Supprimer',
  children
}) {
  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit?.(e)
  }

  return (
    <Modal open={open} onClose={onClose} title={title} icon={icon} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Error/Success messages */}
        {(error || success) && (
          <ErrorMessage
            message={error || success}
            type={error ? 'error' : 'success'}
          />
        )}

        {/* Form fields */}
        {children}

        {/* Footer with actions */}
        <ModalFooter className="border-t mt-6 pt-4">
          {/* Delete button (left side) */}
          {isEditing && onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="flex items-center gap-1 px-3 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors mr-auto"
            >
              <TrashIcon className="w-4 h-4" />
              {deleteLabel}
            </button>
          )}

          {/* Cancel / Save buttons (right side) */}
          <ModalButton variant="secondary" onClick={onClose}>
            Annuler
          </ModalButton>
          <button
            type="submit"
            disabled={saving}
            style={{ backgroundColor: primaryColor }}
            className="px-6 py-2 text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {saving ? 'Enregistrement...' : saveLabel}
          </button>
        </ModalFooter>
      </form>
    </Modal>
  )
}

/**
 * Form field wrapper with label
 */
export function FormField({ label, required, error, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
      {error && (
        <p className="text-red-500 text-xs mt-1">{error}</p>
      )}
    </div>
  )
}

/**
 * Text input field
 */
export function TextField({
  label,
  value,
  onChange,
  placeholder,
  required,
  type = 'text',
  error
}) {
  return (
    <FormField label={label} required={required} error={error}>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
      />
    </FormField>
  )
}

/**
 * Select field
 */
export function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder = 'Sélectionner...',
  required,
  error
}) {
  return (
    <FormField label={label} required={required} error={error}>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value || null)}
        required={required}
        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </FormField>
  )
}
