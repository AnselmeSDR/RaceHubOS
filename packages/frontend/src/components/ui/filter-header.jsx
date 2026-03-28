import { Filter, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function FilterHeader({ label, active, value = [], options, onChange, column }) {
  const sorted = column?.getIsSorted?.()
  const canSort = column?.getCanSort?.()

  const selected = Array.isArray(value) ? value : (value ? [value] : [])

  function toggleValue(optValue) {
    if (!optValue) {
      onChange([])
      return
    }
    const next = selected.includes(optValue)
      ? selected.filter(v => v !== optValue)
      : [...selected, optValue]
    onChange(next)
  }

  return (
    <DropdownMenu>
      <div className="flex items-center w-full">
        <span
          className={canSort ? 'cursor-pointer select-none hover:text-foreground flex items-center gap-2' : ''}
          onClick={column?.getToggleSortingHandler?.()}
        >
          {label}
          {canSort && (
            sorted === 'asc'
              ? <ChevronUp className="w-4 h-4 text-black dark:text-white" />
              : sorted === 'desc'
                ? <ChevronDown className="w-4 h-4 text-black dark:text-white" />
                : <ChevronsUpDown className="w-4 h-4 text-black/40 dark:text-white/40" />
          )}
        </span>
        <span className="flex-1" />
        <DropdownMenuTrigger asChild>
          <button className="p-1 rounded hover:bg-muted transition-colors">
            {active
              ? <Filter className="w-4 h-4 text-primary" />
              : <Filter className="w-4 h-4 text-muted-foreground" />
            }
          </button>
        </DropdownMenuTrigger>
      </div>
      <DropdownMenuContent align="end" className="w-52 max-h-72 overflow-y-auto">
        <DropdownMenuCheckboxItem
          checked={selected.length === 0}
          onCheckedChange={() => toggleValue('')}
          onSelect={(e) => e.preventDefault()}
        >
          Tous
        </DropdownMenuCheckboxItem>
        {options.filter(o => o.value).map((opt) => (
          <DropdownMenuCheckboxItem
            key={opt.value}
            checked={selected.includes(opt.value)}
            onCheckedChange={() => toggleValue(opt.value)}
            onSelect={(e) => e.preventDefault()}
          >
            {opt.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
