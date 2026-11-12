import { DivisionScope } from '@racehubos/shared'
import { editColumn } from '@/components/crud/editColumn'
import DivisionBadge from './DivisionBadge'
import { DivisionLogo } from './DivisionCard'

/** The columns of the divisions table of `scope`; a row opens the division's page, `onEdit(division)` its form. */
export function divisionColumns(t, scope, { onEdit }) {
  const category = scope === DivisionScope.CAR
  const members = category ? 'cars' : 'drivers'
  return [
    {
      id: 'order',
      accessorKey: 'order',
      header: t(category ? 'columns.order' : 'columns.rank'),
      meta: { className: 'text-center' },
      cell: ({ row }) => <span className="font-mono font-bold">{row.original.order}</span>,
    },
    {
      accessorKey: 'name',
      header: t(category ? 'glossary:category' : 'glossary:division', { count: 1 }),
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <DivisionLogo division={row.original} className="w-8 h-8 text-[10px]" />
          <span className="font-semibold">{row.original.name}</span>
          <DivisionBadge division={row.original} />
        </div>
      ),
    },
    {
      id: members,
      accessorFn: (row) => row._count?.[members] || 0,
      header: t(category ? 'glossary:car' : 'glossary:driver', { count: 2 }),
      cell: ({ row }) => {
        const list = row.original[members] ?? []
        const names = list.slice(0, 2).map((m) => (category ? `${m.brand} ${m.model}` : m.name))
        return (
          <div>
            <span className="font-medium">{row.original._count?.[members] || 0}</span>
            {names.length > 0 && (
              <span className="text-muted-foreground ml-1.5">
                ({names.join(', ')}
                {list.length > 2 ? '…' : ''})
              </span>
            )}
          </div>
        )
      },
    },
    editColumn(onEdit),
  ]
}
