import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { Trash2 } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Two-step delete button: the bin widens into a "Confirm?" label, and only a
 * second click deletes. Lighter than a modal for an action taken from a card,
 * while still leaving no way to delete by mistake.
 *
 * Styling comes from the app's own button variants, so sizes, radii, focus
 * rings and the destructive colour follow the theme (dark mode included)
 * instead of being redefined here.
 *
 * The armed state reverts on its own after `timeout` ms, or as soon as the
 * pointer leaves, so a card never stays primed for deletion.
 */
export default function DeleteButton({ onDelete, className = '', timeout = 4000, label, variant = 'card', size = 'sm' }) {
  const { t } = useTranslation('common')
  const [armed, setArmed] = useState(false)
  const timer = useRef(null)

  useEffect(() => () => clearTimeout(timer.current), [])

  function disarm() {
    clearTimeout(timer.current)
    setArmed(false)
  }

  function handleClick(e) {
    // Cards are clickable: never let the click reach them
    e.stopPropagation()
    e.preventDefault()

    if (!armed) {
      setArmed(true)
      timer.current = setTimeout(() => setArmed(false), timeout)
      return
    }

    disarm()
    onDelete()
  }

  const title = armed ? t('deleteConfirmShort') : (label ?? t('delete'))

  // "card" floats over an image and has no equivalent in the button variants;
  // it still borrows the theme's destructive colour and radius.
  const cardClasses = armed
    ? 'bg-destructive text-destructive-foreground px-2 h-6 text-xs font-medium'
    : 'bg-black/20 text-white hover:bg-destructive p-1.5 h-6'

  const classes = variant === 'card'
    ? cn('inline-flex items-center justify-center gap-1.5 overflow-hidden rounded-[min(var(--radius-md),12px)] outline-none transition-colors focus-visible:ring-3 focus-visible:ring-destructive/30', cardClasses, className)
    : cn(buttonVariants({ variant: armed ? 'destructive' : 'outline', size }), 'overflow-hidden', className)

  return (
    <motion.button
      type="button"
      data-slot="button"
      data-testid="delete-button"
      data-armed={armed ? 'true' : 'false'}
      onClick={handleClick}
      onMouseLeave={() => armed && disarm()}
      aria-label={title}
      title={title}
      layout
      transition={{ type: 'spring', stiffness: 500, damping: 34, mass: 0.6 }}
      whileTap={{ scale: 0.94 }}
      className={classes}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        {armed ? (
          <motion.span
            key="confirm"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.14 }}
            className="whitespace-nowrap"
          >
            {t('deleteConfirmShort')}
          </motion.span>
        ) : (
          <motion.span
            key="bin"
            initial={{ opacity: 0, rotate: -20, scale: 0.7 }}
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            exit={{ opacity: 0, rotate: 20, scale: 0.7 }}
            transition={{ duration: 0.14 }}
            className="flex"
          >
            <Trash2 className="size-3.5" />
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  )
}
