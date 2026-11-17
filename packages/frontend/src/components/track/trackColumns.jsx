import { editColumn } from '@/components/crud/editColumn'
import { FIGURE } from '@/components/crud/figure'
import TrackPicture from './TrackPicture'
import { pictureName } from '@/lib/viewTransition'

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
            <TrackPicture track={track} className="size-7" transitionName={pictureName('track', track.id)} />
            <span className="font-semibold">{track.name}</span>
          </div>
        )
      },
    },
    {
      id: 'length',
      accessorFn: (row) => row.length || 0,
      header: t('fields.length'),
      meta: FIGURE,
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.length ? `${row.original.length}m` : '-'}</span>
      ),
    },
    {
      id: 'corners',
      accessorFn: (row) => row.corners || 0,
      header: t('fields.corners'),
      meta: FIGURE,
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.corners || '-'}</span>,
    },
    {
      id: 'bestLap',
      accessorFn: (row) => row.bestLap || Infinity,
      header: t('common:record'),
      meta: FIGURE,
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
      meta: FIGURE,
      cell: ({ row }) => <span className="text-muted-foreground">{row.original._count?.sessions || 0}</span>,
    },
    editColumn(onEdit),
  ]
}
