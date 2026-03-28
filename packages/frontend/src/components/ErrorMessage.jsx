import { XCircle, CheckCircle, AlertTriangle, Info, X } from 'lucide-react'

export default function ErrorMessage({ type = 'error', message, onClose, className = '' }) {
  if (!message) return null

  const styles = {
    error: {
      bg: 'bg-red-50 dark:bg-red-900/30',
      border: 'border-red-400 dark:border-red-600',
      text: 'text-red-800 dark:text-red-300',
      icon: XCircle,
      iconColor: 'text-red-400'
    },
    success: {
      bg: 'bg-green-50 dark:bg-green-900/30',
      border: 'border-green-400 dark:border-green-600',
      text: 'text-green-800 dark:text-green-300',
      icon: CheckCircle,
      iconColor: 'text-green-400'
    },
    warning: {
      bg: 'bg-yellow-50 dark:bg-yellow-900/30',
      border: 'border-yellow-400 dark:border-yellow-600',
      text: 'text-yellow-800 dark:text-yellow-300',
      icon: AlertTriangle,
      iconColor: 'text-yellow-400'
    },
    info: {
      bg: 'bg-blue-50 dark:bg-blue-900/30',
      border: 'border-blue-400 dark:border-blue-600',
      text: 'text-blue-800 dark:text-blue-300',
      icon: Info,
      iconColor: 'text-blue-400'
    }
  }

  const style = styles[type] || styles.error
  const Icon = style.icon

  return (
    <div className={`rounded-lg border ${style.bg} ${style.border} p-4 ${className}`}>
      <div className="flex">
        <div className="flex-shrink-0">
          <Icon className={`h-5 w-5 ${style.iconColor}`} aria-hidden="true" />
        </div>
        <div className="ml-3 flex-1">
          <p className={`text-sm font-medium ${style.text}`}>
            {message}
          </p>
        </div>
        {onClose && (
          <div className="ml-auto pl-3">
            <button
              onClick={onClose}
              className={`inline-flex rounded-md p-1.5 ${style.text} hover:bg-white/50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-${type === 'error' ? 'red' : type === 'success' ? 'green' : type === 'warning' ? 'yellow' : 'blue'}-50 focus:ring-${type === 'error' ? 'red' : type === 'success' ? 'green' : type === 'warning' ? 'yellow' : 'blue'}-600`}
            >
              <span className="sr-only">Fermer</span>
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}