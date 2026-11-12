import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import CarSelect from '../../car/CarSelect'
import { DriverAvatar } from './DriverToken'
import { withEmptyRow } from './wizardPlan'

/**
 * The line-up of the championship and the car each one runs: their preferred car unless changed,
 * or none (then picked in each session). Each driver can be picked once; a car can be shared.
 */
export default function WizardParticipantsStep({ participants, drivers, cars, onChange }) {
  const { t } = useTranslation('championships')
  const complete = participants.filter((p) => p.driverId).length

  function availableDrivers(index) {
    const usedIds = new Set(participants.filter((_, i) => i !== index).map((p) => p.driverId))
    return drivers.filter((d) => !usedIds.has(d.id))
  }

  const withCar = (entry, carId) => ({ ...entry, carId: carId || null, car: cars.find((c) => c.id === carId) || null })

  function update(index, entry) {
    const next = [...participants]
    next[index] = entry
    onChange(next)
  }

  function pickDriver(index, driverId) {
    const driver = drivers.find((d) => d.id === driverId) || null
    update(index, withCar({ driverId: driverId || null, driver }, driver?.preferredCarId))
  }

  // The other participants running `carId`
  const sharing = (carId, index) =>
    participants
      .filter((p, i) => i !== index && p.carId && p.carId === carId)
      .map((p) => p.driver.name)
      .join(', ')

  return (
    <div data-testid="championship-wizard-participants" className="space-y-3">
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
          return (
            <div
              key={i}
              data-testid="wizard-participant"
              className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-1.5 ${p.driverId ? '' : 'bg-muted/20'}`}
            >
              <span className="w-5 text-xs text-muted-foreground">{p.driverId ? i + 1 : ''}</span>
              <div className="flex flex-1 min-w-44 items-center gap-2">
                {p.driver && <DriverAvatar driver={p.driver} />}
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
              </div>
              {p.driverId ? (
                <>
                  <div className="flex flex-[1.4] min-w-56 flex-wrap items-center gap-2">
                    <CarSelect
                      className="flex-1"
                      cars={cars}
                      value={p.carId}
                      onChange={(carId) => update(i, withCar(p, carId))}
                      label={t('wizard.carOf', { name: p.driver.name })}
                      noneLabel={t('wizard.noCar')}
                      describe={(car) => {
                        const others = sharing(car.id, i)
                        return others && t('wizard.alsoRuns', { names: others })
                      }}
                    />
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
                      <span className="text-[11px] text-muted-foreground">
                        {t('wizard.alsoRuns', { names: shared })}
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
    </div>
  )
}
