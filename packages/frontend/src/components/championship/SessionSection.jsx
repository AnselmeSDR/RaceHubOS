import { useTranslation } from 'react-i18next'
import { AlertTriangle, Flag } from 'lucide-react'
import { SessionStatus, SessionType } from '@racehubos/shared'
import Podium from '@/components/race/Podium'
import { StartLights } from '@/components/ui'
import { useDevice } from '@/context/DeviceContext'
import { useSession } from '@/context/SessionContext'
import SessionHeader from './session/SessionHeader'
import ControllersTable from './session/ControllersTable'
import SessionLimits from './session/SessionLimits'
import AutoDrivers from './session/AutoDrivers'
import SessionProgress from './session/SessionProgress'
import SessionActions from './session/SessionActions'
import { controllerConfigsOf, entriesPayload, incompleteControllersOf } from './session/controllerConfigs'
import { lapsProgressOf, sessionLabelOf, timeProgressOf, timelineSegments } from './session/progress'

/** The free practice of the championship to copy the controllers from, when it has any set. */
function practiceOf(session, sessions) {
  if (session.type === SessionType.PRACTICE || !session.championshipId) return null
  return sessions.find((s) => s.type === SessionType.PRACTICE && s.drivers?.length > 0) ?? null
}

/** What the CU and the session allow now, from the session's status and the CU's start lights. */
function stateOf(session, cuStart, socketConnected) {
  const isActive = session.status === SessionStatus.ACTIVE
  const isPaused = session.status === SessionStatus.PAUSED
  const isLights = isActive && cuStart >= 1 && cuStart <= 5
  const isRacing = isActive && cuStart === 0
  const isCuStopped = isActive && cuStart >= 8
  return {
    isActive,
    isPaused,
    isLights,
    isRacing,
    isCuStopped,
    isFinishing: session.status === SessionStatus.FINISHING,
    isFinished: session.status === SessionStatus.FINISHED,
    canStart: session.status === SessionStatus.DRAFT,
    canPause: isRacing && socketConnected,
    canResumeFromPause: isPaused && socketConnected,
    canResumeCu: isCuStopped && socketConnected,
    canStop: (isRacing || isPaused) && socketConnected,
  }
}

export default function SessionSection({
  session,
  sessions = [],
  drivers = [],
  cars = [],
  onStart,
  onPause,
  onResume,
  onStop,
  onTriggerCuStart,
  onSaveConfig,
  onReset,
  maxLapTime,
  onMaxLapTimeChange,
  autoMode = false,
}) {
  const { t } = useTranslation('championships')
  const { cuStatus, socketConnected, connected: deviceConnected } = useDevice()
  const live = useSession()

  if (!session) {
    return (
      <div className="bg-card rounded-xl border border-border p-8 text-center text-muted-foreground">
        <Flag className="w-12 h-12 mx-auto mb-3 opacity-30" />
        {t('sessionSection.selectSession')}
      </div>
    )
  }

  const state = stateOf(session, cuStatus?.start, socketConnected)
  const canEdit = state.canStart
  const configs = controllerConfigsOf(session.drivers)
  const incomplete = incompleteControllersOf(configs, session.type)
  const practice = practiceOf(session, sessions)
  const entries = (session.drivers ?? []).map((sd) => ({
    ...sd,
    driver: drivers.find((d) => d.id === sd.driverId),
    car: cars.find((c) => c.id === sd.carId),
  }))

  const leaderLaps =
    state.isFinished && entries.length > 0 ? Math.max(...entries.map((d) => d.totalLaps || 0)) : live.maxLapsCompleted
  const time = timeProgressOf(session, live.elapsed, live.totalPauseDuration)
  const laps = lapsProgressOf(session, leaderLaps)
  const graceRemaining = state.isFinishing ? live.gracePeriodRemaining : null
  const hasProgress = !state.isFinished && (time || laps || graceRemaining !== null)

  async function saveEntries(payload, failure) {
    try {
      await onSaveConfig({ drivers: payload })
    } catch (err) {
      console.error(failure, err)
    }
  }

  const changeController = (controller, field, value) =>
    saveEntries(
      entriesPayload({ ...configs, [controller]: { ...configs[controller], [field]: value || null } }),
      'Failed to save controller config:'
    )
  const copyPractice = () =>
    saveEntries(entriesPayload(controllerConfigsOf(practice.drivers)), 'Failed to copy from practice:')
  const reset = onReset ? () => onReset(session.id) : undefined

  return (
    <div data-testid="session-section" className="bg-card rounded-xl border border-border overflow-hidden">
      <SessionHeader
        session={session}
        label={sessionLabelOf(session, sessions, t)}
        canEdit={canEdit}
        onSaveConfig={onSaveConfig}
      />

      {canEdit && (
        <div className="p-4 border-b border-border space-y-3">
          <ControllersTable
            session={session}
            configs={configs}
            drivers={drivers}
            cars={cars}
            incomplete={incomplete}
            onChange={changeController}
            onCopyPractice={practice ? copyPractice : undefined}
          />
          {session.type !== SessionType.PRACTICE && (
            <SessionLimits
              session={session}
              maxLapTime={maxLapTime}
              onSaveConfig={onSaveConfig}
              onMaxLapTimeChange={onMaxLapTimeChange}
            />
          )}
        </div>
      )}

      {autoMode && session.type !== SessionType.PRACTICE && (
        <AutoDrivers session={session} entries={entries} canEdit={canEdit} />
      )}

      {hasProgress && (
        <SessionProgress
          time={time}
          laps={laps}
          segments={timelineSegments({
            startedAt: live.startedAt,
            pauses: live.pauses,
            finishedAt: session.finishedAt,
            now: Date.now(),
          })}
          isActive={state.isActive}
          isPaused={state.isPaused}
          gracePeriodRemaining={graceRemaining}
          gracePeriodMs={live.finishingSession?.gracePeriodMs}
        />
      )}

      {state.isFinished && session.type !== SessionType.BALANCING && entries.length > 0 && (
        <div className="border-b border-border">
          <Podium
            drivers={entries}
            sessionType={session.type}
            stats={{
              duration: time?.current,
              maxDuration: session.maxDuration,
              maxLaps: session.maxLaps,
              gracePeriod: session.gracePeriod,
              gracePeriodUsed: !!session.finishingAt,
            }}
          />
        </div>
      )}

      {!socketConnected && state.isActive && (
        <div className="px-4 py-3 bg-red-500/10 border-t border-red-500/30 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          <span className="text-red-500 font-medium text-sm">{t('sessionSection.connectionLost')}</span>
        </div>
      )}

      <SessionActions
        state={state}
        cuStart={cuStatus?.start}
        pauseDuration={live.pauseDuration}
        canStartNow={deviceConnected && incomplete.length === 0}
        deviceConnected={deviceConnected}
        hasIncompleteConfig={incomplete.length > 0}
        onStart={onStart}
        onTriggerCuStart={onTriggerCuStart}
        onPause={onPause}
        onResume={onResume}
        onStop={onStop}
        onReset={reset}
      />

      {state.isActive && <StartLights onCancel={reset} />}
    </div>
  )
}
