import { useTranslation } from 'react-i18next'
import { Users, X } from 'lucide-react'
import CarSelect from '../../car/CarSelect'
import { DivisionBadges } from '../../division/DivisionBadge'
import DivisionFilters from '../../division/DivisionFilters'
import { useDivisionFilter } from '@/hooks/useDivisionFilter'
import DriverAvatar from '@/components/driver/DriverAvatar'
import { withEmptyRow } from './wizardPlan'

const OUTSIDE =
  'text-[11px] font-medium rounded-full px-2 py-0.5 bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-100'

// A car run by another participant too
const SharedCarIcon = () => <Users aria-hidden="true" className="size-4 shrink-0 text-sky-600 dark:text-sky-400" />

/**
 * The divisions and categories the championship is run for, then its line-up and the car each one
 * runs: their preferred car unless changed, or none (then picked in each session). The selectors
 * only offer the drivers and cars of the divisions and categories chosen, the preferred car too; a
 * participant already chosen stays, flagged outside them. Each driver can be picked once; a car can
 * be shared, marked by an icon explained under the line-up, without blocking anything.
 */
export default function WizardParticipantsStep({
  participants,
  drivers,
  cars,
  divisionIds,
  onDivisionsChange,
  onChange,
}) {
  const { t } = useTranslation('championships')
  const complete = participants.filter((p) => p.driverId).length
  const filter = useDivisionFilter(divisionIds)

  function availableDrivers(index) {
    const usedIds = new Set(participants.filter((_, i) => i !== index).map((p) => p.driverId))
    const current = participants[index]?.driverId
    return drivers.filter((d) => d.id === current || (!usedIds.has(d.id) && filter.driverFits(d)))
  }

  // The cars of the categories chosen, and the one the participant already runs
  const carsFor = (carId) => cars.filter((car) => car.id === carId || filter.carFits(car))

  const withCar = (entry, carId) => ({ ...entry, carId: carId || null, car: cars.find((c) => c.id === carId) || null })

  function update(index, entry) {
    const next = [...participants]
    next[index] = entry
    onChange(next)
  }

  function pickDriver(index, driverId) {
    const driver = drivers.find((d) => d.id === driverId) || null
    const preferred = cars.find((car) => car.id === driver?.preferredCarId)
    update(
      index,
      withCar({ driverId: driverId || null, driver }, preferred && filter.carFits(preferred) ? preferred.id : null)
    )
  }

  // The other participants running `carId`
  const sharing = (carId, index) =>
    participants
      .filter((p, i) => i !== index && p.carId && p.carId === carId)
      .map((p) => p.driver.name)
      .join(', ')

  return (
    <div data-testid="championship-wizard-participants" className="space-y-3">
      <DivisionFilters filter={filter} onChange={onDivisionsChange} hint={t('divisions:filters.hint')} />
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <p>{t('wizard.participantsCount', { count: complete })}</p>
        <p className="text-xs">{t('wizard.carHint')}</p>
      </div>

      {/* Rows rather than a table: on a narrow screen the car goes under the driver */}
      <div className="@container border border-border rounded-lg divide-y divide-border text-sm">
        <div className="hidden @lg:flex gap-3 px-3 py-2 text-muted-foreground text-xs uppercase font-medium bg-muted/50">
          <span className="w-5">#</span>
          <span className="flex-1 min-w-44">{t('glossary:driver_one')}</span>
          <span className="flex-[1.4] min-w-56">{t('glossary:car_one')}</span>
          <span className="w-5" />
        </div>
        {withEmptyRow(participants).map((p, i) => {
          const preferred = p.driver?.preferredCarId
          const shared = p.carId && sharing(p.carId, i)
          const driverOutside = p.driver && !filter.driverFits(p.driver)
          const carOutside = p.car && !filter.carFits(p.car)
          return (
            <div
              key={i}
              data-testid="wizard-participant"
              className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-1.5 ${p.driverId ? '' : 'bg-muted/20'}`}
            >
              <span className="w-5 text-xs text-muted-foreground">{p.driverId ? i + 1 : ''}</span>
              <div className="flex flex-1 min-w-44 items-center gap-2">
                {p.driver && <DriverAvatar driver={p.driver} label={p.driver.number} className="size-5" />}
                <select
                  aria-label={t('glossary:driver_one')}
                  value={p.driverId || ''}
                  onChange={(e) => pickDriver(i, e.target.value)}
                  className="w-full min-w-0 px-2 py-1 border-none bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-ring rounded"
                >
                  <option value="">{t('wizard.driverPlaceholder')}</option>
                  {availableDrivers(i).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
                <DivisionBadges divisions={p.driver?.divisions} faded={driverOutside} className="flex shrink-0 gap-1" />
                {driverOutside && <span className={OUTSIDE}>{t('divisions:filters.outOfDivision')}</span>}
              </div>
              {p.driverId ? (
                <>
                  <div className="flex flex-[1.4] min-w-56 flex-wrap items-center gap-2">
                    <CarSelect
                      className="flex-1"
                      cars={carsFor(p.carId)}
                      value={p.carId}
                      onChange={(carId) => update(i, withCar(p, carId))}
                      label={t('wizard.carOf', { name: p.driver.name })}
                      noneLabel={t('wizard.noCar')}
                      // Who else runs each other car; the one run carries the icon instead
                      describe={(car) => {
                        const others = car.id !== p.carId && sharing(car.id, i)
                        return others && t('wizard.alsoRuns', { names: others })
                      }}
                    />
                    <DivisionBadges divisions={p.car?.divisions} faded={carOutside} className="flex shrink-0 gap-1" />
                    {carOutside && <span className={OUTSIDE}>{t('divisions:filters.outOfCategory')}</span>}
                    {preferred && p.carId === preferred && (
                      <span className="text-[11px] font-medium rounded-full px-2 py-0.5 bg-yellow-100 text-yellow-900 dark:bg-yellow-900/40 dark:text-yellow-100">
                        {t('wizard.fromProfile')}
                      </span>
                    )}
                    {preferred && p.carId !== preferred && (
                      <span className="text-[11px] font-medium rounded-full px-2 py-0.5 bg-muted text-muted-foreground">
                        {t('wizard.carChanged')}
                      </span>
                    )}
                    {shared && (
                      <span
                        role="img"
                        aria-label={t('wizard.sharedCar', { names: shared })}
                        title={t('wizard.sharedCar', { names: shared })}
                      >
                        <SharedCarIcon />
                      </span>
                    )}
                  </div>
                  <button
                    aria-label={t('common:delete')}
                    onClick={() => onChange(participants.filter((_, j) => j !== i))}
                    className="w-5 p-0.5 hover:bg-destructive/10 rounded text-muted-foreground hover:text-destructive"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </>
              ) : (
                // Keeps the empty row's driver in its column
                <span aria-hidden="true" className="hidden @lg:block flex-[1.4] min-w-56 pr-8" />
              )}
            </div>
          )
        })}
      </div>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <SharedCarIcon />
        {t('wizard.sharedCarLegend')}
      </p>
    </div>
  )
}
