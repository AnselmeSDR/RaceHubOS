import { Badge } from '@/components/ui/badge'
import { editColumn } from '@/components/crud/editColumn'
import { FIGURE } from '@/components/crud/figure'
import { filteredColumn } from '@/components/crud/filteredColumn'
import { DivisionBadges } from '@/components/division/DivisionBadge'
import { driverColor } from '@/lib/colors'
import { pictureName } from '@/lib/viewTransition'
import DriverAvatar from './DriverAvatar'

/** The columns of the drivers table; `onEdit(driver)` opens a driver's form. */
export function driverColumns(t, { onEdit }) {
  return [
    {
      accessorKey: 'name',
      header: t('glossary:driver', { count: 1 }),
      cell: ({ row }) => {
        const driver = row.original
        return (
          <div className="flex items-center gap-3">
            <DriverAvatar driver={driver} className="size-7" transitionName={pictureName('driver', driver.id)} />
            <span className="font-semibold">{driver.name}</span>
          </div>
        )
      },
    },
    {
      id: 'number',
      accessorKey: 'number',
      header: t('columns.number'),
      meta: { className: 'text-center' },
      cell: ({ row }) =>
        row.original.number ? (
          <Badge className="font-mono font-bold text-white" style={{ backgroundColor: driverColor(row.original) }}>
            {row.original.number}
          </Badge>
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
    },
    filteredColumn(
      'divisions',
      'divisionId',
      t('glossary:division', { count: 1 }),
      (row) => row.divisions?.map((d) => d.name).join(', ') ?? '',
      ({ row }) =>
        row.original.divisions?.length ? (
          <DivisionBadges divisions={row.original.divisions} max={2} className="flex items-center gap-1" />
        ) : (
          <span className="text-muted-foreground">-</span>
        )
    ),
    {
      // Races only: practice and qualifying sessions do not count
      id: 'races',
      accessorFn: (row) => row.races || 0,
      header: t('glossary:race', { count: 2 }),
      meta: FIGURE,
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.races || 0}</span>,
    },
    {
      id: 'wins',
      accessorKey: 'wins',
      header: t('glossary:win', { count: 2 }),
      meta: FIGURE,
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.wins || 0}</span>,
    },
    {
      id: 'podiums',
      accessorKey: 'podiums',
      header: t('glossary:podium', { count: 2 }),
      meta: FIGURE,
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.podiums || 0}</span>,
    },
    {
      id: 'laps',
      accessorFn: (row) => row._count?.laps || 0,
      header: t('glossary:lap', { count: 2 }),
      meta: FIGURE,
      cell: ({ row }) => <span className="text-muted-foreground">{row.original._count?.laps || 0}</span>,
    },
    {
      id: 'bestLap',
      accessorFn: (row) => row.bestLap || Infinity,
      header: t('common:record'),
      meta: FIGURE,
      cell: ({ row }) => (
        <span className="font-mono font-bold">
          {row.original.bestLap ? `${(row.original.bestLap / 1000).toFixed(3)}s` : '-'}
        </span>
      ),
    },
    editColumn(onEdit),
  ]
}
