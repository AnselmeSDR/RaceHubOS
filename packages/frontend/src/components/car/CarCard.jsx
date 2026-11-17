import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import { levelPercent, toLevel } from '@racehubos/shared'
import { DivisionBadges } from '@/components/division/DivisionBadge'
import { carColor } from '@/lib/colors'
import CarPicture from '@/components/car/CarPicture'
import { pictureName } from '@/lib/viewTransition'
import { PRESS } from '@/lib/press'

const GAUGES = [
  ['fields.speed', 'maxSpeed', '#22C55E'],
  ['fields.braking', 'brakeForce', '#EF4444'],
  ['fields.tank', 'fuelCapacity', '#3B82F6'],
]

/**
 * A car in the grid of the cars page: its picture on a halo of its colour, its three settings as
 * gauges, its races and its record. The text stays in the text colour: a dark car colour would not read.
 */
export default function CarCard({ car, onClick }) {
  const { t } = useTranslation('cars')
  const races = car.races || 0

  return (
    <article
      data-testid="entity-card"
      data-entity-id={car.id}
      onClick={onClick}
      className={`cursor-pointer overflow-hidden rounded-xl border border-border bg-card hover:border-foreground/30 ${PRESS}`}
    >
      <div
        className="relative grid h-24 place-items-center"
        style={{
          background: `radial-gradient(ellipse at 50% 85%, color-mix(in srgb, ${carColor(car)} 35%, transparent), transparent 70%)`,
        }}
      >
        <CarPicture
          car={car}
          alt=""
          className={car.img ? 'h-[88px] w-[150px] rounded-none' : 'size-14'}
          transitionName={pictureName('car', car.id)}
        />
      </div>
      <div className="flex flex-col gap-2 px-2.5 pt-2 pb-2.5">
        <div className="min-w-0">
          {/* The categories beside the brand: on the picture, an outlined badge would not read */}
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              {car.brand}
              {car.year ? ` · ${car.year}` : ''}
            </p>
            <DivisionBadges divisions={car.divisions} max={2} className="flex shrink-0 items-center gap-1" />
          </div>
          <h3 className="truncate text-sm font-bold text-foreground">{car.model}</h3>
        </div>
        <dl className="grid grid-cols-[max-content_1fr_max-content] items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
          {GAUGES.map(([label, key, colour]) => (
            <Fragment key={key}>
              <dt>{t(label)}</dt>
              <span className="h-1 overflow-hidden rounded-full bg-muted">
                <span
                  data-testid={`gauge-${key}`}
                  className="block h-full rounded-full"
                  style={{ width: `${levelPercent(car[key])}%`, backgroundColor: colour }}
                />
              </span>
              <dd className="text-right font-semibold text-foreground tabular-nums">{toLevel(car[key])}</dd>
            </Fragment>
          ))}
        </dl>
        <p className="flex items-baseline justify-between text-[11px] text-muted-foreground">
          <span>
            {races} {t('glossary:race', { count: races })}
          </span>
          {car.bestLap > 0 && <span className="font-mono tabular-nums">{(car.bestLap / 1000).toFixed(3)}s</span>}
        </p>
      </div>
    </article>
  )
}
