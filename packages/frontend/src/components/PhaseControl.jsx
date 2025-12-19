import { PlayIcon, PauseIcon, StopIcon, ArrowPathIcon } from '@heroicons/react/24/outline'

export default function PhaseControl({
  phase,
  phaseStatus,
  onStart,
  onResume,
  onPause,
  onStop,
  onReset,
  disabled
}) {
  const isWaiting = phaseStatus === 'waiting'
  const isRunning = phaseStatus === 'running'
  const isPaused = phaseStatus === 'paused'
  const isFinished = phaseStatus === 'finished'

  const phaseLabels = {
    practice: 'Essais',
    qualifying: 'Qualifs',
    race: 'Course'
  }

  const phaseStyles = {
    practice: 'bg-blue-100 text-blue-700 border-blue-300',
    qualifying: 'bg-purple-100 text-purple-700 border-purple-300',
    race: 'bg-green-100 text-green-700 border-green-300'
  }

  return (
    <div className="flex items-center gap-3">
      {/* Phase label */}
      <div className={`px-3 py-1.5 rounded-lg font-semibold text-sm border ${phaseStyles[phase] || 'bg-gray-100 text-gray-700 border-gray-300'}`}>
        {phaseLabels[phase]}
      </div>

      {/* Status badge */}
      <div className="flex items-center gap-2">
        {isRunning && (
          <div className="flex items-center gap-1.5 text-green-600">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs font-medium">En cours</span>
          </div>
        )}
        {isPaused && (
          <div className="flex items-center gap-1.5 text-yellow-600">
            <div className="w-2 h-2 bg-yellow-500 rounded-full" />
            <span className="text-xs font-medium">Pause</span>
          </div>
        )}
        {isFinished && (
          <div className="flex items-center gap-1.5 text-gray-600">
            <div className="w-2 h-2 bg-gray-400 rounded-full" />
            <span className="text-xs font-medium">Terminée</span>
          </div>
        )}
        {isWaiting && (
          <div className="flex items-center gap-1.5 text-gray-400">
            <div className="w-2 h-2 bg-gray-300 rounded-full" />
            <span className="text-xs font-medium">En attente</span>
          </div>
        )}
      </div>

      {/* Control buttons */}
      <div className="flex items-center gap-2 ml-auto">
        {isWaiting && (
          <button
            onClick={onStart}
            disabled={disabled}
            className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all shadow disabled:opacity-50 disabled:cursor-not-allowed"
            title="Démarrer"
          >
            <PlayIcon className="w-5 h-5" />
          </button>
        )}

        {isPaused && (
          <button
            onClick={onResume || onStart}
            disabled={disabled}
            className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all shadow disabled:opacity-50 disabled:cursor-not-allowed"
            title="Reprendre"
          >
            <PlayIcon className="w-5 h-5" />
          </button>
        )}

        {isRunning && (
          <>
            <button
              onClick={onPause}
              className="p-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-all shadow"
              title="Pause"
            >
              <PauseIcon className="w-5 h-5" />
            </button>
            <button
              onClick={onStop}
              className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all shadow"
              title="Terminer cette phase"
            >
              <StopIcon className="w-5 h-5" />
            </button>
          </>
        )}

        {(isFinished || isPaused) && (
          <button
            onClick={onReset}
            className="p-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-all shadow"
            title="Réinitialiser cette phase"
          >
            <ArrowPathIcon className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  )
}
