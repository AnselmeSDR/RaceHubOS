import { useLayoutEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { AnimatePresence, MotionConfig, motion } from 'framer-motion'
import { X, AlertTriangle } from 'lucide-react'
import { Button } from './button'

// Where the last press landed: a window grows out of the button that opened it, and goes back into it
let lastPress = null
if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', (e) => (lastPress = { x: e.clientX, y: e.clientY }), true)
}
const PANEL_SPRING = { type: 'spring', bounce: 0, duration: 0.35 }

// Closed (`open` false), it goes back where it came from, then `onExitComplete` runs
export default function Modal({ open, onExitComplete, ...props }) {
  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence onExitComplete={onExitComplete}>
        {open && <ModalWindow key="modal" {...props} />}
      </AnimatePresence>
    </MotionConfig>
  )
}

function ModalWindow({ onClose, title, icon, children, size = 'md' }) {
  const panel = useRef(null)
  useLayoutEffect(() => {
    const rect = panel.current.getBoundingClientRect()
    if (lastPress && rect.width) {
      panel.current.style.transformOrigin = `${lastPress.x - rect.left}px ${lastPress.y - rect.top}px`
    }
  }, [])

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
    '7xl': 'max-w-7xl',
  }

  return (
    <motion.div
      data-testid="modal"
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* Le titre reste visible, seul le corps défile : un formulaire long
          dépassait de l'écran sans jamais pouvoir être fait défiler. La largeur change en douceur. */}
      <motion.div
        ref={panel}
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.92 }}
        transition={PANEL_SPRING}
        className={`bg-card border border-border rounded-xl shadow-xl overflow-hidden w-full ${sizeClasses[size]} max-h-[90vh] flex flex-col transition-[max-width] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none`}
      >
        <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            {icon}
            {title}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded transition-colors">
            <X className="size-6 text-muted-foreground" />
          </button>
        </div>
        {/* Scrolled, the drivers that glide inside still start from where they were */}
        <motion.div layoutScroll className="px-6 pb-6 overflow-y-auto">
          {children}
        </motion.div>
      </motion.div>
    </motion.div>
  )
}

export function ModalFooter({ children, className = '' }) {
  return <div className={`flex flex-wrap justify-end gap-3 pt-4 ${className}`}>{children}</div>
}

export function ModalButton({ type = 'button', variant = 'primary', disabled = false, onClick, children }) {
  const variantMap = {
    primary: 'default',
    success: 'default',
    danger: 'destructive',
    secondary: 'ghost',
  }

  return (
    <Button type={type} variant={variantMap[variant] || 'default'} disabled={disabled} onClick={onClick}>
      {children}
    </Button>
  )
}

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  cancelLabel,
  variant = 'danger',
}) {
  const { t } = useTranslation('common')
  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-sm p-6 mx-4">
        <div className="flex items-center gap-3 mb-4">
          <div className={`p-2 rounded-full ${variant === 'danger' ? 'bg-destructive/10' : 'bg-yellow-500/10'}`}>
            <AlertTriangle className={`size-6 ${variant === 'danger' ? 'text-destructive' : 'text-yellow-500'}`} />
          </div>
          <h2 className="text-lg font-bold text-foreground">{title ?? t('confirm')}</h2>
        </div>
        {message && <p className="text-muted-foreground mb-6">{message}</p>}
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            {cancelLabel ?? t('cancel')}
          </Button>
          <Button variant={variant === 'danger' ? 'destructive' : 'default'} className="flex-1" onClick={onConfirm}>
            {confirmLabel ?? t('confirm')}
          </Button>
        </div>
      </div>
    </div>
  )
}
