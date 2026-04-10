import { Plus, LayoutGrid, List } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function PageHeader({
  title,
  icon,
  count = 0,
  countLabel = 'éléments',
  onAdd,
  addLabel = 'Ajouter',
  showViewToggle = false,
  viewMode = 'grid',
  onViewModeChange
}) {
  return (
    <div className="flex items-center justify-between mb-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
          {icon && <span className="text-primary">{icon}</span>}
          {title}
        </h1>
        <p className="text-muted-foreground mt-1">
          {count} {countLabel}
        </p>
      </div>

      <div className="flex items-center gap-3">
        {showViewToggle && onViewModeChange && (
          <ViewToggleButtons mode={viewMode} onChange={onViewModeChange} />
        )}
        <Button onClick={onAdd}>
          <Plus className="size-4" />
          {addLabel}
        </Button>
      </div>
    </div>
  )
}

export function ViewToggleButtons({ mode, onChange }) {
  return (
    <div className="flex bg-muted rounded-lg p-1">
      <button
        onClick={() => onChange('grid')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
          mode === 'grid'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        <LayoutGrid className="size-4" />
        Grille
      </button>
      <button
        onClick={() => onChange('list')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
          mode === 'list'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        <List className="size-4" />
        Liste
      </button>
    </div>
  )
}
