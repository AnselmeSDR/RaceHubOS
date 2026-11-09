import { Pencil } from 'lucide-react'

/** Last column of a list table: a pencil that opens the row's form, without following the row's link. */
export function editColumn(onEdit) {
  return {
    id: 'actions',
    header: '',
    enableSorting: false,
    enableHiding: false,
    cell: ({ row }) => (
      <button
        onClick={(e) => {
          e.stopPropagation()
          onEdit(row.original)
        }}
        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
      >
        <Pencil className="size-3.5" />
      </button>
    ),
  }
}
