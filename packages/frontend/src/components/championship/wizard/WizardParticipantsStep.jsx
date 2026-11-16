import { useTranslation } from 'react-i18next'
import { RotateCcw, Users, X } from 'lucide-react'
import CarPicture from '@/components/car/CarPicture'
import CarSelect from '../../car/CarSelect'
import { DivisionBadges } from '../../division/DivisionBadge'
import DivisionFilters from '../../division/DivisionFilters'
import { useDivisionFilter } from '@/hooks/useDivisionFilter'
import DriverAvatar from '@/components/driver/DriverAvatar'
import { validity } from './validity'
import { withEmptyRow } from './wizardPlan'

const OUTSIDE =
  'text-[11px] font-medium whitespace-nowrap rounded-full px-2 py-0.5 bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-100'

// # · driver · their divisions · car · its categories and tags · remove: the selects share their columns;
// many badges wrap in theirs rather than squeezing the selects
const GRID =
  '@3xl:grid @3xl:grid-cols-[auto_minmax(9rem,1fr)_fit-content(12rem)_minmax(11rem,1.4fr)_fit-content(9rem)_auto]'
const ROW = '@3xl:grid @3xl:col-span-full @3xl:grid-cols-subgrid'
// A cell of a select column: its share of the row when wrapping, its column on the grid
const CELL = '@3xl:min-w-0'
// Narrow, without the grid: the car on a second line, under the driver
const CarLine = () => <span aria-hidden="true" className="basis-full @3xl:hidden" />
const CAR_CELL = `flex-1 min-w-56 ml-8 @3xl:ml-0 ${CELL}`

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
  retired = [],
  retiredWhere = () => '',
  onDivisionsChange,
  onChange,
  onRestore,
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
      <DivisionFilters filter={filter} onChange={onDivisionsChange} />
      <p className="text-sm text-muted-foreground">{t('wizard.participantsCount', { count: complete })}</p>

      {/* One grid, each row on it: every column as wide on every row; on a narrow screen the rows
          wrap, the car under the driver */}
      <div className="@container">
        <div className={`${GRID} border border-border rounded-lg divide-y divide-border text-sm`}>
          <div className={`hidden ${ROW} px-3 py-2 text-muted-foreground text-xs uppercase font-medium bg-muted/50`}>
            <span>#</span>
            <span className="@3xl:col-span-2">{t('glossary:driver_one')}</span>
            <span className="@3xl:col-span-3">{t('glossary:car_one')}</span>
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
                className={`flex flex-wrap ${ROW} items-center gap-x-3 gap-y-1.5 px-3 py-1.5 ${p.driverId ? '' : 'bg-muted/20'}`}
              >
                <span className="w-5 text-xs text-muted-foreground">{p.driverId ? i + 1 : ''}</span>
                <div className={`flex flex-1 min-w-44 ${CELL} items-center gap-2`}>
                  {p.driver && <DriverAvatar driver={p.driver} label={p.driver.number} className="size-5" />}
                  <select
                    aria-label={t('glossary:driver_one')}
                    value={p.driverId || ''}
                    // Fewer than two drivers: the empty row is the one to fill
                    required={!p.driverId && complete < 2}
                    ref={validity(!p.driverId && complete < 2 && t('wizard.driversRequired'))}
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
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  <DivisionBadges
                    divisions={p.driver?.divisions}
                    faded={driverOutside}
                    className="flex flex-wrap gap-1"
                  />
                  {driverOutside && <span className={OUTSIDE}>{t('divisions:filters.outOfDivision')}</span>}
                </div>
                {p.driverId && (
                  <>
                    <CarLine />
                    <CarSelect
                      className={CAR_CELL}
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
                    <div className="flex min-w-18 flex-wrap items-center justify-end gap-2 @3xl:min-w-0 @3xl:justify-start">
                      <DivisionBadges
                        divisions={p.car?.divisions}
                        faded={carOutside}
                        className="flex flex-wrap gap-1"
                      />
                      {carOutside && <span className={OUTSIDE}>{t('divisions:filters.outOfCategory')}</span>}
                      {preferred && p.carId === preferred && (
                        <span className="text-[11px] font-medium whitespace-nowrap rounded-full px-2 py-0.5 bg-yellow-100 text-yellow-900 dark:bg-yellow-900/40 dark:text-yellow-100">
                          {t('wizard.fromProfile')}
                        </span>
                      )}
                      {preferred && p.carId !== preferred && (
                        <span className="text-[11px] font-medium whitespace-nowrap rounded-full px-2 py-0.5 bg-muted text-muted-foreground">
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
                )}
              </div>
            )
          })}
          {/* Who raced and left: their results stay, DNF in the sessions to come they were in */}
          {retired.map((r) => {
            const where = retiredWhere(r.driverId)
            return (
              <div
                key={r.driverId}
                data-testid="wizard-retired"
                className={`flex flex-wrap ${ROW} items-center gap-x-3 gap-y-1.5 px-3 py-1.5 bg-muted/30`}
              >
                <span className="w-5" />
                {/* Why the driver is struck through goes under their name: no column grows for it */}
                <div className={`flex flex-1 min-w-44 ${CELL} items-center gap-2`}>
                  <DriverAvatar driver={r.driver} label={r.driver.number} className="size-5 grayscale opacity-60" />
                  <div className="flex min-w-0 flex-col items-start gap-0.5">
                    <span className="max-w-full truncate line-through opacity-60">{r.driver.name}</span>
                    <span className="max-w-full truncate rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
                      {where ? t('wizard.retiredDnf', { sessions: where }) : t('wizard.retired')}
                    </span>
                  </div>
                </div>
                <span />
                <CarLine />
                <div className={`flex ${CAR_CELL} items-center gap-2 text-xs text-muted-foreground opacity-60`}>
                  {r.car?.img && <CarPicture car={r.car} className="size-7 grayscale" />}
                  {r.car && <span className="truncate">{`${r.car.brand} ${r.car.model}`}</span>}
                </div>
                <button
                  type="button"
                  onClick={() => onRestore(r)}
                  className="flex items-center gap-1 text-xs font-medium text-primary hover:underline @3xl:col-span-2 @3xl:justify-self-end"
                >
                  <RotateCcw aria-hidden="true" className="size-3" />
                  {t('wizard.restore', { name: r.driver.name })}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
