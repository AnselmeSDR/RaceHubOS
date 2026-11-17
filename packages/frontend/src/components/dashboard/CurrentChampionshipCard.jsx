import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChampionshipStatus, SessionStatus } from '@racehubos/shared'
import { Button } from '@/components/ui/button'
import { byRunningOrder, sessionLabelOf } from '@/components/championship/session/progress'
import DriverAvatar from '@/components/driver/DriverAvatar'
import PictureLayer from '@/components/picture/PictureLayer'
import { STATUS_DOTS, sessionBadgeClass, trackColor } from '@/lib/colors'
import Panel from './Panel'
import { useApiData } from './useApiData'

const FACES = 6

/** A session of the championship: its label in the colour of its kind, with the status dot of the session tabs. */
function SessionChip({ session, label, large = false }) {
  const { t } = useTranslation('glossary')
  const dot = STATUS_DOTS[session.status]
  return (
    <span
      data-testid="dashboard-session-chip"
      title={`${session.name} · ${t(`sessionStatus.${session.status}`, { defaultValue: session.status })}`}
      className={`inline-flex items-center gap-1 rounded-md px-1.5 font-bold ${large ? 'h-[22px] text-xs' : 'h-[18px] text-[11px]'} ${sessionBadgeClass(session.type)}`}
    >
      {label}
      {dot && <span className={`size-1.5 rounded-full ${dot}`} />}
    </span>
  )
}

/**
 * What is going on: the championship under way (the latest one not finished), its sessions in running
 * order, the next one with its drivers and the way back to it. Without one, the last finished
 * championship and the way to a new one.
 */
export default function CurrentChampionshipCard() {
  const { t } = useTranslation('dashboard')
  const navigate = useNavigate()
  const championships = useApiData('/championships', null)
  const open = championships?.filter((c) => c.status !== ChampionshipStatus.FINISHED) ?? []
  const picked = open.find((c) => c.status === ChampionshipStatus.ACTIVE) ?? open[0] ?? championships?.[0]
  const championship = useApiData(picked && `/championships/${picked.id}`, null)
  if (!championships) return null

  const current = open.length > 0
  const create = () => navigate('/championships', { state: { create: true } })
  const sessions = [...(championship?.sessions ?? [])].sort(byRunningOrder)
  const done = sessions.filter((session) => session.status === SessionStatus.FINISHED).length
  const next = current && sessions.find((session) => session.status !== SessionStatus.FINISHED)
  const drivers = next?.drivers?.map((entry) => entry.driver).filter(Boolean) ?? []

  return (
    <Panel
      testId="dashboard-championship"
      title={t(current ? 'championship.current' : 'championship.last')}
      to="/championships"
      link={`${t('championship.all')} →`}
    >
      {!championship ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-sm text-muted-foreground">
          {!picked && (
            <>
              {t('championship.none')}
              <Button onClick={create}>{t('championship.create')}</Button>
            </>
          )}
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-3.5 p-4">
          <div className="flex items-center gap-3">
            <PictureLayer
              img={championship.track?.img}
              color={trackColor(championship.track ?? {})}
              className="size-12"
            />
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-lg font-bold leading-tight">{championship.name}</h3>
              <p className="truncate text-xs text-muted-foreground">
                {[
                  championship.track?.name,
                  t('championship.drivers', { count: championship.participants?.length ?? 0 }),
                  t(`championship.mode.${championship.mode}`, { defaultValue: '' }),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
            <p className="whitespace-nowrap text-xs text-muted-foreground">
              <b className="text-xl text-foreground tabular-nums">{done}</b>{' '}
              {t('championship.of', { count: sessions.length })}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {sessions.map((session) => (
              <SessionChip key={session.id} session={session} label={sessionLabelOf(session, sessions, t)} />
            ))}
          </div>
          <div className="mt-auto flex items-end gap-3 border-t border-border pt-3.5">
            <div className="min-w-0 flex-1">
              {next && (
                <>
                  <p className="mb-1.5 text-[11px] text-muted-foreground">{t('championship.next')}</p>
                  <div className="flex items-center gap-2.5 text-[11px] text-muted-foreground">
                    <SessionChip session={next} label={sessionLabelOf(next, sessions, t)} large />
                    <span className="flex items-center">
                      {drivers.slice(0, FACES).map((driver) => (
                        <DriverAvatar
                          key={driver.id}
                          driver={driver}
                          alt={driver.name}
                          className="-ml-1.5 size-6 ring-2 ring-card first:ml-0"
                        />
                      ))}
                    </span>
                    {t('championship.drivers', { count: drivers.length })}
                  </div>
                </>
              )}
            </div>
            {current ? (
              <Button onClick={() => navigate(`/championships/${championship.id}`)}>{t('championship.resume')}</Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => navigate(`/championships/${championship.id}`)}>
                  {t('championship.open')}
                </Button>
                <Button onClick={create}>{t('championship.create')}</Button>
              </>
            )}
          </div>
        </div>
      )}
    </Panel>
  )
}
