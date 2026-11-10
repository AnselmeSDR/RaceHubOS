import { RefreshCw, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import DeleteButton from '@/components/ui/DeleteButton'

/**
 * Edit, reset the stats and delete, on a track's profile.
 *
 * The page also passes the whole `track`: unused here, it is there for the
 * add-ons that wrap this file (docs/ADDONS.md § Example: track planner).
 */
export default function TrackProfileActions({ resetting, onEdit, onResetStats, onDelete }) {
  return (
    <div className="flex items-center gap-2" data-testid="track-profile-actions">
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
      <DeleteButton variant="outline" onDelete={onDelete} />
    </div>
  )
}
