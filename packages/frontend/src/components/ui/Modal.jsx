import { X, AlertTriangle } from 'lucide-react'
import { Button } from './button'

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
      <div className={`bg-card border border-border rounded-xl shadow-xl w-full ${sizeClasses[size]} p-6 mx-4`}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            {icon}
            {title}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded transition-colors"
          >
            <X className="size-6 text-muted-foreground" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function ModalFooter({ children, className = '' }) {
  return (
    <div className={`flex justify-end gap-3 pt-4 ${className}`}>
      {children}
    </div>
  )
}

export function ModalButton({
  type = 'button',
  variant = 'primary',
  disabled = false,
  onClick,
  children
}) {
  const variantMap = {
    primary: 'default',
    success: 'default',
    danger: 'destructive',
    secondary: 'ghost',
  }

  return (
    <Button
      type={type}
      variant={variantMap[variant] || 'default'}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </Button>
  )
}

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title = 'Confirmer',
  message,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  variant = 'danger'
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-sm p-6 mx-4">
        <div className="flex items-center gap-3 mb-4">
          <div className={`p-2 rounded-full ${variant === 'danger' ? 'bg-destructive/10' : 'bg-yellow-500/10'}`}>
            <AlertTriangle className={`size-6 ${variant === 'danger' ? 'text-destructive' : 'text-yellow-500'}`} />
          </div>
          <h2 className="text-lg font-bold text-foreground">{title}</h2>
        </div>
        {message && <p className="text-muted-foreground mb-6">{message}</p>}
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button
            variant={variant === 'danger' ? 'destructive' : 'default'}
            className="flex-1"
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
