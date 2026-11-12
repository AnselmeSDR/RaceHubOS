import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { UserPlus, Users, X } from 'lucide-react'
import { ChampionshipStatus, SessionStatus, SessionType } from '@racehubos/shared'
import { DivisionBadges } from '@/components/division/DivisionBadge'
import { setChampionshipParticipants } from './championshipConfigApi'

const API_URL = import.meta.env.VITE_API_URL || ''

/**
 * The drivers of an automatic championship; none can leave once a qualifying session has started.
 * Only the drivers of its divisions can be added (`filter` from `useDivisionFilter`), each with their
 * preferred car when it is in its categories; one outside them is flagged.
 */
export default function ChampionshipParticipantsPanel({
  championship,
  sessions,
  drivers,
  cars,
  filter,
  onChanged,
  onError,
}) {
  const { t } = useTranslation('championships')
  const participants = useMemo(() => championship.participants || [], [championship.participants])
  const finished = championship.status === ChampionshipStatus.FINISHED
  const qualifStarted = sessions.some((s) => s.type === SessionType.QUALIF && s.status !== SessionStatus.DRAFT)
  const ids = new Set(participants.map((p) => p.driverId))
  const available = drivers.filter((d) => !ids.has(d.id) && filter.driverFits(d))

  async function save(driverIds, added) {
    const preferred = cars.find((car) => car.id === added?.preferredCarId)
    const newcomer = added ? { [added.id]: preferred && filter.carFits(preferred) ? preferred.id : null } : {}
    try {
      await setChampionshipParticipants(championship.id, driverIds, t('configModal.genericError'), newcomer)
      onChanged?.()
    } catch (err) {
      onError(err.message)
    }
  }

  const driverIds = participants.map((p) => p.driverId)

  return (
    <div data-testid="championship-config-participants">
      <div className="flex items-center gap-2 mb-2">
        <Users className="size-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">
          {t('configModal.participants', { count: participants.length })}
        </span>
      </div>
      <div className="border border-border rounded-lg divide-y divide-border max-h-48 overflow-y-auto">
        {participants.map((p, i) => (
          <div key={p.id} className="flex items-center gap-2 px-3 py-1.5 text-xs">
            <span className="text-muted-foreground w-4 text-right">{i + 1}</span>
            {p.driver?.img && (
              <img src={`${API_URL}${p.driver.img}`} className="w-5 h-5 rounded-full object-cover" alt="" />
            )}
            <span className="font-medium flex-1 truncate">{p.driver?.name}</span>
            <DivisionBadges
              divisions={p.driver?.divisions}
              faded={!filter.driverFits(p.driver)}
              className="flex gap-1"
            />
            {!filter.driverFits(p.driver) && (
              <span className="rounded-full px-1.5 text-[10px] bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-100">
                {t('divisions:filters.outOfDivision')}
              </span>
            )}
            {!qualifStarted && !finished && (
              <button
                aria-label={t('common:delete')}
                onClick={() => save(driverIds.filter((id) => id !== p.driverId))}
                className="p-0.5 text-muted-foreground hover:text-destructive rounded hover:bg-destructive/10"
              >
                <X className="size-3" />
              </button>
            )}
          </div>
        ))}
        {!finished && (
          <div className="flex items-center gap-2 px-3 py-1.5">
            <UserPlus className="size-3.5 text-muted-foreground" />
            <select
              value=""
              aria-label={t('configModal.addDriver')}
              onChange={(e) =>
                e.target.value &&
                save(
                  [...driverIds, e.target.value],
                  drivers.find((d) => d.id === e.target.value)
                )
              }
              className="flex-1 h-6 text-xs bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-ring rounded"
            >
              <option value="">{t('configModal.addDriver')}</option>
              {available.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  )
}
