import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import DeleteButton from '@/components/ui/DeleteButton'
import ExportButton from '@/components/ui/ExportButton'

/** Edit, export (the division, its members and championships) and delete, on a division's page. */
export default function DivisionProfileActions({ division, onEdit, onDelete }) {
  return (
    <div className="flex items-center gap-2" data-testid="division-profile-actions">
      <Button variant="outline" size="sm" onClick={onEdit}>
        <Pencil className="size-4" />
      </Button>
      <ExportButton url={`/api/divisions/${division.id}/export`} />
      <DeleteButton variant="outline" onDelete={onDelete} />
    </div>
  )
}
