import { useTranslation } from 'react-i18next'
import { Trophy, Flag, BarChart3 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import CardActions from '@/components/crud/CardActions'
import { DivisionBadges } from '@/components/division/DivisionBadge'
import { getImgUrl } from '@/utils/image'

/** A driver in the grid of the drivers page: picture, number, divisions, results and best lap. */
export default function DriverCard({ driver, onClick, onEdit, onDelete }) {
  const { t } = useTranslation('drivers')
  const wins = driver.wins || 0
  const podiums = driver.podiums || 0

  return (
    <Card
      data-testid="entity-card"
      data-entity-id={driver.id}
      onClick={onClick}
      className="relative overflow-hidden cursor-pointer hover:shadow-2xl transition-all duration-300"
      style={{
        background: `linear-gradient(135deg, ${driver.color}15 0%, ${driver.color}05 100%)`,
        boxShadow: `0 4px 6px rgba(0,0,0,0.1), 0 0 20px ${driver.color}40`,
      }}
    >
      <CardActions onEdit={onEdit} onDelete={onDelete} />
      <div className="absolute top-0 left-0 w-1 h-full opacity-80" style={{ backgroundColor: driver.color }} />
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `repeating-linear-gradient(45deg, ${driver.color}, ${driver.color} 10px, transparent 10px, transparent 20px)`,
        }}
      />

      <div className="relative p-6 pb-4">
        <div className="flex items-start justify-between mb-4">
          <div className="relative">
            <div
              className="absolute inset-0 rounded-full blur-md opacity-50"
              style={{ backgroundColor: driver.color }}
            />
            <div
              className="relative w-20 h-20 rounded-full flex items-center justify-center text-white font-black text-3xl ring-4 ring-white shadow-xl overflow-hidden"
              style={{ background: `linear-gradient(135deg, ${driver.color} 0%, ${driver.color}CC 100%)` }}
            >
              {driver.img ? (
                <img src={getImgUrl(driver.img)} alt={driver.name} className="w-full h-full object-cover" />
              ) : (
                <span className="drop-shadow-lg">{driver.name?.charAt(0)}</span>
              )}
            </div>
            {wins > 0 && (
              <div className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-yellow-500 flex items-center justify-center ring-2 ring-white shadow-lg">
                <Trophy className="w-4 h-4 text-white" />
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            {driver.number && (
              <div
                className="w-16 h-16 rounded-lg flex items-center justify-center shadow-lg"
                style={{ background: `linear-gradient(135deg, ${driver.color} 0%, ${driver.color}DD 100%)` }}
              >
                <span className="text-4xl font-black text-white drop-shadow-lg">{driver.number}</span>
              </div>
            )}
            <DivisionBadges divisions={driver.divisions} className="flex flex-wrap justify-end gap-1" />
          </div>
        </div>
        <h3 className="font-black text-2xl tracking-tight mb-1" style={{ color: driver.color }}>
          {driver.name?.toUpperCase()}
        </h3>
        <div className="h-1 w-16 rounded-full" style={{ backgroundColor: driver.color }} />
      </div>

      <div className="relative px-6 pb-4">
        <div className="grid grid-cols-3 gap-3">
          {[
            {
              icon: <Flag className="w-4 h-4" />,
              label: t('glossary:race', { count: 2 }),
              value: driver._count?.sessions || 0,
            },
            {
              icon: <Trophy className="w-4 h-4" />,
              label: t('glossary:podium', { count: 2 }),
              value: podiums,
              highlight: podiums > 0,
            },
            {
              icon: <BarChart3 className="w-4 h-4" />,
              label: t('glossary:lap', { count: 2 }),
              value: driver._count?.laps || 0,
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className={`p-2 rounded-lg text-center ${stat.highlight ? 'bg-yellow-50 dark:bg-yellow-900/30 ring-2 ring-yellow-400' : 'bg-card/60'}`}
            >
              <div
                className="flex items-center justify-center mb-1"
                style={{ color: stat.highlight ? '#EAB308' : driver.color }}
              >
                {stat.icon}
              </div>
              <div className="text-xs font-medium text-muted-foreground uppercase">{stat.label}</div>
              <div
                className="text-lg font-black tabular-nums"
                style={{ color: stat.highlight ? '#EAB308' : driver.color }}
              >
                {stat.value}
              </div>
            </div>
          ))}
        </div>
        {driver.bestLap && (
          <div className="mt-3 p-3 rounded-lg bg-card/80 border-2" style={{ borderColor: `${driver.color}40` }}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase">{t('card.bestLap')}</span>
              <span className="text-lg font-black tabular-nums" style={{ color: driver.color }}>
                {(driver.bestLap / 1000).toFixed(3)}s
              </span>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}
