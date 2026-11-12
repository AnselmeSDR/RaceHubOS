import { RefreshCw, Rocket, Clock } from 'lucide-react'
import { editColumn } from '@/components/crud/editColumn'
import TrackPicture from './TrackPicture'

function formatTime(ms) {
  if (!ms) return '-'
  return (ms / 1000).toFixed(3) + 's'
}

/** The columns of the tracks table; `onEdit(track)` opens a track's form. */
export function trackColumns(t, { onEdit }) {
  return [
    {
      accessorKey: 'name',
      header: t('fields.name'),
      cell: ({ row }) => {
        const track = row.original
        return (
          <div className="flex items-center gap-3">
            <TrackPicture track={track} />
            <span className="font-semibold">{track.name}</span>
          </div>
        )
      },
    },
    {
      id: 'length',
      accessorFn: (row) => row.length || 0,
      header: t('fields.length'),
      cell: ({ row }) => (
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Rocket className="w-4 h-4 text-purple-500" />
          {row.original.length ? `${row.original.length}m` : '-'}
        </span>
      ),
    },
    {
      id: 'corners',
      accessorFn: (row) => row.corners || 0,
      header: t('fields.corners'),
      cell: ({ row }) => (
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <RefreshCw className="w-4 h-4 text-purple-500" />
          {row.original.corners || '-'}
        </span>
      ),
    },
    {
      id: 'bestLap',
      accessorFn: (row) => row.bestLap || Infinity,
      header: t('common:record'),
      cell: ({ row }) => (
        <div>
          <span className="font-mono font-bold">{formatTime(row.original.bestLap)}</span>
          {row.original.bestLapBy && (
            <span className="text-xs text-muted-foreground ml-1.5">
              {t('common:by')} {row.original.bestLapBy}
            </span>
          )}
        </div>
      ),
    },
    {
      id: 'sessions',
      accessorFn: (row) => row._count?.sessions || 0,
      header: t('glossary:session', { count: 2 }),
      cell: ({ row }) => (
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Clock className="w-4 h-4" />
          {row.original._count?.sessions || 0}
        </span>
      ),
    },
    editColumn(onEdit),
  ]
}
