import { Trophy } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { sessionBadgeClass } from '@/lib/colors'
import { getImgUrl } from '@/utils/image'
import LinkCell from '@/components/crud/LinkCell'
import { filteredColumn as filtered } from '@/components/crud/filteredColumn'

const PODIUM_BACKGROUNDS = ['bg-yellow-500', 'bg-gray-400', 'bg-orange-500']

function formatTime(ms) {
  if (!ms) return '-'
  return (ms / 1000).toFixed(3) + 's'
}

/**
 * The columns of the laps table. The driver, car, track, championship and session columns filter on
 * the matching key of the column filter context; `onOpen(path)` opens an entity's page.
 */
export function statsColumns(t, { lang, onOpen }) {
  return [
    {
      id: 'position',
      header: '#',
      enableHiding: false,
      enableSorting: false,
      cell: ({ row }) => {
        const index = row.index
        if (index >= 3) return <span className="text-muted-foreground font-medium">{index + 1}</span>
        return (
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white ${PODIUM_BACKGROUNDS[index]}`}
          >
            {index === 0 ? <Trophy className="w-4 h-4" /> : index + 1}
          </div>
        )
      },
    },
    {
      id: 'lapTime',
      accessorKey: 'lapTime',
      header: t('common:time'),
      cell: ({ row }) => (
        <span className={`font-mono font-bold ${row.index < 3 ? 'text-yellow-600 dark:text-yellow-400' : ''}`}>
          {formatTime(row.original.lapTime)}
        </span>
      ),
    },
    filtered(
      'driver',
      'driverId',
      t('glossary:driver', { count: 1 }),
      (row) => row.driver?.name || '',
      ({ row }) => {
        const driver = row.original.driver
        return (
          <LinkCell
            to={`/drivers/${driver?.id}`}
            onOpen={onOpen}
            className="flex items-center gap-2 cursor-pointer hover:opacity-80"
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold overflow-hidden flex-shrink-0"
              style={{ backgroundColor: driver?.color || '#666' }}
            >
              {driver?.img ? (
                <img src={getImgUrl(driver.img)} alt="" className="w-full h-full object-cover" />
              ) : (
                driver?.name?.charAt(0)
              )}
            </div>
            <span className="font-medium truncate">{driver?.name}</span>
          </LinkCell>
        )
      }
    ),
    filtered(
      'car',
      'carId',
      t('glossary:car', { count: 1 }),
      (row) => `${row.car?.brand} ${row.car?.model}`,
      ({ row }) => {
        const car = row.original.car
        return (
          <LinkCell
            to={`/cars/${car?.id}`}
            onOpen={onOpen}
            className="flex items-center gap-2 cursor-pointer hover:opacity-80"
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold overflow-hidden flex-shrink-0"
              style={{ backgroundColor: car?.color || '#666' }}
            >
              {car?.img ? (
                <img src={getImgUrl(car.img)} alt="" className="w-full h-full object-cover" />
              ) : (
                car?.brand?.charAt(0)
              )}
            </div>
            <span className="text-muted-foreground truncate">
              {car?.brand} {car?.model}
            </span>
          </LinkCell>
        )
      }
    ),
    filtered(
      'track',
      'trackId',
      t('glossary:track', { count: 1 }),
      (row) => row.track?.name || '',
      ({ row }) => {
        const track = row.original.track
        return (
          <LinkCell
            to={`/tracks/${track?.id}`}
            onOpen={onOpen}
            className="flex items-center gap-2 cursor-pointer hover:opacity-80"
          >
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: track?.color || '#666' }} />
            <span className="text-muted-foreground truncate">{track?.name}</span>
          </LinkCell>
        )
      }
    ),
    filtered(
      'championship',
      'championshipId',
      t('glossary:championship', { count: 1 }),
      (row) => row.championship?.name || '',
      ({ row }) => {
        const championship = row.original.championship
        if (!championship) return <span className="text-muted-foreground/50">—</span>
        return (
          <span
            className="truncate cursor-pointer hover:opacity-80"
            onClick={(e) => {
              e.stopPropagation()
              onOpen(`/championships/${championship.id}`)
            }}
          >
            {championship.name}
          </span>
        )
      }
    ),
    filtered(
      'sessionType',
      'sessionType',
      t('glossary:session', { count: 1 }),
      (row) => row.sessionType,
      ({ row }) => (
        <Badge className={sessionBadgeClass(row.original.sessionType)}>
          {t(`glossary:sessionType.${row.original.sessionType}`, { defaultValue: row.original.sessionType })}
        </Badge>
      )
    ),
    {
      id: 'date',
      accessorFn: (row) => row.sessionDate,
      header: t('common:date'),
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.sessionDate ? new Date(row.original.sessionDate).toLocaleDateString(lang) : '-'}
        </span>
      ),
    },
  ]
}
