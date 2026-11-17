import { useTranslation } from 'react-i18next'
import { DivisionScope } from '@racehubos/shared'
import CarPicture from '@/components/car/CarPicture'
import DriverAvatar from '@/components/driver/DriverAvatar'
import { divisionColor } from '@/lib/colors'
import { pictureName } from '@/lib/viewTransition'
import { PRESS } from '@/lib/press'
import DivisionLogo from './DivisionLogo'

// Faces overlap; cars, whose pictures have no background, would blur into one another: side by side, one fewer
const FACE = '-ml-1.5 size-5 ring-2 ring-card first:ml-0'
const CAR = 'ml-0.5 size-5 first:ml-0'

/**
 * A division in the grid: its logo (or its short name on its colour), its name, its rank, then the
 * faces of its first drivers, or the first cars of a category, and how many there are.
 */
export default function DivisionCard({ division, onClick }) {
  const { t } = useTranslation('divisions')
  const color = divisionColor(division)
  const category = division.scope === DivisionScope.CAR
  const members = category ? (division.cars ?? []) : (division.drivers ?? [])
  const count = (category ? division._count?.cars : division._count?.drivers) ?? members.length

  return (
    <article
      data-testid="entity-card"
      data-entity-id={division.id}
      onClick={onClick}
      style={{ borderTopColor: color }}
      className={`flex cursor-pointer flex-col gap-2 rounded-xl border border-t-[3px] border-border bg-card p-3 hover:border-foreground/30 ${PRESS}`}
    >
      <div className="flex items-center gap-2.5">
        {/* Without a logo, its short name on its colour, as in the list */}
        <DivisionLogo division={division} className="size-11" transitionName={pictureName('division', division.id)} />
        <div className="min-w-0">
          {/* A long name wraps: it is read whole, never cut */}
          <h3 className="text-sm font-bold break-words text-foreground">{division.name}</h3>
          <p className="text-[11px] text-muted-foreground">
            {t(category ? 'card.order' : 'card.rank', { n: division.order })}
          </p>
        </div>
      </div>
      {/* Drivers and cars alike: the first ones, then how many there are, on one line */}
      <div className="flex h-6 items-center overflow-hidden text-[11px] whitespace-nowrap text-muted-foreground">
        {members
          .slice(0, category ? 4 : 5)
          .map((member) =>
            category ? (
              <CarPicture key={member.id} car={member} className={CAR} />
            ) : (
              <DriverAvatar key={member.id} driver={member} alt={member.name} className={FACE} />
            )
          )}
        <span className={members.length ? 'ml-2' : ''}>
          {count
            ? `${count} ${t(category ? 'glossary:car' : 'glossary:driver', { count })}`
            : t(category ? 'card.noCars' : 'card.noDrivers')}
        </span>
      </div>
    </article>
  )
}
