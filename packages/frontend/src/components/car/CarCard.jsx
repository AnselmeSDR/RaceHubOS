import { useTranslation } from 'react-i18next'
import { Zap, Flame, FlaskConical } from 'lucide-react'
import { formatLevel, levelPercent } from '@racehubos/shared'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import CardActions from '@/components/crud/CardActions'
import { carColor } from '@/lib/colors'
import CarPicture from '@/components/car/CarPicture'

/** A car in the grid of the cars page: picture, settings gauges and races count. */
export default function CarCard({ car, onClick, onEdit, onDelete }) {
  const { t } = useTranslation('cars')
  const color = carColor(car)

  return (
    <Card
      data-testid="entity-card"
      data-entity-id={car.id}
      onClick={onClick}
      className="relative overflow-hidden cursor-pointer hover:shadow-2xl transition-all"
      style={{ background: `linear-gradient(135deg, ${color}10 0%, ${color}05 100%)` }}
    >
      <CardActions onEdit={onEdit} onDelete={onDelete} />
      <div className="absolute top-0 left-0 w-1 h-full opacity-80" style={{ backgroundColor: color }} />

      <div className="relative p-6 pb-4">
        <div className="flex items-start justify-between mb-4">
          {car.img ? (
            <CarPicture car={car} alt="" className="w-36 h-20" />
          ) : (
            <div className="relative">
              <div className="absolute inset-0 rounded-xl blur-md opacity-50" style={{ backgroundColor: color }} />
              <div
                className="relative w-20 h-20 rounded-xl flex items-center justify-center text-white font-black text-3xl ring-4 ring-white shadow-xl overflow-hidden"
                style={{ background: `linear-gradient(135deg, ${color} 0%, ${color}CC 100%)` }}
              >
                <span className="drop-shadow-lg">{car.brand?.charAt(0)}</span>
              </div>
            </div>
          )}
          {car.year && (
            <Badge variant="secondary" className="shadow-md">
              {car.year}
            </Badge>
          )}
        </div>
        <h3 className="font-black text-xl tracking-tight text-foreground uppercase">{car.brand}</h3>
        <p className="font-bold text-lg" style={{ color: color }}>
          {car.model}
        </p>
        <div className="h-1 w-16 rounded-full mt-2" style={{ backgroundColor: color }} />
      </div>

      <div className="relative px-6 pb-6 space-y-3">
        {[
          { icon: <Zap className="w-4 h-4" />, label: t('fields.speed'), value: car.maxSpeed, color: '#22C55E' },
          { icon: <Flame className="w-4 h-4" />, label: t('fields.braking'), value: car.brakeForce, color: '#EF4444' },
          {
            icon: <FlaskConical className="w-4 h-4" />,
            label: t('fields.tank'),
            value: car.fuelCapacity,
            color: '#3B82F6',
            display: car.fuelCapacity,
          },
        ].map((spec) => (
          <div key={spec.label} className="flex items-center justify-between p-2 bg-card/60 rounded-lg">
            <div className="flex items-center gap-2">
              <span style={{ color: spec.color }}>{spec.icon}</span>
              <span className="text-xs font-medium text-muted-foreground uppercase">{spec.label}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-20 bg-muted rounded-full h-2">
                <div
                  className="h-2 rounded-full"
                  style={{ width: `${levelPercent(spec.value)}%`, backgroundColor: spec.color }}
                />
              </div>
              <span className="text-sm font-black w-12 text-right tabular-nums" style={{ color: spec.color }}>
                {formatLevel(spec.display ?? spec.value)}
              </span>
            </div>
          </div>
        ))}
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground uppercase">{t('glossary:race', { count: 2 })}</span>
            <span className="text-lg font-black" style={{ color: color }}>
              {car._count?.sessions || 0}
            </span>
          </div>
        </div>
      </div>
    </Card>
  )
}
