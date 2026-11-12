import { Trophy, Flag, BarChart3 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { editColumn } from '@/components/crud/editColumn'
import { filteredColumn } from '@/components/crud/filteredColumn'
import { DivisionBadges } from '@/components/division/DivisionBadge'
import { driverColor } from '@/lib/colors'
import { getImgUrl } from '@/utils/image'

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
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold overflow-hidden flex-shrink-0"
              style={{ backgroundColor: driverColor(driver) }}
            >
              {driver.img ? (
                <img src={getImgUrl(driver.img)} alt="" className="w-full h-full object-cover" />
              ) : (
                driver.name?.charAt(0)
              )}
            </div>
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
          <DivisionBadges divisions={row.original.divisions} />
        ) : (
          <span className="text-muted-foreground">-</span>
        )
    ),
    {
      id: 'sessions',
      accessorFn: (row) => row._count?.sessions || 0,
      header: t('glossary:race', { count: 2 }),
      cell: ({ row }) => (
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Flag className="w-4 h-4" />
          {row.original._count?.sessions || 0}
        </span>
      ),
    },
    {
      id: 'wins',
      accessorKey: 'wins',
      header: t('glossary:win', { count: 2 }),
      cell: ({ row }) => (
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Trophy className="w-4 h-4 text-yellow-500" />
          {row.original.wins || 0}
        </span>
      ),
    },
    {
      id: 'podiums',
      accessorKey: 'podiums',
      header: t('glossary:podium', { count: 2 }),
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.podiums || 0}</span>,
    },
    {
      id: 'laps',
      accessorFn: (row) => row._count?.laps || 0,
      header: t('glossary:lap', { count: 2 }),
      cell: ({ row }) => (
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <BarChart3 className="w-4 h-4" />
          {row.original._count?.laps || 0}
        </span>
      ),
    },
    {
      id: 'bestLap',
      accessorFn: (row) => row.bestLap || Infinity,
      header: t('common:record'),
      cell: ({ row }) => (
        <span className="font-mono font-bold">
          {row.original.bestLap ? `${(row.original.bestLap / 1000).toFixed(3)}s` : '-'}
        </span>
      ),
    },
    editColumn(onEdit),
  ]
}
