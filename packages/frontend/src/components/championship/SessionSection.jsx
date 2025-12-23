import { useMemo } from 'react'
import {
  Cog6ToothIcon,
  PlayIcon,
  StopIcon,
  ClockIcon,
  ArrowPathIcon,
  FlagIcon,
  BeakerIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'

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
 * Status buttons: [Start] if ready, [Stop] if active, etc.
 */
export default function SessionSection({
  session,
  sessions = [],
  drivers = [],
  cars = [],
  elapsedTime = 0,
  maxLapsCompleted = 0,
  cuStatus = { start: 8 },
  socketConnected = true,
  onStatusChange,
  onTriggerCuStart,
  onConfig
}) {
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

  // Calculate progress for time
  const timeProgress = useMemo(() => {
    if (!session || !session.duration || session.duration <= 0) return null
    const totalSeconds = session.duration * 60
    const percentage = Math.min((elapsedTime / totalSeconds) * 100, 100)
    const remaining = Math.max(totalSeconds - elapsedTime, 0)
    return {
      type: 'time',
      percentage,
      current: elapsedTime,
      total: totalSeconds,
      remaining,
      isComplete: elapsedTime >= totalSeconds
    }
  }, [session, elapsedTime])

  // Calculate progress for laps
  const lapsProgress = useMemo(() => {
    if (!session || !session.maxLaps || session.maxLaps <= 0) return null
    const percentage = Math.min((maxLapsCompleted / session.maxLaps) * 100, 100)
    return {
      type: 'laps',
      percentage,
      current: maxLapsCompleted,
      total: session.maxLaps,
      remaining: Math.max(session.maxLaps - maxLapsCompleted, 0),
      isComplete: maxLapsCompleted >= session.maxLaps
    }
  }, [session, maxLapsCompleted])

  const hasProgress = timeProgress || lapsProgress

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
  const isFinishing = session.status === 'finishing'
  const isFinished = session.status === 'finished'
  const canStart = session.status === 'ready' // Session ready, can click "Démarrer"
  const isLights = isActive && cuStatus?.start >= 1 && cuStatus?.start <= 5 // CU in lights mode
  const isRacing = isActive && cuStatus?.start === 0 // CU racing
  const isStopped = isActive && cuStatus?.start >= 8 // CU stopped but session still active
  const canStop = isRacing // Can only stop when racing
  const canResume = isStopped && socketConnected // Can resume if stopped and connected
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
                  {isActive ? formatTime(timeProgress.remaining) : `${session.duration} min`}
                </span>
                {isActive && (
                  <span className={`font-bold ${timeProgress.isComplete ? 'text-red-600' : 'text-gray-900'}`}>
                    {formatTime(elapsedTime)}
                  </span>
                )}
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    timeProgress.isComplete ? 'bg-red-500' : isActive ? 'bg-green-500' : 'bg-blue-500'
                  }`}
                  style={{ width: `${timeProgress.percentage}%` }}
                />
              </div>
            </div>
          )}

          {/* Laps progress */}
          {lapsProgress && (
            <div>
              <div className="flex items-center justify-between mb-1 text-sm">
                <span className="flex items-center gap-1 text-gray-600">
                  <ArrowPathIcon className="w-4 h-4" />
                  {lapsProgress.current} / {lapsProgress.total} tours
                </span>
                {isActive && (
                  <span className={`font-bold ${lapsProgress.isComplete ? 'text-red-600' : 'text-gray-900'}`}>
                    {lapsProgress.current} tours
                  </span>
                )}
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    lapsProgress.isComplete ? 'bg-red-500' : isActive ? 'bg-green-500' : 'bg-blue-500'
                  }`}
                  style={{ width: `${lapsProgress.percentage}%` }}
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
              {[1, 2, 3, 4, 5, 6].map(controller => {
                const sd = sessionDrivers.find(d => d.controller === String(controller))
                return (
                  <tr key={controller} className="text-gray-700">
                    <td className="py-2">
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-white text-xs font-bold ${
                        controller === 1 ? 'bg-red-500' :
                        controller === 2 ? 'bg-blue-500' :
                        controller === 3 ? 'bg-yellow-500' :
                        controller === 4 ? 'bg-green-500' :
                        controller === 5 ? 'bg-purple-500' :
                        'bg-orange-500'
                      }`}>
                        {controller}
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
          {isStopped && (
            <span className="flex items-center gap-1.5 px-2 py-1 bg-red-100 text-red-700 rounded font-medium">
              <ExclamationTriangleIcon className="w-4 h-4" />
              Arrete
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Démarrer - session ready */}
          {canStart && (
            <button
              onClick={() => onStatusChange('start')}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition-colors"
            >
              <PlayIcon className="w-4 h-4" />
              Demarrer
            </button>
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

          {/* Reprendre - CU stopped but session active */}
          {canResume && (
            <button
              onClick={onTriggerCuStart}
              className="flex items-center gap-1.5 px-4 py-2 bg-orange-500 text-white text-sm font-bold rounded-lg hover:bg-orange-600 transition-colors"
            >
              <ArrowPathIcon className="w-4 h-4" />
              Reprendre
            </button>
          )}

          {/* Arrêter - CU racing */}
          {canStop && (
            <button
              onClick={() => onStatusChange('stop')}
              className="flex items-center gap-1.5 px-4 py-2 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 transition-colors"
            >
              <StopIcon className="w-4 h-4" />
              Arreter
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
    </div>
  )
}
