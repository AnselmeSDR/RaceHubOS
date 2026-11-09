import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { UserPlus, Users, X } from 'lucide-react'
import { ChampionshipStatus, SessionStatus, SessionType } from '@racehubos/shared'
import { setChampionshipParticipants } from './championshipConfigApi'

const API_URL = import.meta.env.VITE_API_URL || ''

// The drivers of an automatic championship; none can leave once a qualifying session has started
export default function ChampionshipParticipantsPanel({ championship, sessions, drivers, onChanged, onError }) {
  const { t } = useTranslation('championships')
  const participants = useMemo(() => championship.participants || [], [championship.participants])
  const finished = championship.status === ChampionshipStatus.FINISHED
  const qualifStarted = sessions.some((s) => s.type === SessionType.QUALIF && s.status !== SessionStatus.DRAFT)
  const available = useMemo(() => {
    const ids = new Set(participants.map((p) => p.driverId))
    return drivers.filter((d) => !ids.has(d.id))
  }, [drivers, participants])

  async function save(driverIds) {
    try {
      await setChampionshipParticipants(championship.id, driverIds, t('configModal.genericError'))
      onChanged?.()
    } catch (err) {
      onError(err.message)
    }
  }

  const ids = participants.map((p) => p.driverId)

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
            {!qualifStarted && !finished && (
              <button
                aria-label={t('common:delete')}
                onClick={() => save(ids.filter((id) => id !== p.driverId))}
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
              onChange={(e) => e.target.value && save([...ids, e.target.value])}
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
