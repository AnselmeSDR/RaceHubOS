import { FunnelIcon } from '@heroicons/react/24/outline'
import { ChevronUpIcon, ChevronDownIcon, ChevronUpDownIcon } from '@heroicons/react/24/outline'
import { CheckIcon } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

export function FilterHeader({ label, active, value, options, onChange, column }) {
  const sorted = column?.getIsSorted?.()
  const canSort = column?.getCanSort?.()

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
      <PopoverContent align="end" collisionPadding={16} className="w-48 p-1">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className="flex items-center justify-between w-full px-2 py-1.5 text-sm rounded-md hover:bg-accent transition-colors text-left"
          >
            <span>{opt.label}</span>
            {value === opt.value && <CheckIcon className="w-4 h-4 text-primary" />}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  )
}
