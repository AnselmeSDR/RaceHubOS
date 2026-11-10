import { useTranslation } from 'react-i18next'
import { Users } from 'lucide-react'
import { Card } from '@/components/ui/card'
import CardActions from '@/components/crud/CardActions'
import { teamColor } from '@/lib/colors'
import { getImgUrl } from '@/utils/image'

/** A team in the grid of the teams page: logo, colour and its first drivers. */
export default function TeamCard({ team, onClick, onEdit, onDelete }) {
  const { t } = useTranslation('teams')
  const color = teamColor(team)

  return (
    <Card
      data-testid="entity-card"
      data-entity-id={team.id}
      onClick={onClick}
      className="relative overflow-hidden cursor-pointer hover:shadow-2xl transition-all"
      style={{ background: `linear-gradient(135deg, ${color}10 0%, ${color}05 100%)` }}
    >
      <CardActions onEdit={onEdit} onDelete={onDelete} />
      <div className="absolute top-0 left-0 w-1 h-full opacity-80" style={{ backgroundColor: color }} />

      <div className="relative p-6 pb-4">
        <div className="flex items-start justify-between mb-4">
          <div className="relative">
            <div className="absolute inset-0 rounded-xl blur-md opacity-50" style={{ backgroundColor: color }} />
            <div
              className="relative w-20 h-20 rounded-xl flex items-center justify-center text-white ring-4 ring-white shadow-xl overflow-hidden"
              style={{ background: `linear-gradient(135deg, ${color} 0%, ${color}CC 100%)` }}
            >
              {team.img ? (
                <img src={getImgUrl(team.img)} alt="" className="w-full h-full object-cover" />
              ) : (
                <Users className="w-12 h-12 drop-shadow-lg" />
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-card/80 shadow-md">
            <div
              className="w-4 h-4 rounded-full border-2 border-white ring-1 ring-border"
              style={{ backgroundColor: color }}
            />
            <span className="text-xs font-mono font-bold text-muted-foreground">{color}</span>
          </div>
        </div>
        <h3 className="font-black text-2xl tracking-tight text-foreground uppercase break-words">{team.name}</h3>
        <div className="h-1 w-16 rounded-full mt-2" style={{ backgroundColor: color }} />
      </div>

      <div className="relative px-6 pb-6">
        <div className="bg-card/50 rounded-lg p-4 border border-border">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5" style={{ color: color }} />
              <span className="text-sm font-bold text-muted-foreground uppercase">
                {t('glossary:driver', { count: 2 })}
              </span>
            </div>
            <span className="text-2xl font-black" style={{ color: color }}>
              {team._count?.drivers || 0}
            </span>
          </div>
          {team.drivers?.length > 0 ? (
            <div className="space-y-1">
              {team.drivers.slice(0, 3).map((driver) => (
                <div key={driver.id} className="flex items-center gap-2 text-sm">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-foreground font-medium">{driver.name}</span>
                  {driver.number && <span className="text-muted-foreground text-xs">#{driver.number}</span>}
                </div>
              ))}
              {team.drivers.length > 3 && (
                <div className="text-xs text-muted-foreground italic mt-2">
                  {t('card.moreDrivers', { count: team.drivers.length - 3 })}
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground italic">{t('common:noDrivers')}</div>
          )}
        </div>
      </div>
    </Card>
  )
}
