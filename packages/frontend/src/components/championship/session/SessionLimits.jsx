import { useTranslation } from 'react-i18next'
import { SessionType } from '@racehubos/shared'
import { Input } from '@/components/ui/input'

const FIELD = 'h-7 text-xs border-none shadow-none bg-transparent hover:bg-muted/50 transition-colors'

function Limit({ label, ...input }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-1 block">{label}</label>
      <Input type="number" className={FIELD} {...input} />
    </div>
  )
}

/**
 * A draft's limits: duration in minutes and laps (0 for none), then the grace period (5 to 300 s)
 * or, in balancing, the slowest lap time kept.
 */
export default function SessionLimits({ session, maxLapTime, onSaveConfig, onMaxLapTimeChange }) {
  const { t } = useTranslation('championships')
  const whole = (e) => parseInt(e.target.value) || 0

  return (
    <div className="grid gap-3 grid-cols-3">
      <Limit
        key={`dur-${session.id}-${session.maxDuration}`}
        label={t('sessionSection.duration')}
        defaultValue={session.maxDuration ? Math.round(session.maxDuration / 60000) : 0}
        onBlur={(e) => onSaveConfig({ maxDuration: whole(e) > 0 ? whole(e) * 60000 : null })}
        min="0"
        placeholder={t('sessionSection.durationPlaceholder')}
      />
      <Limit
        key={`laps-${session.id}-${session.maxLaps}`}
        label={t('sessionSection.maxLaps')}
        defaultValue={session.maxLaps || 0}
        onBlur={(e) => onSaveConfig({ maxLaps: whole(e) > 0 ? whole(e) : null })}
        min="0"
        placeholder={t('sessionSection.maxLapsPlaceholder')}
      />
      {session.type === SessionType.BALANCING ? (
        <Limit
          key={`maxlap-${session.id}-${maxLapTime}`}
          label={t('sessionSection.maxLapTime')}
          step="0.1"
          defaultValue={maxLapTime ? (maxLapTime / 1000).toFixed(1) : ''}
          onBlur={(e) => {
            const seconds = parseFloat(e.target.value) || 0
            onMaxLapTimeChange?.(seconds > 0 ? Math.round(seconds * 1000) : null)
          }}
          min="0"
          placeholder={t('sessionSection.maxLapTimePlaceholder')}
        />
      ) : (
        <Limit
          key={`grace-${session.id}-${session.gracePeriod}`}
          label={t('sessionSection.gracePeriod')}
          defaultValue={session.gracePeriod ? Math.round(session.gracePeriod / 1000) : 30}
          onBlur={(e) => onSaveConfig({ gracePeriod: Math.max(5, Math.min(300, whole(e) || 30)) * 1000 })}
          min="5"
          max="300"
        />
      )}
    </div>
  )
}
