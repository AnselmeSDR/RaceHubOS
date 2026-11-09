import { Users } from 'lucide-react'
import { teamColor } from '@/lib/colors'
import { getImgUrl } from '@/utils/image'

/** The columns of the teams table (a row opens the team's form). */
export function teamColumns(t) {
  return [
    {
      accessorKey: 'name',
      header: t('glossary:team', { count: 1 }),
      cell: ({ row }) => {
        const team = row.original
        return (
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold overflow-hidden flex-shrink-0"
              style={{ backgroundColor: teamColor(team) }}
            >
              {team.img ? (
                <img src={getImgUrl(team.img)} alt="" className="w-full h-full object-cover" />
              ) : (
                <Users className="w-4 h-4" />
              )}
            </div>
            <span className="font-semibold">{team.name}</span>
          </div>
        )
      },
    },
    {
      id: 'color',
      accessorKey: 'color',
      header: t('common:colorLabel'),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-6 rounded-md border border-border"
            style={{ backgroundColor: teamColor(row.original) }}
          />
          <span className="text-muted-foreground font-mono text-xs">{row.original.color}</span>
        </div>
      ),
    },
    {
      id: 'drivers',
      accessorFn: (row) => row._count?.drivers || 0,
      header: t('glossary:driver', { count: 2 }),
      cell: ({ row }) => {
        const team = row.original
        return (
          <div>
            <span className="font-medium">{team._count?.drivers || 0}</span>
            {team.drivers?.length > 0 && (
              <span className="text-muted-foreground ml-1.5">
                (
                {team.drivers
                  .slice(0, 2)
                  .map((d) => d.name)
                  .join(', ')}
                {team.drivers.length > 2 ? '...' : ''})
              </span>
            )}
          </div>
        )
      },
    },
  ]
}
