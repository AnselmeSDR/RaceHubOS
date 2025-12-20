import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  PlayIcon,
  PauseIcon,
  StopIcon,
  FlagIcon,
  ArrowLeftIcon,
  XMarkIcon,
  TrophyIcon,
  SignalIcon,
  SignalSlashIcon
} from '@heroicons/react/24/solid'
import { useRace } from '../context/RaceContext'
import { useRaceState } from '../hooks/useRaceState'
import Leaderboard from '../components/race/Leaderboard'
import StateChip from '../components/race/StateChip'
import LapTime from '../components/race/LapTime'

/**
 * RaceControl - Main race control page during qualifying/race sessions
 * Shows leaderboard, timer, and control buttons based on current state
 */
export default function RaceControl() {
  const navigate = useNavigate()
  const { start, pause, resume, finish, stop, dismiss, cuConnected } = useRace()
  const {
    state,
    session,
    leaderboard,
    isIdle,
    isPending,
    isRunning,
    isPaused,
    isResults,
    canStart,
    canPause,
    canResume,
    canFinish,
    canStop,
    canDismiss,
    elapsedFormatted,
    remainingFormatted,
    progress,
    sessionName,
    sessionType,
    isQualifying,
    isRace,
    remaining
  } = useRaceState()

  const [showResultsModal, setShowResultsModal] = useState(false)
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const [hadActiveSession, setHadActiveSession] = useState(false)

  // Track if we ever had an active session
  useEffect(() => {
    if (isPending || isRunning || isPaused || isResults) {
      setHadActiveSession(true)
    }
  }, [isPending, isRunning, isPaused, isResults])

  // Redirect to practice only after a session was dismissed (not on initial load)
  useEffect(() => {
    if (isIdle && hadActiveSession) {
      navigate('/practice')
    }
  }, [isIdle, hadActiveSession, navigate])

  // Show results modal when state becomes RESULTS
  useEffect(() => {
    if (isResults) {
      setShowResultsModal(true)
    }
  }, [isResults])

  // Session type display label
  const sessionTypeLabel = isQualifying ? 'Qualifying' : isRace ? 'Race' : 'Session'

  // Handle back navigation with confirmation
  const handleBack = () => {
    if (isRunning || isPaused || isPending) {
      setShowExitConfirm(true)
    } else {
      navigate('/practice')
    }
  }

  // Handle session cancel/abort
  const handleCancel = async () => {
    await stop()
    navigate('/practice')
  }

  // Handle finish and show results
  const handleFinish = async () => {
    await finish()
  }

  // Handle dismiss results
  const handleDismiss = async () => {
    setShowResultsModal(false)
    await dismiss()
    navigate('/practice')
  }

  // Get podium entries (top 3)
  const podiumEntries = leaderboard.slice(0, 3)

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Header */}
      <header className="bg-black/50 backdrop-blur-sm border-b border-gray-700 sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Left: Back button + Session info */}
            <div className="flex items-center gap-4">
              <button
                onClick={handleBack}
                className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors"
                title="Back to Practice"
              >
                <ArrowLeftIcon className="h-5 w-5" />
              </button>

              <div className="flex items-center gap-3">
                <div>
                  <h1 className="text-xl lg:text-2xl font-bold text-white tracking-tight">
                    {sessionName || sessionTypeLabel}
                  </h1>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm text-gray-400 uppercase tracking-wide">
                      {sessionTypeLabel}
                    </span>
                    <StateChip state={state} />
                  </div>
                </div>
              </div>
            </div>

            {/* Center: Timer display */}
            <div className="flex items-center justify-center gap-6 lg:gap-8">
              {/* Elapsed time */}
              <div className="text-center">
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                  Elapsed
                </div>
                <div className="text-2xl lg:text-4xl font-mono font-bold text-white tabular-nums tracking-tight">
                  {elapsedFormatted}
                </div>
              </div>

              {/* Separator */}
              <div className="w-px h-12 bg-gray-700" />

              {/* Remaining time (if timed session) */}
              <div className="text-center">
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                  Remaining
                </div>
                <div className={`text-2xl lg:text-4xl font-mono font-bold tabular-nums tracking-tight ${
                  remaining !== null && remaining < 60000 ? 'text-red-500 animate-pulse' : 'text-white'
                }`}>
                  {remaining !== null ? remainingFormatted : '--:--'}
                </div>
              </div>
            </div>

            {/* Right: CU connection status */}
            <div className="flex items-center gap-3">
              <div className={`
                flex items-center gap-2 px-3 py-2 rounded-lg
                ${cuConnected
                  ? 'bg-green-900/50 border border-green-700 text-green-400'
                  : 'bg-red-900/50 border border-red-700 text-red-400'
                }
              `}>
                {cuConnected ? (
                  <SignalIcon className="h-5 w-5" />
                ) : (
                  <SignalSlashIcon className="h-5 w-5" />
                )}
                <span className="text-sm font-medium">
                  {cuConnected ? 'CU Connected' : 'CU Disconnected'}
                </span>
              </div>
            </div>
          </div>

          {/* Progress bar for timed sessions */}
          {remaining !== null && progress > 0 && (
            <div className="mt-4">
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-1000 ease-linear rounded-full ${
                    progress > 90 ? 'bg-red-500' : progress > 70 ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="container mx-auto px-4 py-6">
        {/* Leaderboard */}
        <div className="mb-6">
          <Leaderboard leaderboard={leaderboard} sessionType={sessionType} />
        </div>

        {/* Control buttons - Fixed at bottom on mobile */}
        <div className="fixed bottom-0 left-0 right-0 lg:relative lg:bottom-auto bg-black/90 lg:bg-transparent backdrop-blur-sm lg:backdrop-blur-none border-t border-gray-700 lg:border-0 p-4 lg:p-0">
          <div className="container mx-auto flex justify-center gap-4">
            {/* PENDING state: Start + Cancel */}
            {isPending && (
              <>
                <button
                  onClick={start}
                  disabled={!canStart}
                  className="flex items-center gap-2 px-8 py-4 bg-green-600 hover:bg-green-500 disabled:bg-green-800 disabled:opacity-50 text-white font-bold text-lg rounded-xl shadow-lg shadow-green-600/30 transition-all transform hover:scale-105 disabled:hover:scale-100"
                >
                  <PlayIcon className="h-6 w-6" />
                  Start
                </button>
                <button
                  onClick={handleCancel}
                  disabled={!canStop}
                  className="flex items-center gap-2 px-6 py-4 bg-red-600 hover:bg-red-500 disabled:bg-red-800 disabled:opacity-50 text-white font-bold text-lg rounded-xl shadow-lg shadow-red-600/30 transition-all"
                >
                  <XMarkIcon className="h-6 w-6" />
                  Cancel
                </button>
              </>
            )}

            {/* RUNNING state: Pause + Finish */}
            {isRunning && (
              <>
                <button
                  onClick={pause}
                  disabled={!canPause}
                  className="flex items-center gap-2 px-6 py-4 bg-yellow-500 hover:bg-yellow-400 disabled:bg-yellow-700 disabled:opacity-50 text-yellow-900 font-bold text-lg rounded-xl shadow-lg shadow-yellow-500/30 transition-all"
                >
                  <PauseIcon className="h-6 w-6" />
                  Pause
                </button>
                <button
                  onClick={handleFinish}
                  disabled={!canFinish}
                  className="flex items-center gap-2 px-6 py-4 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:opacity-50 text-white font-bold text-lg rounded-xl shadow-lg shadow-blue-600/30 transition-all"
                >
                  <FlagIcon className="h-6 w-6" />
                  Finish
                </button>
              </>
            )}

            {/* PAUSED state: Resume + Finish */}
            {isPaused && (
              <>
                <button
                  onClick={resume}
                  disabled={!canResume}
                  className="flex items-center gap-2 px-8 py-4 bg-green-600 hover:bg-green-500 disabled:bg-green-800 disabled:opacity-50 text-white font-bold text-lg rounded-xl shadow-lg shadow-green-600/30 transition-all transform hover:scale-105 disabled:hover:scale-100"
                >
                  <PlayIcon className="h-6 w-6" />
                  Resume
                </button>
                <button
                  onClick={handleFinish}
                  disabled={!canFinish}
                  className="flex items-center gap-2 px-6 py-4 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:opacity-50 text-white font-bold text-lg rounded-xl shadow-lg shadow-blue-600/30 transition-all"
                >
                  <FlagIcon className="h-6 w-6" />
                  Finish
                </button>
              </>
            )}

            {/* RESULTS state: Dismiss button */}
            {isResults && !showResultsModal && (
              <button
                onClick={() => setShowResultsModal(true)}
                disabled={!canDismiss}
                className="flex items-center gap-2 px-8 py-4 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800 disabled:opacity-50 text-white font-bold text-lg rounded-xl shadow-lg shadow-purple-600/30 transition-all"
              >
                <TrophyIcon className="h-6 w-6" />
                View Results
              </button>
            )}
          </div>
        </div>

        {/* Spacer for fixed bottom bar on mobile */}
        <div className="h-24 lg:hidden" />
      </main>

      {/* Exit confirmation modal */}
      {showExitConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-2xl max-w-md w-full p-6 border border-gray-700">
            <h2 className="text-xl font-bold text-white mb-4">Leave Session?</h2>
            <p className="text-gray-300 mb-6">
              The session is still active. Are you sure you want to leave? This will abort the current session.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowExitConfirm(false)}
                className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-xl transition-colors"
              >
                Stay
              </button>
              <button
                onClick={handleCancel}
                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-500 text-white font-medium rounded-xl transition-colors"
              >
                Leave & Abort
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Results modal */}
      {showResultsModal && isResults && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl max-w-4xl w-full border border-gray-700 shadow-2xl my-8">
            {/* Modal header */}
            <div className="p-6 border-b border-gray-700 text-center">
              <div className="flex items-center justify-center gap-3 mb-2">
                <TrophyIcon className="h-8 w-8 text-yellow-400" />
                <h2 className="text-2xl lg:text-3xl font-bold text-white">
                  {sessionTypeLabel} Results
                </h2>
              </div>
              <p className="text-gray-400">
                {sessionName || 'Session Complete'}
              </p>
            </div>

            {/* Podium display */}
            {podiumEntries.length > 0 && (
              <div className="p-6 border-b border-gray-700">
                <div className="flex items-end justify-center gap-4 lg:gap-8">
                  {/* 2nd place */}
                  {podiumEntries[1] && (
                    <div className="flex flex-col items-center">
                      <div
                        className="w-16 h-16 lg:w-20 lg:h-20 rounded-full flex items-center justify-center text-white font-bold text-xl ring-4 ring-gray-400 shadow-lg mb-2"
                        style={{
                          background: `linear-gradient(135deg, ${podiumEntries[1].driver?.color || '#6B7280'} 0%, ${podiumEntries[1].driver?.color || '#6B7280'}CC 100%)`
                        }}
                      >
                        {podiumEntries[1].driver?.photo ? (
                          <img
                            src={podiumEntries[1].driver.photo}
                            alt={podiumEntries[1].driver.name}
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                          <span>{(podiumEntries[1].driver?.name || 'D').charAt(0)}</span>
                        )}
                      </div>
                      <div className="bg-gray-400 text-gray-900 w-20 lg:w-24 h-20 lg:h-24 rounded-t-lg flex flex-col items-center justify-center">
                        <span className="text-3xl font-bold">2</span>
                      </div>
                      <div className="text-center mt-2">
                        <div className="font-bold text-white text-sm lg:text-base truncate max-w-[100px]">
                          {podiumEntries[1].driver?.name || 'Driver'}
                        </div>
                        <LapTime time={podiumEntries[1].bestLap} size="sm" />
                      </div>
                    </div>
                  )}

                  {/* 1st place */}
                  {podiumEntries[0] && (
                    <div className="flex flex-col items-center -mt-4">
                      <div
                        className="w-20 h-20 lg:w-24 lg:h-24 rounded-full flex items-center justify-center text-white font-bold text-2xl ring-4 ring-yellow-400 shadow-xl mb-2"
                        style={{
                          background: `linear-gradient(135deg, ${podiumEntries[0].driver?.color || '#6B7280'} 0%, ${podiumEntries[0].driver?.color || '#6B7280'}CC 100%)`
                        }}
                      >
                        {podiumEntries[0].driver?.photo ? (
                          <img
                            src={podiumEntries[0].driver.photo}
                            alt={podiumEntries[0].driver.name}
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                          <span>{(podiumEntries[0].driver?.name || 'D').charAt(0)}</span>
                        )}
                      </div>
                      <div className="bg-yellow-400 text-yellow-900 w-24 lg:w-28 h-28 lg:h-32 rounded-t-lg flex flex-col items-center justify-center">
                        <TrophyIcon className="h-6 w-6 mb-1" />
                        <span className="text-4xl font-bold">1</span>
                      </div>
                      <div className="text-center mt-2">
                        <div className="font-bold text-white text-base lg:text-lg truncate max-w-[120px]">
                          {podiumEntries[0].driver?.name || 'Driver'}
                        </div>
                        <LapTime time={podiumEntries[0].bestLap} size="md" highlight />
                      </div>
                    </div>
                  )}

                  {/* 3rd place */}
                  {podiumEntries[2] && (
                    <div className="flex flex-col items-center">
                      <div
                        className="w-16 h-16 lg:w-20 lg:h-20 rounded-full flex items-center justify-center text-white font-bold text-xl ring-4 ring-orange-400 shadow-lg mb-2"
                        style={{
                          background: `linear-gradient(135deg, ${podiumEntries[2].driver?.color || '#6B7280'} 0%, ${podiumEntries[2].driver?.color || '#6B7280'}CC 100%)`
                        }}
                      >
                        {podiumEntries[2].driver?.photo ? (
                          <img
                            src={podiumEntries[2].driver.photo}
                            alt={podiumEntries[2].driver.name}
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                          <span>{(podiumEntries[2].driver?.name || 'D').charAt(0)}</span>
                        )}
                      </div>
                      <div className="bg-orange-400 text-orange-900 w-20 lg:w-24 h-16 lg:h-20 rounded-t-lg flex flex-col items-center justify-center">
                        <span className="text-3xl font-bold">3</span>
                      </div>
                      <div className="text-center mt-2">
                        <div className="font-bold text-white text-sm lg:text-base truncate max-w-[100px]">
                          {podiumEntries[2].driver?.name || 'Driver'}
                        </div>
                        <LapTime time={podiumEntries[2].bestLap} size="sm" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Full results table */}
            <div className="p-6 max-h-[40vh] overflow-y-auto">
              <h3 className="text-lg font-semibold text-white mb-4">Full Results</h3>
              <div className="bg-gray-900 rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-800 text-gray-400 text-xs uppercase tracking-wide">
                      <th className="px-4 py-3 text-left">Pos</th>
                      <th className="px-4 py-3 text-left">Driver</th>
                      <th className="px-4 py-3 text-center">Laps</th>
                      <th className="px-4 py-3 text-right">Best Lap</th>
                      <th className="px-4 py-3 text-right">Gap</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {leaderboard.map((entry, index) => {
                      const position = entry.position || index + 1
                      const driver = entry.driver || {}
                      const gap = entry.gap
                      const gapDisplay = position === 1
                        ? '--'
                        : gap != null
                          ? `+${(gap / 1000).toFixed(3)}s`
                          : '--'

                      return (
                        <tr
                          key={entry.id || index}
                          className={`
                            ${position <= 3 ? 'bg-gray-800/50' : ''}
                            hover:bg-gray-700/50 transition-colors
                          `}
                        >
                          <td className="px-4 py-3">
                            <span className={`
                              inline-flex items-center justify-center w-8 h-8 rounded-lg font-bold text-sm
                              ${position === 1 ? 'bg-yellow-400 text-yellow-900' : ''}
                              ${position === 2 ? 'bg-gray-400 text-gray-900' : ''}
                              ${position === 3 ? 'bg-orange-400 text-orange-900' : ''}
                              ${position > 3 ? 'bg-gray-700 text-gray-300' : ''}
                            `}>
                              {position}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div
                                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                                style={{
                                  background: `linear-gradient(135deg, ${driver.color || '#6B7280'} 0%, ${driver.color || '#6B7280'}CC 100%)`
                                }}
                              >
                                {driver.photo ? (
                                  <img
                                    src={driver.photo}
                                    alt={driver.name}
                                    className="w-full h-full rounded-full object-cover"
                                  />
                                ) : (
                                  <span>{(driver.name || 'D').charAt(0)}</span>
                                )}
                              </div>
                              <span className="font-medium text-white">
                                {driver.name || 'Unknown'}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center font-mono text-gray-300">
                            {entry.laps ?? entry.lapCount ?? 0}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <LapTime
                              time={entry.bestLap}
                              size="sm"
                              highlight={entry.hasFastestLap}
                            />
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-sm text-gray-400">
                            {gapDisplay}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal footer */}
            <div className="p-6 border-t border-gray-700">
              <button
                onClick={handleDismiss}
                className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-purple-600 hover:bg-purple-500 text-white font-bold text-lg rounded-xl shadow-lg shadow-purple-600/30 transition-all"
              >
                <StopIcon className="h-6 w-6" />
                Save & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
