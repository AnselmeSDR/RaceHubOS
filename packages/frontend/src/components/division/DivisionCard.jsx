import { useTranslation } from 'react-i18next'
import { DivisionScope } from '@racehubos/shared'
import { Card } from '@/components/ui/card'
import CardActions from '@/components/crud/CardActions'
import CarPicture from '@/components/car/CarPicture'
import { divisionColor } from '@/lib/colors'
import DivisionBadge from './DivisionBadge'
import DivisionLogo from './DivisionLogo'

const SHOWN = 3

/** A division in the grid: logo, rank, badge and its first drivers, or a category and its first cars. */
export default function DivisionCard({ division, onClick, onEdit, onDelete }) {
  const { t } = useTranslation('divisions')
  const color = divisionColor(division)
  const category = division.scope === DivisionScope.CAR
  const members = category ? (division.cars ?? []) : (division.drivers ?? [])
  const count = (category ? division._count?.cars : division._count?.drivers) ?? members.length
  const more = count - Math.min(members.length, SHOWN)

  return (
    <Card
      data-testid="entity-card"
      data-entity-id={division.id}
      onClick={onClick}
      className="relative overflow-hidden cursor-pointer hover:shadow-2xl transition-all border-l-4"
      style={{ borderLeftColor: color, background: `linear-gradient(160deg, ${color}22 0%, transparent 60%)` }}
    >
      <CardActions onEdit={onEdit} onDelete={onDelete} />
      <div className="p-6 pb-4">
        <div className="flex items-start justify-between gap-3 mb-4">
          <DivisionLogo division={division} />
          <div className="flex flex-col items-end gap-2 pt-8">
            <span className="rounded-full bg-card/80 px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground shadow-sm">
              {t(category ? 'card.order' : 'card.rank', { n: division.order })}
            </span>
            <DivisionBadge division={division} />
          </div>
        </div>
        <h3 className="font-black text-2xl tracking-tight text-foreground uppercase break-words">{division.name}</h3>
        <div className="h-1 w-16 rounded-full mt-2" style={{ backgroundColor: color }} />
      </div>

      <div className="px-6 pb-6">
        <div className="bg-card/50 rounded-lg p-4 border border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-muted-foreground uppercase">
              {t(category ? 'glossary:car' : 'glossary:driver', { count: 2 })}
            </span>
            <span className="text-2xl font-black" style={{ color }}>
              {count}
            </span>
          </div>
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">{t(category ? 'card.noCars' : 'card.noDrivers')}</p>
          ) : category ? (
            <div className="flex flex-wrap gap-2">
              {members.slice(0, SHOWN).map((car) => (
                <CarPicture key={car.id} car={car} className="size-[42px]" />
              ))}
            </div>
          ) : (
            <div className="space-y-1">
              {members.slice(0, SHOWN).map((driver) => (
                <div key={driver.id} className="flex items-center gap-2 text-sm">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-foreground font-medium">{driver.name}</span>
                  {driver.number && <span className="text-muted-foreground text-xs">#{driver.number}</span>}
                </div>
              ))}
            </div>
          )}
          {more > 0 && <p className="text-xs text-muted-foreground italic mt-2">{t('card.more', { count: more })}</p>}
        </div>
      </div>
    </Card>
  )
}
