import { Flag } from 'lucide-react'
import { formatLevel, levelPercent } from '@racehubos/shared'
import { editColumn } from '@/components/crud/editColumn'
import { filteredColumn } from '@/components/crud/filteredColumn'
import { DivisionBadges } from '@/components/division/DivisionBadge'
import { carColor } from '@/lib/colors'
import CarPicture from '@/components/car/CarPicture'

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
            {car.img ? (
              <CarPicture car={car} alt="" className="w-14 h-8" />
            ) : (
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white overflow-hidden flex-shrink-0"
                style={{ backgroundColor: carColor(car) }}
              >
                {car.brand?.charAt(0)}
              </div>
            )}
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
          <DivisionBadges divisions={row.original.divisions} />
        ) : (
          <span className="text-muted-foreground">-</span>
        )
    ),
    {
      id: 'year',
      accessorKey: 'year',
      header: t('fields.year'),
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
      cell: ({ row }) => (
        <span className="text-muted-foreground tabular-nums">{formatLevel(row.original.fuelCapacity)}</span>
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
    {
      id: 'sessions',
      accessorFn: (row) => row._count?.sessions || 0,
      header: t('glossary:session', { count: 2 }),
      cell: ({ row }) => (
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Flag className="w-4 h-4" />
          {row.original._count?.sessions || 0}
        </span>
      ),
    },
    editColumn(onEdit),
  ]
}
