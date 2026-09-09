import { useState } from 'react'
import { ChevronRight } from 'lucide-react'

/**
 * A titled section that starts folded.
 *
 * The car form now holds seventeen extra fields; unfolded they would bury the
 * three settings that are actually changed before a race.
 */
export function CollapsibleSection({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        data-testid="collapsible-toggle"
        className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
      >
        <ChevronRight className={`size-4 text-muted-foreground transition-transform ${open ? 'rotate-90' : ''}`} />
        {title}
      </button>
      {open && <div className="p-3 pt-1 space-y-4 border-t border-border">{children}</div>}
    </div>
  )
}
