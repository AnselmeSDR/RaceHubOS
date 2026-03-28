import { useState, useEffect, useRef } from 'react'
import { Trash2, RotateCcw } from 'lucide-react'
import { LayoutGridIcon, ListIcon } from 'lucide-react'
import { DataTable, createSelectColumn } from '@/components/ui/data-table'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useSetPageHeader } from '@/context/PageHeaderContext'

const API_URL = import.meta.env.VITE_API_URL || ''

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
  renderGrid,
  children,
}) {
  const [selectedIds, setSelectedIds] = useState([])
  const clearSelectionRef = useRef(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [initialPrefs, setInitialPrefs] = useState(null)
  const [prefsLoaded, setPrefsLoaded] = useState(!preferenceKey)
  const [viewMode, setViewMode] = useState(renderGrid ? 'grid' : 'list')

  const columns = [createSelectColumn(), ...userColumns]

  // Load prefs in parallel with data
  useEffect(() => {
    if (!preferenceKey) return
    Promise.all([
      fetch(`${API_URL}/api/preferences/columns:${preferenceKey}`).then(r => r.json()),
      fetch(`${API_URL}/api/preferences/order:${preferenceKey}`).then(r => r.json()),
      fetch(`${API_URL}/api/preferences/viewMode:${preferenceKey}`).then(r => r.json()),
    ]).then(([visData, orderData, viewData]) => {
      setInitialPrefs({
        columnVisibility: visData.success && visData.data ? visData.data : {},
        columnOrder: orderData.success && orderData.data ? orderData.data : [],
      })
      if (viewData.success && viewData.data) setViewMode(viewData.data)
    }).catch(() => {
      setInitialPrefs({ columnVisibility: {}, columnOrder: [] })
    }).finally(() => setPrefsLoaded(true))
  }, [preferenceKey])

  function handleViewModeChange(mode) {
    setViewMode(mode)
    if (preferenceKey) {
      fetch(`${API_URL}/api/preferences/viewMode:${preferenceKey}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: mode }),
      }).catch(() => {})
    }
  }

  useSetPageHeader({
    title,
    icon,
    color,
    loading,
    totalCount: totalCount ?? data.length,
    viewMode,
    onViewModeChange: handleViewModeChange,
    hasGrid: !!renderGrid,
    onAdd,
    addLabel,
  })

  const isShowingDeleted = options?.some(o => o.key === 'deleted' && o.checked)

  function clearSelection() {
    setSelectedIds([])
    clearSelectionRef.current?.()
  }

  async function confirmDelete() {
    if (!deleteEndpoint) return
    try {
      await Promise.all(
        selectedIds.map(id =>
          fetch(`${API_URL}${deleteEndpoint}/${id}`, { method: 'DELETE' })
        )
      )
      clearSelection()
      onDeleted?.()
    } catch (error) {
      console.error('Failed to delete:', error)
    } finally {
      setShowDeleteConfirm(false)
    }
  }

  async function handleRestore() {
    if (!deleteEndpoint) return
    try {
      await Promise.all(
        selectedIds.map(id =>
          fetch(`${API_URL}${deleteEndpoint}/${id}/restore`, { method: 'PATCH' })
        )
      )
      clearSelection()
      onDeleted?.()
    } catch (error) {
      console.error('Failed to restore:', error)
    }
  }

  return (
    <div className="p-4 space-y-4">
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
      ) : viewMode === 'grid' && renderGrid ? (
        renderGrid(data)
      ) : (
        <DataTable
          columns={columns}
          data={data}
          clearSelectionRef={clearSelectionRef}
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
          renderActions={deleteEndpoint ? () => (
            <>
              {isShowingDeleted && (
                <Button variant="outline" size="sm" onClick={handleRestore}>
                  <RotateCcw className="w-4 h-4" />
                  Restaurer
                </Button>
              )}
              <Button variant="destructive" size="sm" onClick={() => setShowDeleteConfirm(true)}>
                <Trash2 className="w-4 h-4" />
                {isShowingDeleted ? 'Supprimer définitivement' : 'Supprimer'}
              </Button>
            </>
          ) : undefined}
        />
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowDeleteConfirm(false)} />
          <div className="relative z-50 bg-popover rounded-xl p-4 shadow-lg w-full max-w-sm mx-4 space-y-4 ring-1 ring-foreground/10">
            <div>
              <h3 className="font-medium">{isShowingDeleted ? 'Suppression définitive' : 'Confirmer la suppression'}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {isShowingDeleted
                  ? `${selectedIds.length} élément${selectedIds.length > 1 ? 's' : ''} sera${selectedIds.length > 1 ? 'ont' : ''} supprimé${selectedIds.length > 1 ? 's' : ''} définitivement. Cette action est irréversible.`
                  : `${selectedIds.length} élément${selectedIds.length > 1 ? 's' : ''} sera${selectedIds.length > 1 ? 'ont' : ''} supprimé${selectedIds.length > 1 ? 's' : ''}.`
                }
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowDeleteConfirm(false)}>Annuler</Button>
              <Button variant="destructive" size="sm" onClick={confirmDelete}>
                {isShowingDeleted ? 'Supprimer définitivement' : 'Supprimer'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {children}
    </div>
  )
}
