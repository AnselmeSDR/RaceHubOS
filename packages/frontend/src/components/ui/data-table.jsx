import { useState, useEffect, useCallback, useRef } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { Search, Columns3, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { motion } from 'framer-motion'

const API_URL = import.meta.env.VITE_API_URL || ''

function savePref(key, value) {
  if (!key) return
  fetch(`${API_URL}/api/preferences/${key}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value }),
  }).catch(() => {})
}

export function DataTable({
  columns,
  data,
  preferenceKey,
  searchPlaceholder = 'Rechercher...',
  onRowClick,
  options = [],
  emptyMessage = 'Aucun résultat.',
  rowClassName,
  onSelectionChange,
  renderActions,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
  initialPrefs,
  onSortChange,
  clearSelectionRef,
}) {
  const [sorting, setSorting] = useState([])
  const [columnFilters, setColumnFilters] = useState([])
  const [columnVisibility, setColumnVisibility] = useState(initialPrefs?.columnVisibility || {})
  const [columnOrder, setColumnOrder] = useState(initialPrefs?.columnOrder || [])
  const [rowSelection, setRowSelection] = useState({})
  if (clearSelectionRef) clearSelectionRef.current = () => setRowSelection({})
  const [globalFilter, setGlobalFilter] = useState('')

  const sentinelRef = useRef(null)
  const dragCol = useRef(null)

  // Infinite scroll
  useEffect(() => {
    if (!onLoadMore || !sentinelRef.current) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !loadingMore) {
          onLoadMore()
        }
      },
      { rootMargin: '200px' }
    )
    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [hasMore, loadingMore, onLoadMore])

  function handleVisibilityChange(updater) {
    setColumnVisibility(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      savePref(`columns:${preferenceKey}`, next)
      return next
    })
  }


  // Drag & drop reorder
  function handleDragStart(e, colId) {
    dragCol.current = colId
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragEnter(e, colId) {
    e.preventDefault()
    if (!dragCol.current || colId === dragCol.current || colId === 'actions' || e.currentTarget !== e.target) return
    setColumnOrder(prev => {
      const order = prev.length ? [...prev] : table.getAllLeafColumns().map(c => c.id)
      const fromIdx = order.indexOf(dragCol.current)
      const toIdx = order.indexOf(colId)
      if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return prev
      const next = [...order]
      next.splice(fromIdx, 1)
      next.splice(toIdx, 0, dragCol.current)
      // Keep actions at the end
      const actionsIdx = next.indexOf('actions')
      if (actionsIdx !== -1 && actionsIdx !== next.length - 1) {
        next.splice(actionsIdx, 1)
        next.push('actions')
      }
      return next
    })
  }

  function handleDragOver(e) {
    e.preventDefault()
  }

  function handleDragEnd() {
    setColumnOrder(current => {
      savePref(`order:${preferenceKey}`, current)
      return current
    })
    dragCol.current = null
  }

  function handleSortingChange(updater) {
    setSorting(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      if (onSortChange) {
        const sort = next[0]
        onSortChange(sort ? { id: sort.id, desc: sort.desc } : null)
      }
      return next
    })
  }

  const table = useReactTable({
    data,
    columns,
    manualSorting: !!onSortChange,
    onSortingChange: handleSortingChange,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: handleVisibilityChange,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      columnOrder,
      rowSelection,
      globalFilter,
    },
  })

  const selectedRows = table.getFilteredSelectedRowModel().rows

  useEffect(() => {
    onSelectionChange?.(selectedRows)
  }, [rowSelection])

  const toggleableColumns = table.getAllColumns().filter(
    col => col.getCanHide() && col.id !== 'select' && col.id !== 'actions'
  )

  return (
    <div className="rounded-xl border border-border bg-card shadow-lg">
      {/* Search + columns toggle + options */}
      <div className="px-4 py-3 border-b border-border sticky top-0 z-10 bg-card rounded-t-xl">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={globalFilter ?? ''}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder={searchPlaceholder}
              className="pl-9"
            />
          </div>
          {toggleableColumns.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Columns3 className="w-4 h-4" />
                  Colonnes
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {toggleableColumns.map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) => column.toggleVisibility(!!value)}
                    onSelect={(e) => e.preventDefault()}
                  >
                    {column.columnDef.meta?.label
                      || (typeof column.columnDef.header === 'string' ? column.columnDef.header : column.id)}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        {options.length > 0 && (
          <div className="flex items-center gap-4 mt-2 pl-2">
            {options.map((option) => (
              <label key={option.key} className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={option.checked}
                  onCheckedChange={option.onChange}
                  className="h-3.5 w-3.5"
                />
                <span className="text-xs text-muted-foreground">{option.label}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Selection actions */}
      {selectedRows.length > 0 && (
        <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b border-border sticky top-[57px] z-10">
          <span className="text-sm text-muted-foreground">
            {selectedRows.length} sélectionné{selectedRows.length > 1 ? 's' : ''}
          </span>
          <div className="flex gap-2">
            {renderActions?.(selectedRows)}
          </div>
        </div>
      )}

      {/* Table */}
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const isFixed = header.column.id === 'select' || header.column.id === 'actions'
                const canDrag = !isFixed
                return (
                  <motion.th
                    key={header.id}
                    layout
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    data-slot="table-head"
                    className={cn(
                      "relative group h-12 text-left align-middle text-sm font-medium whitespace-nowrap text-muted-foreground [&:has([role=checkbox])]:pr-0",
                      header.column.id === 'actions' ? 'px-1 w-8 text-center' : header.column.id === 'select' ? 'p-2 w-8 text-center' : 'px-4',
                      header.column.columnDef.meta?.className
                    )}
                    onDragEnter={(e) => canDrag && handleDragEnter(e, header.column.id)}
                    onDragOver={handleDragOver}
                  >
                    <div className="flex items-center gap-3">
                      {canDrag && (
                        <span
                          draggable
                          onDragStart={(e) => handleDragStart(e, header.column.id)}
                          onDragEnd={handleDragEnd}
                          className="cursor-grab active:cursor-grabbing text-muted-foreground/60 hover:text-muted-foreground select-none text-lg leading-none"
                        >
                          ⠿
                        </span>
                      )}
                      {(() => {
                        const isStringHeader = typeof header.column.columnDef.header === 'string'
                        const canSort = header.column.getCanSort() && isStringHeader
                        return (
                          <div
                            className={cn(
                              "flex-1 flex items-center gap-2",
                              canSort && "cursor-pointer select-none hover:text-foreground"
                            )}
                            onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                          >
                            {header.isPlaceholder
                              ? null
                              : flexRender(header.column.columnDef.header, header.getContext())}
                            {canSort && (
                              header.column.getIsSorted() === 'asc'
                                ? <ChevronUp className="w-4 h-4 text-black dark:text-white" />
                                : header.column.getIsSorted() === 'desc'
                                  ? <ChevronDown className="w-4 h-4 text-black dark:text-white" />
                                  : <ChevronsUpDown className="w-4 h-4 text-black/40 dark:text-white/40" />
                            )}
                          </div>
                        )
                      })()}
                    </div>
                  </motion.th>
                )
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() && 'selected'}
                className={cn(
                  onRowClick && 'cursor-pointer',
                  rowClassName?.(row.original),
                )}
                onClick={() => onRowClick?.(row.original)}
              >
                {row.getVisibleCells().map((cell) => (
                  <motion.td
                    key={cell.id}
                    layout
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    data-slot="table-cell"
                    className={cn(
                      "align-middle text-sm whitespace-nowrap [&:has([role=checkbox])]:pr-0",
                      cell.column.id === 'actions' ? 'px-1 py-1 text-center' : cell.column.id === 'select' ? 'p-2 text-center' : 'px-4 py-3',
                      cell.column.columnDef.meta?.className
                    )}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </motion.td>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="py-12">
                <div className="flex flex-col items-center justify-center text-muted-foreground">
                  <Search className="size-10 mb-3 opacity-20" />
                  <p className="font-medium">{emptyMessage}</p>
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {/* Infinite scroll sentinel */}
      {onLoadMore && <div ref={sentinelRef} className="h-1" />}
      {loadingMore && (
        <div className="flex items-center gap-4 px-4 py-3 border-t border-border">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-20" />
        </div>
      )}
    </div>
  )
}

// Selection column helper
export function createSelectColumn() {
  return {
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && 'indeterminate')
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Tout sélectionner"
        className="h-4 w-4"
      />
    ),
    cell: ({ row }) => (
      <div onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Sélectionner la ligne"
          className="h-4 w-4"
        />
      </div>
    ),
    enableSorting: false,
    enableHiding: false,
    size: 40,
  }
}
