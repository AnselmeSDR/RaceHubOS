import { Flag, MapPin, Trophy, Users2 } from 'lucide-react'
import { filteredColumn } from '@/components/crud/filteredColumn'
import { Badge } from '@/components/ui/badge'
import { sessionBadgeClass } from '@/lib/colors'
import SessionStatusIcon from './SessionStatusIcon'

// How long a session ran, as m:ss
function formatDuration(startedAt, finishedAt) {
  if (!startedAt || !finishedAt) return '-'
  const d = new Date(finishedAt) - new Date(startedAt)
  return `${Math.floor(d / 60000)}:${String(Math.floor((d % 60000) / 1000)).padStart(2, '0')}`
}

function formatDate(date, lang) {
  if (!date) return '-'
  return new Date(date).toLocaleDateString(lang, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * The columns of the sessions table. The type, track, status and championship columns filter on the
 * matching key of the column filter context.
 */
export function sessionColumns(t, { lang }) {
  return [
    {
      accessorKey: 'name',
      header: t('columns.name'),
      cell: ({ row }) => (
        <div>
          <span className="font-semibold">
            {row.original.name || t('unnamedSession', { id: row.original.id.slice(0, 8) })}
          </span>
          {row.original.championship && (
            <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
              <Trophy className="h-3 w-3 text-yellow-500" />
              {row.original.championship.name}
            </div>
          )}
        </div>
      ),
    },
    filteredColumn(
      'type',
      'type',
      t('columns.type'),
      (row) => row.type,
      ({ row }) => (
        <Badge className={sessionBadgeClass(row.original.type)}>
          {t(`glossary:sessionType.${row.original.type}`, { defaultValue: row.original.type })}
        </Badge>
      )
    ),
    filteredColumn(
      'track',
      'trackId',
      t('glossary:track', { count: 1 }),
      (row) => row.track?.name || '',
      ({ row }) => (
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <MapPin className="w-4 h-4" />
          {row.original.track?.name || t('common:notDefined')}
        </span>
      )
    ),
    filteredColumn(
      'status',
      'status',
      t('columns.status'),
      (row) => row.status,
      ({ row }) => (
        <span className="flex items-center gap-1.5">
          <SessionStatusIcon status={row.original.status} />
          <span className="text-muted-foreground">
            {t(`glossary:sessionStatus.${row.original.status}`, { defaultValue: row.original.status })}
          </span>
        </span>
      )
    ),
    filteredColumn(
      'championship',
      'championshipId',
      t('glossary:championship', { count: 1 }),
      (row) => row.championship?.name || '',
      ({ row }) => <span className="text-muted-foreground">{row.original.championship?.name || '-'}</span>
    ),
    {
      id: 'drivers',
      accessorFn: (row) => row.drivers?.length || 0,
      header: t('glossary:driver', { count: 2 }),
      cell: ({ row }) => (
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Users2 className="w-4 h-4" />
          {row.original.drivers?.length || 0}
        </span>
      ),
    },
    {
      id: 'laps',
      accessorFn: (row) => row._count?.laps || 0,
      header: t('glossary:lap', { count: 2 }),
      cell: ({ row }) => (
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Flag className="w-4 h-4" />
          {row.original._count?.laps || 0}
        </span>
      ),
    },
    {
      id: 'duration',
      accessorFn: (row) => (row.startedAt && row.finishedAt ? new Date(row.finishedAt) - new Date(row.startedAt) : 0),
      header: t('columns.duration'),
      cell: ({ row }) => (
        <span className="text-muted-foreground">{formatDuration(row.original.startedAt, row.original.finishedAt)}</span>
      ),
    },
    {
      id: 'date',
      accessorFn: (row) => row.updatedAt,
      header: t('columns.date'),
      cell: ({ row }) => <span className="text-muted-foreground">{formatDate(row.original.updatedAt, lang)}</span>,
    },
  ]
}
