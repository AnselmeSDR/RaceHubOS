import { Trash2 } from 'lucide-react'
import Modal, { ModalFooter } from '../ui/Modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import ErrorMessage from '../ErrorMessage'

/**
 * Reusable CRUD form modal with consistent styling
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
        {(error || success) && (
          <ErrorMessage
            message={error || success}
            type={error ? 'error' : 'success'}
          />
        )}

        {children}

        <ModalFooter className="border-t mt-6 pt-4">
          {isEditing && onDelete && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onDelete}
              className="text-destructive hover:text-destructive mr-auto"
            >
              <Trash2 className="size-4" />
              {deleteLabel}
            </Button>
          )}

          <Button type="button" variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Enregistrement...' : saveLabel}
          </Button>
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
      <label className="block text-sm font-medium text-foreground mb-1">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </label>
      {children}
      {error && (
        <p className="text-destructive text-xs mt-1">{error}</p>
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
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
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
        className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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
