import { useState, useEffect } from 'react'
import { TrashIcon } from '@heroicons/react/24/outline'
import { DataTable, createSelectColumn } from '@/components/ui/data-table'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmModal } from '@/components/ui/Modal'

const API_URL = import.meta.env.VITE_API_URL || ''

/**
 * Generic list page layout with header, DataTable, selection + delete, and empty state.
 *
 * @param {object} props
 * @param {string} props.title - Page title
 * @param {React.ReactNode} props.icon - Icon component
 * @param {string} props.color - Tailwind color name (yellow, indigo, red, etc.)
 * @param {Array} props.data - Data array
 * @param {Array} props.columns - TanStack column definitions (without select column, it's added automatically)
 * @param {boolean} props.loading - Loading state
 * @param {string} props.searchPlaceholder - Search input placeholder
 * @param {string} props.addLabel - Add button label
 * @param {function} props.onAdd - Add button click handler
 * @param {function} props.onRowClick - Row click handler, receives row data
 * @param {string} props.deleteEndpoint - API endpoint prefix for DELETE (e.g. '/api/championships')
 * @param {function} props.onDeleted - Called after successful delete to refresh data
 * @param {Array} props.options - DataTable options (checkboxes under search)
 * @param {function} props.rowClassName - Row class name function
 * @param {string} props.emptyTitle - Empty state title
 * @param {string} props.emptyMessage - Empty state message
 * @param {boolean} props.hasActiveFilters - Whether any filters are active (to decide showing empty state vs table)
 * @param {React.ReactNode} props.children - Extra content (e.g. form modal)
 */
export function ListPage({
  title,
  icon,
  color = 'primary',
  data = [],
  columns: userColumns,
  preferenceKey,
  loading,
  searchPlaceholder,
  addLabel,
  onAdd,
  onRowClick,
  deleteEndpoint,
  onDeleted,
  options,
  rowClassName,
  emptyTitle,
  emptyMessage,
  hasActiveFilters = false,
  totalCount,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
  onSortChange,
  children,
}) {
  const [selectedIds, setSelectedIds] = useState([])
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [initialPrefs, setInitialPrefs] = useState(null)
  const [prefsLoaded, setPrefsLoaded] = useState(!preferenceKey)

  const columns = [createSelectColumn(), ...userColumns]

  // Load prefs in parallel with data
  useEffect(() => {
    if (!preferenceKey) return
    Promise.all([
      fetch(`${API_URL}/api/preferences/columns:${preferenceKey}`).then(r => r.json()),
      fetch(`${API_URL}/api/preferences/order:${preferenceKey}`).then(r => r.json()),
    ]).then(([visData, orderData]) => {
      setInitialPrefs({
        columnVisibility: visData.success && visData.data ? visData.data : {},
        columnOrder: orderData.success && orderData.data ? orderData.data : [],
      })
    }).catch(() => {
      setInitialPrefs({ columnVisibility: {}, columnOrder: [] })
    }).finally(() => setPrefsLoaded(true))
  }, [preferenceKey])

  async function confirmDelete() {
    if (!deleteEndpoint) return
    try {
      await Promise.all(
        selectedIds.map(id =>
          fetch(`${API_URL}${deleteEndpoint}/${id}`, { method: 'DELETE' })
        )
      )
      setSelectedIds([])
      onDeleted?.()
    } catch (error) {
      console.error('Failed to delete:', error)
    } finally {
      setShowDeleteConfirm(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {icon && (
            <div className={`w-10 h-10 bg-${color}-100 dark:bg-${color}-900/30 rounded-xl flex items-center justify-center`}>
              <span className={`text-${color}-600 dark:text-${color}-400 [&_svg]:w-5 [&_svg]:h-5`}>{icon}</span>
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-foreground">{title}</h1>
            <p className="text-sm text-muted-foreground">
              {loading ? '...' : `${totalCount ?? data.length} résultat${(totalCount ?? data.length) > 1 ? 's' : ''}`}
            </p>
          </div>
        </div>
        {onAdd && (
          <Button
            size="lg"
            onClick={onAdd}
            className={`bg-${color}-500 hover:bg-${color}-600 text-white`}
          >
            {icon}
            {addLabel}
          </Button>
        )}
      </div>

      {/* Content */}
      {loading || !prefsLoaded ? (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <Skeleton className="h-9 w-full rounded-lg" />
          </div>
          <div className="divide-y divide-border">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-5 w-20" />
              </div>
            ))}
          </div>
        </div>
      ) : data.length === 0 && !hasActiveFilters ? (
        <div className="text-center py-16 bg-card rounded-xl border border-border">
          <div className="text-muted-foreground mb-3 [&_svg]:w-12 [&_svg]:h-12 [&_svg]:mx-auto">{icon}</div>
          <p className="text-lg font-medium text-foreground">{emptyTitle || `Aucun ${title.toLowerCase()}`}</p>
          <p className="text-sm text-muted-foreground mt-1">{emptyMessage}</p>
          {onAdd && (
            <Button
              onClick={onAdd}
              className={`mt-4 bg-${color}-500 hover:bg-${color}-600 text-white`}
            >
              {addLabel}
            </Button>
          )}
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={data}
          preferenceKey={preferenceKey}
          initialPrefs={initialPrefs}
          searchPlaceholder={searchPlaceholder}
          onRowClick={onRowClick}
          rowClassName={rowClassName}
          emptyMessage="Aucun résultat trouvé."
          options={options}
          onSelectionChange={(rows) => setSelectedIds(rows.map(r => r.original.id))}
          hasMore={hasMore}
          loadingMore={loadingMore}
          onLoadMore={onLoadMore}
          onSortChange={onSortChange}
          renderActions={() => (
            <Button variant="destructive" size="sm" onClick={() => setShowDeleteConfirm(true)}>
              <TrashIcon className="w-4 h-4" />
              Supprimer
            </Button>
          )}
        />
      )}

      <ConfirmModal
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={confirmDelete}
        title="Confirmer la suppression"
        message={`${selectedIds.length} élément${selectedIds.length > 1 ? 's' : ''} sera${selectedIds.length > 1 ? 'ont' : ''} supprimé${selectedIds.length > 1 ? 's' : ''}. Cette action est irréversible.`}
        confirmLabel="Supprimer"
      />

      {children}
    </div>
  )
}
