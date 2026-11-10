import { Clock, Flag, MapPin, Trophy } from 'lucide-react'
import { ChampionshipStatus, SessionType } from '@racehubos/shared'
import { filteredColumn } from '@/components/crud/filteredColumn'
import ChampionshipStatusBadge from './ChampionshipStatusBadge'

const countOf = (type) => (row) => row.sessions?.filter((s) => s.type === type).length || 0

// A count of sessions with its icon
function countColumn(id, header, Icon, count) {
  return {
    id,
    accessorFn: count,
    header,
    cell: ({ row }) => (
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className={`w-4 h-4 ${id === 'qualifs' ? 'text-blue-500' : 'text-green-500'}`} />
        {count(row.original)}
      </span>
    ),
  }
}

/**
 * The columns of the championships table; `tracks` name each championship's track. The track and status
 * columns filter on the matching key of the column filter context.
 */
export function championshipColumns(t, { tracks }) {
  const trackOf = (row) => tracks.find((tr) => tr.id === row.trackId)

  return [
    {
      accessorKey: 'name',
      header: t('columns.name'),
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
            <Trophy className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
          </div>
          <span className="font-semibold">{row.original.name}</span>
        </div>
      ),
    },
    filteredColumn(
      'track',
      'trackId',
      t('glossary:track', { count: 1 }),
      (row) => trackOf(row)?.name || '',
      ({ row }) => (
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <MapPin className="w-4 h-4" />
          {trackOf(row.original)?.name || t('common:notDefined')}
        </span>
      )
    ),
    countColumn('qualifs', t('columns.qualifs'), Clock, countOf(SessionType.QUALIF)),
    countColumn('races', t('columns.races'), Flag, countOf(SessionType.RACE)),
    filteredColumn(
      'status',
      'status',
      t('common:status'),
      (row) => row.status || ChampionshipStatus.PLANNED,
      ({ row }) => <ChampionshipStatusBadge status={row.original.status} />
    ),
  ]
}
