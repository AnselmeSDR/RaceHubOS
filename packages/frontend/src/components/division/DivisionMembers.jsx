import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Car, Plus, Users, X } from 'lucide-react'
import { DivisionScope } from '@racehubos/shared'
import CarPicture from '@/components/car/CarPicture'
import LapTime from '@/components/race/LapTime'
import { addToDivision, removeFromDivision } from '@/lib/divisionApi'
import { getData } from '@/lib/sessionApi'
import DriverAvatar from '@/components/driver/DriverAvatar'
import { DivisionBadges } from './DivisionBadge'

const carName = (car) => `${car.brand} ${car.model}`

/** The figures of a member, each column hidden on a narrow page. */
const FIGURES = {
  [DivisionScope.DRIVER]: [
    ['glossary:race_other', (d) => d.races ?? 0],
    ['glossary:win_other', (d) => d.wins ?? 0],
    ['glossary:podium_other', (d) => d.podiums ?? 0],
    ['common:record', (d) => <LapTime time={d.bestLap} size="sm" />],
  ],
  [DivisionScope.CAR]: [
    ['glossary:race_other', (c) => c.races ?? 0],
    ['common:record', (c) => <LapTime time={c.bestLap} size="sm" />],
  ],
}

function DriverName({ driver }) {
  return (
    <>
      <DriverAvatar driver={driver} />
      <Link to={`/drivers/${driver.id}`} className="font-semibold truncate hover:underline">
        {driver.name}
      </Link>
      {driver.number != null && (
        <span
          className="rounded-full px-1.5 min-w-8 text-center text-xs font-bold text-white"
          style={{ backgroundColor: driver.color || '#6B7280' }}
        >
          {driver.number}
        </span>
      )}
    </>
  )
}

function CarName({ car }) {
  return (
    <>
      <CarPicture car={car} alt="" className="size-9" />
      <Link to={`/cars/${car.id}`} className="min-w-0 truncate hover:underline">
        <span className="font-bold uppercase">{car.brand}</span>{' '}
        <span className="text-muted-foreground">{car.model}</span>
      </Link>
      {car.year && (
        <span className="rounded-full bg-muted px-2 text-[11px] font-bold text-muted-foreground">{car.year}</span>
      )}
    </>
  )
}

/**
 * The drivers of a driver division, or the cars of a category: their other divisions, figures and
 * join date; one is added from a selector or removed by its cross. `onChange` gets the division back.
 */
export default function DivisionMembers({ division, onChange }) {
  const { t, i18n } = useTranslation('divisions')
  const category = division.scope === DivisionScope.CAR
  const members = (category ? division.cars : division.drivers) ?? []
  const [candidates, setCandidates] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    let current = true
    getData(`/api/${category ? 'cars' : 'drivers'}?limit=1000`).then((data) => {
      if (current && data) setCandidates(data)
    })
    return () => {
      current = false
    }
  }, [category])

  const memberIds = new Set(members.map((m) => m.id))
  const addable = candidates
    .filter((c) => !memberIds.has(c.id))
    .sort((a, b) => (category ? carName(a).localeCompare(carName(b)) : a.name.localeCompare(b.name)))
  const figures = FIGURES[division.scope] ?? []
  const since = (date) => new Date(date).toLocaleDateString(i18n.language)

  async function change(action, memberId) {
    setError('')
    try {
      onChange(await action(division.id, memberId, t('common:saveError')))
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <section className="@container rounded-xl border border-border bg-card" data-testid="division-members">
      <h2 className="flex items-center gap-2 px-4 py-3 border-b border-border font-bold">
        {category ? <Car className="size-4 text-green-600" /> : <Users className="size-4 text-blue-500" />}
        {t(category ? 'glossary:car' : 'glossary:driver', { count: 2 })}
        <span className="font-medium text-muted-foreground">{members.length}</span>
      </h2>
      {error && (
        <p role="alert" className="mx-4 mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      {members.length > 0 && (
        <div className="hidden @2xl:flex items-center gap-3 px-4 py-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
          <span className="flex-1">{t(category ? 'glossary:car_one' : 'glossary:driver_one')}</span>
          {figures.map(([label]) => (
            <span key={label} className="w-16 text-right">
              {t(label)}
            </span>
          ))}
          <span className="w-24 text-right">{t('profile.since')}</span>
          <span className="w-6" />
        </div>
      )}
      <ul>
        {members.length === 0 && (
          <li className="px-4 py-3 text-sm italic text-muted-foreground">
            {t(category ? 'card.noCars' : 'card.noDrivers')}
          </li>
        )}
        {members.map((member) => {
          const label = category ? carName(member) : member.name
          return (
            <li
              key={member.id}
              data-testid="division-member"
              className="flex items-center gap-3 px-4 py-2 border-t border-border/60 text-sm"
            >
              <span className="flex flex-1 min-w-0 items-center gap-2">
                {category ? <CarName car={member} /> : <DriverName driver={member} />}
                <DivisionBadges
                  divisions={member.divisions?.filter((other) => other.id !== division.id)}
                  className="flex shrink-0 gap-1"
                />
              </span>
              {figures.map(([key, value]) => (
                <span
                  key={key}
                  data-testid="division-member-figure"
                  className="hidden @2xl:block w-16 text-right font-semibold tabular-nums"
                >
                  {value(member)}
                </span>
              ))}
              <span className="hidden @2xl:block w-24 text-right text-xs text-muted-foreground">
                {since(member.since)}
              </span>
              <button
                type="button"
                aria-label={t('remove', { name: label })}
                onClick={() => change(removeFromDivision, member.id)}
                className="w-6 p-0.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              >
                <X className="size-4" />
              </button>
            </li>
          )
        })}
      </ul>
      {!division.deletedAt && (
        <div className="flex items-center gap-2 px-4 py-2.5 border-t border-border">
          <Plus className="size-4 text-muted-foreground" />
          <select
            value=""
            aria-label={t(category ? 'profile.addCar' : 'profile.addDriver')}
            onChange={(e) => e.target.value && change(addToDivision, e.target.value)}
            className="flex-1 h-8 rounded-md border border-border bg-background px-2 text-sm"
          >
            <option value="">{t(category ? 'profile.addCar' : 'profile.addDriver')}</option>
            {addable.map((c) => (
              <option key={c.id} value={c.id}>
                {category ? carName(c) : c.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </section>
  )
}
