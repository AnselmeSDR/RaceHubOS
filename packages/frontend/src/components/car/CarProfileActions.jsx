import { RefreshCw, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import DeleteButton from '@/components/ui/DeleteButton'
import ExportButton from '@/components/ui/ExportButton'

/** Edit, reset the stats, export and delete, on a car's profile. */
export default function CarProfileActions({ car, resetting, onEdit, onResetStats, onDelete }) {
  return (
    <div className="flex items-center gap-2" data-testid="car-profile-actions">
      <Button variant="outline" size="sm" onClick={onEdit}>
        <Pencil className="size-4" />
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={onResetStats}
        disabled={resetting}
        className="text-orange-600 dark:text-orange-400"
      >
        <RefreshCw className={`size-4 ${resetting ? 'animate-spin' : ''}`} />
      </Button>
      <div className="flex items-center gap-2">
        <ExportButton url={`/api/cars/${car.id}/export`} />
        <DeleteButton variant="outline" onDelete={onDelete} />
      </div>
    </div>
  )
}
