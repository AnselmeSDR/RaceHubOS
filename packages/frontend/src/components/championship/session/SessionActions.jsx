import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Flag, Pause, Play, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatClock } from './progress'

const BADGE = 'flex items-center gap-1.5 px-2 py-1 rounded font-medium'
const WARNING = 'text-sm text-orange-600 flex items-center gap-1'

/**
 * The Control Unit's state and what can be done from it: start a draft, advance the lights or
 * resume a stopped CU, pause, resume or finish, and reset a finished session.
 */
export default function SessionActions({
  state,
  cuStart,
  pauseDuration,
  canStartNow,
  deviceConnected,
  hasIncompleteConfig,
  onStart,
  onTriggerCuStart,
  onPause,
  onResume,
  onStop,
  onReset,
}) {
  const { t } = useTranslation('championships')
  const [starting, setStarting] = useState(false)

  async function start() {
    setStarting(true)
    try {
      await onStart()
    } finally {
      setStarting(false)
    }
  }

  return (
    <div className="px-4 py-3 bg-muted/50 border-t border-border flex items-center justify-between gap-2">
      <div className="text-sm">
        {state.isLights && (
          <span className={`${BADGE} bg-yellow-100 text-yellow-700 animate-pulse`}>
            {t('sessionSection.lights', { n: cuStart })}
          </span>
        )}
        {state.isRacing && <span className={`${BADGE} bg-green-100 text-green-700`}>{t('sessionSection.racing')}</span>}
        {state.isCuStopped && (
          <span className={`${BADGE} bg-red-100 text-red-700`}>
            <AlertTriangle className="w-4 h-4" /> {t('sessionSection.cuStopped')}
          </span>
        )}
        {state.isPaused && (
          <span className={`${BADGE} bg-yellow-100 text-yellow-700`}>
            {t('sessionSection.paused', { time: pauseDuration !== null ? formatClock(pauseDuration) : '' })}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {state.canStart && (
          <>
            {!deviceConnected && (
              <span className={WARNING}>
                <AlertTriangle className="w-4 h-4" /> {t('sessionSection.connectCu')}
              </span>
            )}
            {hasIncompleteConfig && (
              <span className={WARNING}>
                <AlertTriangle className="w-4 h-4" /> {t('sessionSection.incompleteConfig')}
              </span>
            )}
            <Button onClick={start} disabled={!canStartNow || starting}>
              {starting ? (
                <>
                  <RefreshCw className="size-4 animate-spin" /> {t('sessionSection.starting')}
                </>
              ) : (
                <>
                  <Play className="size-4" /> {t('sessionSection.start')}
                </>
              )}
            </Button>
          </>
        )}
        {state.isLights && (
          <Button onClick={onTriggerCuStart} className="bg-green-500 hover:bg-green-600 animate-pulse">
            <Play className="size-4" /> {t('race:startLights.start')}
          </Button>
        )}
        {state.canResumeCu && (
          <Button onClick={onTriggerCuStart} className="bg-orange-500 hover:bg-orange-600">
            <RefreshCw className="size-4" /> {t('sessionSection.resumeCu')}
          </Button>
        )}
        {state.canPause && (
          <Button onClick={onPause} variant="outline" className="border-yellow-500 text-yellow-600">
            <Pause className="size-4" /> {t('sessionSection.pauseAction')}
          </Button>
        )}
        {state.canResumeFromPause && (
          <Button onClick={onResume} className="bg-green-500 hover:bg-green-600">
            <Play className="size-4" /> {t('sessionSection.resume')}
          </Button>
        )}
        {state.canStop && (
          <Button onClick={onStop} variant="destructive">
            <Flag className="size-4" /> {t('sessionSection.finish')}
          </Button>
        )}
        {state.isFinishing && (
          <span className="flex items-center gap-1.5 px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-lg whitespace-nowrap flex-shrink-0">
            <Flag className="w-4 h-4" /> {t('sessionSection.waitingSessionEnd')}
          </span>
        )}
        {state.isFinished && onReset && (
          <Button variant="ghost" size="sm" onClick={onReset} className="text-orange-500">
            <RefreshCw className="size-3.5" /> {t('common:reset')}
          </Button>
        )}
      </div>
    </div>
  )
}
