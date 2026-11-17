import { formatLevel, levelPercent } from '@racehubos/shared'
import { editColumn } from '@/components/crud/editColumn'
import { FIGURE } from '@/components/crud/figure'
import { filteredColumn } from '@/components/crud/filteredColumn'
import { DivisionBadges } from '@/components/division/DivisionBadge'
import CarPicture from '@/components/car/CarPicture'
import { pictureName } from '@/lib/viewTransition'

/** The columns of the cars table; `onEdit(car)` opens a car's form. */
export function carColumns(t, { onEdit }) {
  return [
    {
      accessorKey: 'brand',
      header: t('fields.brand'),
      cell: ({ row }) => <span className="font-semibold">{row.original.brand}</span>,
    },
    {
      accessorKey: 'model',
      header: t('fields.model'),
      cell: ({ row }) => {
        const car = row.original
        return (
          <div className="flex items-center gap-3">
            <CarPicture car={car} alt="" className="size-7" transitionName={pictureName('car', car.id)} />
            <span className="font-medium">{car.model}</span>
          </div>
        )
      },
    },
    filteredColumn(
      'divisions',
      'divisionId',
      t('glossary:category', { count: 1 }),
      (row) => row.divisions?.map((d) => d.name).join(', ') ?? '',
      ({ row }) =>
        row.original.divisions?.length ? (
          <DivisionBadges divisions={row.original.divisions} max={2} className="flex items-center gap-1" />
        ) : (
          <span className="text-muted-foreground">-</span>
        )
    ),
    {
      id: 'year',
      accessorKey: 'year',
      header: t('fields.year'),
      meta: FIGURE,
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.year || '-'}</span>,
    },
    {
      id: 'maxSpeed',
      accessorKey: 'maxSpeed',
      header: t('fields.speed'),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-muted rounded-full h-2 w-20">
            <div
              className="bg-green-500 h-2 rounded-full"
              style={{ width: `${levelPercent(row.original.maxSpeed)}%` }}
            />
          </div>
          <span className="text-muted-foreground w-12 text-right tabular-nums">
            {formatLevel(row.original.maxSpeed)}
          </span>
        </div>
      ),
    },
    {
      id: 'brakeForce',
      accessorKey: 'brakeForce',
      header: t('fields.braking'),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-muted rounded-full h-2 w-20">
            <div
              className="bg-red-500 h-2 rounded-full"
              style={{ width: `${levelPercent(row.original.brakeForce)}%` }}
            />
          </div>
          <span className="text-muted-foreground w-12 text-right tabular-nums">
            {formatLevel(row.original.brakeForce)}
          </span>
        </div>
      ),
    },
    {
      id: 'fuelCapacity',
      accessorKey: 'fuelCapacity',
      header: t('fields.fuel'),
      meta: FIGURE,
      cell: ({ row }) => <span className="text-muted-foreground">{formatLevel(row.original.fuelCapacity)}</span>,
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
    {
      id: 'sessions',
      accessorFn: (row) => row._count?.sessions || 0,
      header: t('glossary:session', { count: 2 }),
      meta: FIGURE,
      cell: ({ row }) => <span className="text-muted-foreground">{row.original._count?.sessions || 0}</span>,
    },
    editColumn(onEdit),
  ]
}
