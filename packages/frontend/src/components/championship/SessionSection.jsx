import { useMemo } from 'react'
import {
  Cog6ToothIcon,
  PlayIcon,
  PauseIcon,
  StopIcon,
  ClockIcon,
  ArrowPathIcon,
  FlagIcon,
  BeakerIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'
import { StartLights } from '../ui'
import { useDevice } from '../../context/DeviceContext'
import { useSession } from '../../context/SessionContext'

const SESSION_TYPE_LABELS = {
  practice: 'Essais Libres',
  qualif: 'Qualifications',
  race: 'Course'
}

const SESSION_TYPE_ICONS = {
  practice: BeakerIcon,
  qualif: ClockIcon,
  race: FlagIcon
}

/**
 * SessionSection - Displays session info and controls
 * Shows: Title (Q1 - Qualifications) | Config button
 * Condition: Progress bar with time/laps (animated if active)
 * Config Controllers table (if draft/ready)
 * Status buttons: [Start] if ready, [Pause/Resume] if active, [Stop] to finish
 */
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
  onConfig
}) {
  // Get device state from context
  const { cuStatus, socketConnected, connected: deviceConnected } = useDevice()

  // Get session real-time data from context
  const {
    elapsed: elapsedTime,
    maxLapsCompleted,
    gracePeriodRemaining,
    pauseDuration,
    totalPauseDuration,
    pauses,
    startedAt,
    finishingSession,
  } = useSession()

  const gracePeriodTotal = finishingSession?.gracePeriodMs ? finishingSession.gracePeriodMs / 1000 : 30

  // Build timeline segments from pauses array (alternating active/pause)
  const timelineSegments = useMemo(() => {
    if (!startedAt) return []

    const startTime = new Date(startedAt).getTime()
    // For finished sessions, use finishedAt; otherwise use now
    const endTime = session?.finishedAt ? new Date(session.finishedAt).getTime() : Date.now()
    const segments = []
    let lastEnd = startTime

    // Sort pauses by start time
    const sortedPauses = [...(pauses || [])].sort((a, b) => a.start - b.start)

    for (const pause of sortedPauses) {
      // Active segment before this pause
      if (pause.start > lastEnd) {
        segments.push({ type: 'active', duration: pause.start - lastEnd })
      }
      // Pause segment
      const pauseEnd = pause.end || endTime
      segments.push({ type: 'pause', duration: pauseEnd - pause.start })
      lastEnd = pauseEnd
    }

    // Final active segment (after last pause, if not currently paused)
    const lastPause = sortedPauses[sortedPauses.length - 1]
    const isCurrentlyPaused = lastPause && !lastPause.end
    if (!isCurrentlyPaused) {
      const finalDuration = endTime - lastEnd
      if (finalDuration > 0) {
        segments.push({ type: 'active', duration: finalDuration })
      }
    }

    return segments
  }, [startedAt, pauses, session?.finishedAt])

  // Total wall-clock time for percentage calculation
  const totalWallTime = useMemo(() => {
    return timelineSegments.reduce((sum, seg) => sum + seg.duration, 0)
  }, [timelineSegments])

  // Get session label (EL, Q1, Q2, R1, R2, etc.)
  const sessionLabel = useMemo(() => {
    if (!session) return ''
    if (session.type === 'practice') return 'EL'
    const sameType = sessions.filter(s => s.type === session.type)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    const index = sameType.findIndex(s => s.id === session.id) + 1
    const prefix = session.type === 'qualif' ? 'Q' : 'R'
    return `${prefix}${index}`
  }, [session, sessions])

  // Calculate progress for time (maxDuration is in ms, elapsedTime is in seconds)
  const timeProgress = useMemo(() => {
    if (!session) return null

    // For finished sessions, calculate from timestamps
    let currentElapsed = elapsedTime
    if (session.status === 'finished' && session.startedAt && session.finishedAt) {
      currentElapsed = (new Date(session.finishedAt) - new Date(session.startedAt)) / 1000
    }

    // For active/paused sessions, always show time even without limit
    const isRunning = ['active', 'paused', 'finishing'].includes(session.status)

    // No maxDuration set
    if (!session.maxDuration || session.maxDuration <= 0) {
      // Show counter mode for active sessions or finished with elapsed time
      if ((isRunning && currentElapsed >= 0) || (session.status === 'finished' && currentElapsed > 0)) {
        return {
          type: 'time',
          current: currentElapsed,
          pauseTime: totalPauseDuration,
          total: null,
          remaining: null,
          isComplete: session.status === 'finished'
        }
      }
      return null
    }

    const totalSeconds = session.maxDuration / 1000
    const remaining = Math.max(totalSeconds - currentElapsed, 0)
    return {
      type: 'time',
      current: currentElapsed,
      pauseTime: totalPauseDuration,
      total: totalSeconds,
      remaining,
      isComplete: currentElapsed >= totalSeconds
    }
  }, [session, elapsedTime, totalPauseDuration])

  // Calculate progress for laps
  const lapsProgress = useMemo(() => {
    if (!session) return null

    // For finished sessions, calculate from session.drivers
    let currentLaps = maxLapsCompleted
    if (session.status === 'finished' && session.drivers?.length > 0) {
      currentLaps = Math.max(...session.drivers.map(d => d.totalLaps || 0))
    }

    // For active/paused sessions, always show laps even without limit
    const isRunning = ['active', 'paused', 'finishing'].includes(session.status)

    // No maxLaps set
    if (!session.maxLaps || session.maxLaps <= 0) {
      // Show counter mode for active sessions or finished with laps
      if ((isRunning && currentLaps >= 0) || (session.status === 'finished' && currentLaps > 0)) {
        return {
          type: 'laps',
          percentage: session.status === 'finished' ? 100 : 0,
          current: currentLaps,
          total: null,
          remaining: null,
          isComplete: session.status === 'finished'
        }
      }
      return null
    }

    const percentage = Math.min((currentLaps / session.maxLaps) * 100, 100)
    return {
      type: 'laps',
      percentage,
      current: currentLaps,
      total: session.maxLaps,
      remaining: Math.max(session.maxLaps - currentLaps, 0),
      isComplete: currentLaps >= session.maxLaps
    }
  }, [session, maxLapsCompleted])

  const hasProgress = timeProgress || lapsProgress || (session?.status === 'finishing' && gracePeriodRemaining !== null)

  // Format time as MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // Get session drivers with driver/car info
  const sessionDrivers = useMemo(() => {
    if (!session?.drivers) return []
    return session.drivers.map(sd => ({
      ...sd,
      driver: drivers.find(d => d.id === sd.driverId),
      car: cars.find(c => c.id === sd.carId)
    }))
  }, [session, drivers, cars])

  // Status badge config
  const getStatusConfig = (status) => {
    switch (status) {
      case 'active':
        return { label: 'En cours', color: 'bg-green-100 text-green-700', pulse: true }
      case 'paused':
        return { label: 'En pause', color: 'bg-yellow-100 text-yellow-700', pulse: false }
      case 'finishing':
        return { label: 'Fin de session...', color: 'bg-orange-100 text-orange-700', pulse: true }
      case 'finished':
        return { label: 'Termine', color: 'bg-gray-100 text-gray-700', pulse: false }
      case 'ready':
        return { label: 'Pret', color: 'bg-blue-100 text-blue-700', pulse: false }
      case 'draft':
      default:
        return { label: 'Brouillon', color: 'bg-yellow-100 text-yellow-700', pulse: false }
    }
  }

  if (!session) {
    return (
      <div className="bg-white rounded-xl border p-8 text-center text-gray-500">
        <FlagIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
        Selectionnez une session
      </div>
    )
  }

  const TypeIcon = SESSION_TYPE_ICONS[session.type] || FlagIcon
  const statusConfig = getStatusConfig(session.status)
  const isActive = session.status === 'active'
  const isPaused = session.status === 'paused'
  const isFinishing = session.status === 'finishing'
  const isFinished = session.status === 'finished'
  const canStart = session.status === 'ready' // Session ready, can click "Démarrer"
  const isLights = isActive && cuStatus?.start >= 1 && cuStatus?.start <= 5 // CU in lights mode
  const isRacing = isActive && cuStatus?.start === 0 // CU racing
  const isCuStopped = isActive && cuStatus?.start >= 8 // CU stopped but session still active
  const canPause = isRacing && socketConnected // Can pause when racing
  const canResumeFromPause = isPaused && socketConnected // Can resume from paused state
  const canResumeCu = isCuStopped && socketConnected // Can resume CU if stopped
  const canStop = (isRacing || isPaused) && socketConnected // Can stop (finish) when racing or paused
  const showControllers = session.status === 'draft' || session.status === 'ready'

  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <div className="flex items-center gap-3">
          <TypeIcon className="w-5 h-5 text-gray-500" />
          <h2 className="font-semibold text-gray-900">
            {sessionLabel} - {session.name || SESSION_TYPE_LABELS[session.type]}
          </h2>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.color} ${statusConfig.pulse ? 'animate-pulse' : ''}`}>
            {statusConfig.label}
          </span>
        </div>

        <button
          onClick={() => onConfig(session)}
          className="p-1.5 hover:bg-gray-100 rounded transition-colors"
          title="Configurer la session"
        >
          <Cog6ToothIcon className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      {/* Progress bars (time and/or laps) */}
      {hasProgress && (
        <div className="px-4 py-3 bg-gray-50 border-b space-y-3">
          {/* Time progress */}
          {timeProgress && (
            <div>
              <div className="flex items-center justify-between mb-1 text-sm">
                <span className="flex items-center gap-1 text-gray-600">
                  <ClockIcon className="w-4 h-4" />
                  {formatTime(timeProgress.current)}
                  {timeProgress.pauseTime > 0 && (
                    <span className="text-yellow-600">(+{formatTime(timeProgress.pauseTime)} pause)</span>
                  )}
                  {timeProgress.total && ` / ${formatTime(timeProgress.total)}`}
                  {isFinished && timeProgress.total && timeProgress.current > timeProgress.total && (
                    <span className="text-orange-600 ml-1">(+{formatTime(timeProgress.current - timeProgress.total)})</span>
                  )}
                </span>
                {isActive && timeProgress.total && (
                  <span className={`font-bold ${timeProgress.isComplete ? 'text-red-600' : 'text-gray-900'}`}>
                    {formatTime(timeProgress.remaining)} restant
                  </span>
                )}
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden flex">
                {/* Render alternating segments */}
                {timelineSegments.map((segment, idx) => {
                  const percentage = totalWallTime > 0 ? (segment.duration / totalWallTime) * 100 : 0
                  return (
                    <div
                      key={idx}
                      className={`h-full transition-all duration-300 ${
                        segment.type === 'active' ? 'bg-green-500' : 'bg-yellow-500'
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  )
                })}
              </div>
            </div>
          )}

          {/* Laps progress */}
          {lapsProgress && (
            <div>
              <div className="flex items-center justify-between mb-1 text-sm">
                <span className="flex items-center gap-1 text-gray-600">
                  <ArrowPathIcon className="w-4 h-4" />
                  {lapsProgress.current} {lapsProgress.total ? `/ ${lapsProgress.total}` : ''} tours
                  {isFinished && lapsProgress.total && lapsProgress.current > lapsProgress.total && (
                    <span className="text-orange-600 ml-1">(+{lapsProgress.current - lapsProgress.total})</span>
                  )}
                </span>
                {isActive && lapsProgress.total && (
                  <span className={`font-bold ${lapsProgress.isComplete ? 'text-red-600' : 'text-gray-900'}`}>
                    {lapsProgress.remaining} restants
                  </span>
                )}
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden flex">
                <div
                  className={`h-full transition-all duration-500 ${
                    lapsProgress.isComplete ? 'bg-green-500' : isActive || isPaused ? 'bg-green-500' : 'bg-blue-500'
                  }`}
                  style={{ width: `${Math.min(lapsProgress.percentage, 100)}%` }}
                />
                {isFinished && lapsProgress.total && lapsProgress.current > lapsProgress.total && (
                  <div
                    className="h-full bg-orange-400"
                    style={{ width: `${Math.min(((lapsProgress.current - lapsProgress.total) / lapsProgress.total) * 100, 20)}%` }}
                  />
                )}
              </div>
            </div>
          )}

          {/* Grace period (checkered flag) */}
          {isFinishing && gracePeriodRemaining !== null && (
            <div>
              <div className="flex items-center justify-between mb-1 text-sm">
                <span className="flex items-center gap-1 text-orange-600 font-medium">
                  <FlagIcon className="w-4 h-4" />
                  Drapeau à damier - Finissez votre tour !
                </span>
                <span className="font-bold text-orange-700 animate-pulse">
                  {formatTime(gracePeriodRemaining)}
                </span>
              </div>
              <div className="h-2 bg-orange-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-orange-500 transition-all duration-1000"
                  style={{ width: `${Math.max(0, (gracePeriodRemaining / gracePeriodTotal) * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Controller config table (only in draft/ready) */}
      {showControllers && (
        <div className="p-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 text-xs uppercase">
                <th className="pb-2 font-medium">Ctrl</th>
                <th className="pb-2 font-medium">Pilote</th>
                <th className="pb-2 font-medium">Voiture</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[0, 1, 2, 3, 4, 5].map(controller => {
                const sd = sessionDrivers.find(d => Number(d.controller) === controller)
                const colors = ['bg-red-500', 'bg-blue-500', 'bg-yellow-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500']
                return (
                  <tr key={controller} className="text-gray-700">
                    <td className="py-2">
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-white text-xs font-bold ${colors[controller]}`}>
                        {controller + 1}
                      </span>
                    </td>
                    <td className="py-2">
                      {sd?.driver ? (
                        <span className="flex items-center gap-2">
                          <span
                            className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                            style={{ backgroundColor: sd.driver.color || '#6B7280' }}
                          >
                            {sd.driver.name?.charAt(0) || '?'}
                          </span>
                          {sd.driver.name}
                        </span>
                      ) : (
                        <span className="text-gray-400">---</span>
                      )}
                    </td>
                    <td className="py-2">
                      {sd?.car ? (
                        <span>{sd.car.brand} {sd.car.model}</span>
                      ) : (
                        <span className="text-gray-400">---</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Connection lost warning */}
      {!socketConnected && isActive && (
        <div className="px-4 py-3 bg-red-50 border-t border-red-200 flex items-center gap-2">
          <ExclamationTriangleIcon className="w-5 h-5 text-red-500" />
          <span className="text-red-700 font-medium">Connexion perdue - Reconnexion en cours...</span>
        </div>
      )}

      {/* Action buttons */}
      <div className="px-4 py-3 bg-gray-50 border-t flex items-center justify-between gap-2">
        {/* CU Status indicator */}
        <div className="text-sm text-gray-500">
          {isLights && (
            <span className="flex items-center gap-1.5 px-2 py-1 bg-yellow-100 text-yellow-700 rounded font-medium animate-pulse">
              Feux {cuStatus.start}/5
            </span>
          )}
          {isRacing && (
            <span className="flex items-center gap-1.5 px-2 py-1 bg-green-100 text-green-700 rounded font-medium">
              En course
            </span>
          )}
          {isCuStopped && (
            <span className="flex items-center gap-1.5 px-2 py-1 bg-red-100 text-red-700 rounded font-medium">
              <ExclamationTriangleIcon className="w-4 h-4" />
              CU arrete
            </span>
          )}
          {isPaused && (
            <span className="flex items-center gap-1.5 px-2 py-1 bg-yellow-100 text-yellow-700 rounded font-medium">
              Pause {pauseDuration !== null && formatTime(pauseDuration)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Démarrer - session ready */}
          {canStart && (
            <>
              {!deviceConnected && (
                <span className="text-sm text-orange-600 flex items-center gap-1">
                  <ExclamationTriangleIcon className="w-4 h-4" />
                  Connecter un CU
                </span>
              )}
              <button
                onClick={onStart}
                disabled={!deviceConnected}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  deviceConnected
                    ? 'bg-blue-500 text-white hover:bg-blue-600'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                <PlayIcon className="w-4 h-4" />
                Demarrer
              </button>
            </>
          )}

          {/* Start - CU in lights mode */}
          {isLights && (
            <button
              onClick={onTriggerCuStart}
              className="flex items-center gap-1.5 px-4 py-2 bg-green-500 text-white text-sm font-bold rounded-lg hover:bg-green-600 transition-colors animate-pulse"
            >
              <PlayIcon className="w-4 h-4" />
              START
            </button>
          )}

          {/* Reprendre CU - CU stopped but session still active */}
          {canResumeCu && (
            <button
              onClick={onTriggerCuStart}
              className="flex items-center gap-1.5 px-4 py-2 bg-orange-500 text-white text-sm font-bold rounded-lg hover:bg-orange-600 transition-colors"
            >
              <ArrowPathIcon className="w-4 h-4" />
              Reprendre CU
            </button>
          )}

          {/* Pause - while racing */}
          {canPause && (
            <button
              onClick={onPause}
              className="flex items-center gap-1.5 px-4 py-2 bg-yellow-500 text-yellow-900 text-sm font-medium rounded-lg hover:bg-yellow-400 transition-colors"
            >
              <PauseIcon className="w-4 h-4" />
              Pause
            </button>
          )}

          {/* Reprendre - session paused */}
          {canResumeFromPause && (
            <button
              onClick={onResume}
              className="flex items-center gap-1.5 px-4 py-2 bg-green-500 text-white text-sm font-bold rounded-lg hover:bg-green-600 transition-colors"
            >
              <PlayIcon className="w-4 h-4" />
              Reprendre
            </button>
          )}

          {/* Arrêter (finish) - while racing or paused */}
          {canStop && (
            <button
              onClick={onStop}
              className="flex items-center gap-1.5 px-4 py-2 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 transition-colors"
            >
              <FlagIcon className="w-4 h-4" />
              Terminer
            </button>
          )}

          {isFinishing && (
            <span className="flex items-center gap-1.5 px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-lg">
              <FlagIcon className="w-4 h-4" />
              Attente fin...
            </span>
          )}

          {isFinished && (
            <span className="text-sm text-gray-500">Session terminee</span>
          )}
        </div>
      </div>

      {/* Start lights overlay */}
      {isActive && <StartLights />}
    </div>
  )
}
