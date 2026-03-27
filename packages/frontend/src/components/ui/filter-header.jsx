import { FunnelIcon } from '@heroicons/react/24/outline'
import { ChevronUpIcon, ChevronDownIcon, ChevronUpDownIcon } from '@heroicons/react/24/outline'
import { CheckIcon } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'

export function FilterHeader({ label, active, value = [], options, onChange, column }) {
  const sorted = column?.getIsSorted?.()
  const canSort = column?.getCanSort?.()

  // Normalize value to array
  const selected = Array.isArray(value) ? value : (value ? [value] : [])

  function toggleValue(optValue) {
    if (!optValue) {
      // "Tous" clicked — clear selection
      onChange([])
      return
    }
    const next = selected.includes(optValue)
      ? selected.filter(v => v !== optValue)
      : [...selected, optValue]
    onChange(next)
  }

  return (
    <Popover>
      <div className="flex items-center w-full">
        <span
          className={canSort ? 'cursor-pointer select-none hover:text-foreground flex items-center gap-2' : ''}
          onClick={column?.getToggleSortingHandler?.()}
        >
          {label}
          {canSort && (
            sorted === 'asc'
              ? <ChevronUpIcon className="w-4 h-4 text-black dark:text-white" />
              : sorted === 'desc'
                ? <ChevronDownIcon className="w-4 h-4 text-black dark:text-white" />
                : <ChevronUpDownIcon className="w-4 h-4 text-black/40 dark:text-white/40" />
          )}
        </span>
        <span className="flex-1" />
        <PopoverTrigger asChild>
          <button
            className={`p-1 rounded hover:bg-muted transition-colors ${
              active ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            <FunnelIcon className="w-4 h-4" />
          </button>
        </PopoverTrigger>
      </div>
      <PopoverContent align="end" collisionPadding={16} className="w-52 p-1 max-h-72 overflow-y-auto">
        {/* "Tous" option */}
        <button
          onClick={() => toggleValue('')}
          className="flex items-center justify-between w-full px-2 py-1.5 text-sm rounded-md hover:bg-accent transition-colors text-left"
        >
          <span>Tous</span>
          {selected.length === 0 && <CheckIcon className="w-4 h-4 text-primary" />}
        </button>
        {/* Options with checkboxes */}
        {options.filter(o => o.value).map((opt) => (
          <button
            key={opt.value}
            onClick={() => toggleValue(opt.value)}
            className="flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded-md hover:bg-accent transition-colors text-left"
          >
            <Checkbox
              checked={selected.includes(opt.value)}
              className="h-3.5 w-3.5 pointer-events-none"
            />
            <span className="flex-1">{opt.label}</span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  )
}
