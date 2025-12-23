import { XMarkIcon } from '@heroicons/react/24/outline'

/**
 * Reusable modal component with consistent styling
 * @param {object} props
 * @param {boolean} props.open - Whether modal is visible
 * @param {function} props.onClose - Close handler
 * @param {string} props.title - Modal title
 * @param {React.ReactNode} props.icon - Optional title icon
 * @param {React.ReactNode} props.children - Modal content
 * @param {string} props.size - Modal size: 'sm' | 'md' | 'lg' | 'xl'
 */
export default function Modal({
  open,
  onClose,
  title,
  icon,
  children,
  size = 'md'
}) {
  if (!open) return null

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl'
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className={`bg-white rounded-xl shadow-xl w-full ${sizeClasses[size]} p-6 mx-4`}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            {icon}
            {title}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <XMarkIcon className="w-6 h-6 text-gray-500" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

/**
 * Modal footer with action buttons
 */
export function ModalFooter({ children, className = '' }) {
  return (
    <div className={`flex justify-end gap-3 pt-4 ${className}`}>
      {children}
    </div>
  )
}

/**
 * Standard modal buttons
 */
export function ModalButton({
  type = 'button',
  variant = 'primary',
  disabled = false,
  onClick,
  children
}) {
  const variants = {
    primary: 'bg-blue-500 text-white hover:bg-blue-600 disabled:bg-blue-300',
    success: 'bg-green-500 text-white hover:bg-green-600 disabled:bg-green-300',
    danger: 'bg-red-500 text-white hover:bg-red-600 disabled:bg-red-300',
    secondary: 'text-gray-600 hover:bg-gray-100'
  }

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`px-4 py-2 rounded-lg font-medium transition-colors ${variants[variant]}`}
    >
      {children}
    </button>
  )
}
