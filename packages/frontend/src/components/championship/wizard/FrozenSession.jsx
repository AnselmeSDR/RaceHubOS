import { useTranslation } from 'react-i18next'
import { Lock } from 'lucide-react'
import { SessionStatus } from '@racehubos/shared'
import CarPicture from '@/components/car/CarPicture'
import DriverAvatar from '@/components/driver/DriverAvatar'
import { resultOf } from './wizardPlan'

/** A driver who left the championship after racing: DNF in a session they were entered in. */
export function WithdrawnToken({ driver }) {
  const { t } = useTranslation('championships')
  return (
    <div
      data-testid="wizard-withdrawn"
      className="flex items-center gap-1.5 min-w-0 rounded-md border border-border bg-muted/40 px-1.5 py-1 text-xs opacity-70"
    >
      <DriverAvatar driver={driver} label={driver.number} className="size-5 grayscale" />
      <span className="flex-1 min-w-0 truncate line-through">{driver.name}</span>
      <span className="shrink-0 rounded-full bg-destructive/10 px-1.5 text-[10px] font-medium text-destructive">
        {t('wizard.dnfRetired')}
      </span>
    </div>
  )
}

/**
 * A session that has started, as it ran: greyed, locked, its drivers by place. Never a place to drop
 * a driver: `target` (drag-and-drop handlers) only shows the refusal, `refused` while hovered, why
 * in `children`.
 */
export default function FrozenSession({ session, label, withdrawn = [], target, refused, className = '', children }) {
  const { t } = useTranslation('championships')
  const finished = session.status === SessionStatus.FINISHED
  return (
    <div
      data-testid="championship-wizard-frozen"
      {...target}
      className={`rounded-lg border bg-muted/40 p-2 space-y-1 ${
        refused ? 'border-destructive ring-2 ring-destructive/30' : 'border-border'
      } ${className}`}
    >
      <div className="flex items-center gap-1.5 px-1 text-xs">
        <span className="font-semibold text-muted-foreground">{label}</span>
        <Lock aria-label={t('wizard.locked')} className="size-3 text-muted-foreground" />
        <span className="ml-auto rounded-full border border-border bg-background px-1.5 text-[10px] font-medium text-muted-foreground">
          {finished ? t('wizard.sessionFinished') : t('wizard.sessionRunning')}
        </span>
      </div>
      {resultOf(session).map((entry) => (
        <div
          key={entry.id ?? entry.driverId}
          className="flex items-center gap-1.5 min-w-0 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground"
        >
          <span className="w-5 shrink-0 text-[10px] font-bold">{entry.place ? `P${entry.place}` : ''}</span>
          {entry.driver && (
            <DriverAvatar driver={entry.driver} label={entry.driver.number} className="size-5 saturate-50" />
          )}
          <span className="flex-1 min-w-0 truncate">{entry.driver?.name}</span>
          {entry.car?.img && <CarPicture car={entry.car} className="size-5 saturate-50" />}
        </div>
      ))}
      {withdrawn.map((r) => (
        <WithdrawnToken key={r.driverId} driver={r.driver} />
      ))}
      {children}
    </div>
  )
}
