import { useState } from 'react'
import { Play, Pause, Flag, X, Wifi, WifiOff, AlertTriangle } from 'lucide-react'
import StateChip from '../race/StateChip'
import Leaderboard from '../race/Leaderboard'
import LapTime from '../race/LapTime'
import ResultsModal from '../race/session/ResultsModal'
import CancelConfirmModal from '../race/session/CancelConfirmModal'
import { StartLights } from '../ui'

/**
 * Format seconds to MM:SS or HH:MM:SS
 */
function formatTime(seconds) {
  if (seconds == null || seconds < 0) return '--:--'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

/**
 * Session - Reusable session component (practice/qualif/race)
 * Pure presentational component - receives all data via props
 */
export default function Session({
  session,
  leaderboard = [],
  elapsed = 0,
  remaining = null,
  cuConnected = false,
  onStart,
  onPause,
  onResume,
  onStop,
  onReset,
  onDismiss,
}) {
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [showResultsModal, setShowResultsModal] = useState(false)

  if (!session) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        Aucune session sélectionnée
      </div>
    )
  }

  const status = session.status
  const isDraft = status === 'draft'
  const isRunning = status === 'active'
  const isPaused = status === 'paused'
  const isFinishing = status === 'finishing'
  const isFinished = status === 'finished'

  const canStart = isDraft && cuConnected
  const canPause = isRunning
  const canResume = isPaused
  const canFinish = isRunning || isPaused || isFinishing

  // Progress for timed sessions
  let progress = 0
  if (remaining != null && elapsed != null && (elapsed + remaining) > 0) {
    const total = elapsed + remaining
    progress = Math.min(100, Math.max(0, (elapsed / total) * 100))
  }

  const sessionTypeLabel = session.type === 'qualif' ? 'Qualifications'
    : session.type === 'race' ? 'Course'
    : 'Essais libres'

  const handleCancel = async () => {
    setShowCancelConfirm(false)
    onStop?.()
  }

  const handleDismiss = async () => {
    setShowResultsModal(false)
    onDismiss?.()
  }

  // Show results modal when finished
  if (isFinished && !showResultsModal) {
    // Auto-show on first render when finished
    setTimeout(() => setShowResultsModal(true), 100)
  }

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Header */}
      <header className="bg-black/50 backdrop-blur-sm border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Left: Session info */}
          <div>
            <h1 className="text-xl font-bold text-white">
              {session.name || sessionTypeLabel}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-gray-400 uppercase tracking-wide">
                {sessionTypeLabel}
              </span>
              <StateChip status={status} />
            </div>
          </div>

          {/* Center: Timer */}
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="text-xs text-gray-500 uppercase">Temps</div>
              <div className="text-3xl font-mono font-bold text-white tabular-nums">
                {formatTime(elapsed)}
              </div>
            </div>
            {remaining !== null && (
              <>
                <div className="w-px h-10 bg-gray-700" />
                <div className="text-center">
                  <div className="text-xs text-gray-500 uppercase">Restant</div>
                  <div className={`text-3xl font-mono font-bold tabular-nums ${
                    remaining < 60 ? 'text-red-500 animate-pulse' : 'text-white'
                  }`}>
                    {formatTime(remaining)}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Right: CU status */}
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
            cuConnected ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'
          }`}>
            {cuConnected ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
            <span className="text-sm font-medium">{cuConnected ? 'CU OK' : 'CU Off'}</span>
          </div>
        </div>

        {/* Progress bar */}
        {remaining !== null && progress > 0 && (
          <div className="mt-4 h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-1000 rounded-full ${
                progress > 90 ? 'bg-red-500' : progress > 70 ? 'bg-yellow-500' : 'bg-green-500'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </header>

      {/* Leaderboard */}
      <main className="flex-1 overflow-auto p-6">
        <Leaderboard leaderboard={leaderboard} />
      </main>

      {/* Controls */}
      <div className="bg-black/80 backdrop-blur-sm border-t border-gray-700 px-6 py-4">
        <div className="flex justify-center gap-4">
          {/* Draft: Start */}
          {isDraft && (
            <>
              {!cuConnected && (
                <span className="flex items-center gap-1.5 text-orange-400 text-sm">
                  <AlertTriangle className="w-5 h-5" />
                  Connecter un CU
                </span>
              )}
              <button
                onClick={onStart}
                disabled={!canStart}
                className="flex items-center gap-2 px-8 py-3 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-lg transition-all"
              >
                <Play className="w-6 h-6" />
                Démarrer
              </button>
            </>
          )}

          {/* Running: Pause or finish */}
          {isRunning && (
            <>
              <button
                onClick={onPause}
                disabled={!canPause}
                className="flex items-center gap-2 px-6 py-3 bg-yellow-500 hover:bg-yellow-400 text-yellow-900 font-bold rounded-xl"
              >
                <Pause className="w-6 h-6" />
                Pause
              </button>
              <button
                onClick={onStop}
                disabled={!canFinish}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl"
              >
                <Flag className="w-6 h-6" />
                Terminer
              </button>
            </>
          )}

          {/* Paused: Resume or finish */}
          {isPaused && (
            <>
              <button
                onClick={onResume}
                disabled={!canResume}
                className="flex items-center gap-2 px-8 py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl"
              >
                <Play className="w-6 h-6" />
                Reprendre
              </button>
              <button
                onClick={onStop}
                disabled={!canFinish}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl"
              >
                <Flag className="w-6 h-6" />
                Terminer
              </button>
            </>
          )}

          {/* Finishing: Just show status */}
          {isFinishing && (
            <div className="text-orange-400 font-bold animate-pulse">
              Dernier tour en cours...
            </div>
          )}

          {/* Finished: View results or new session */}
          {isFinished && !showResultsModal && (
            <button
              onClick={() => setShowResultsModal(true)}
              className="flex items-center gap-2 px-8 py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl"
            >
              Voir Résultats
            </button>
          )}
        </div>
      </div>

      {/* Modals */}
      {showCancelConfirm && (
        <CancelConfirmModal
          onClose={() => setShowCancelConfirm(false)}
          onConfirm={handleCancel}
        />
      )}

      {showResultsModal && isFinished && (
        <ResultsModal
          sessionName={session.name}
          sessionTypeLabel={sessionTypeLabel}
          leaderboard={leaderboard}
          onDismiss={handleDismiss}
        />
      )}

      {/* Start lights overlay */}
      {isRunning && <StartLights onCancel={onReset ? () => onReset(session.id) : undefined} />}
    </div>
  )
}
