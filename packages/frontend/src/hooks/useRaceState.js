import { useMemo } from 'react'
import { useRace } from '../context/RaceContext'

/**
 * Format milliseconds to time string (MM:SS or HH:MM:SS)
 * @param {number} ms - Time in milliseconds
 * @returns {string} Formatted time string
 */
function formatTime(ms) {
  if (ms == null || ms < 0) return '--:--'

  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

/**
 * Hook that provides helper utilities for race state management.
 * Consumes RaceContext and adds computed properties for state checks,
 * capabilities, time formatting, and session info.
 */
export function useRaceState() {
  const context = useRace()
  const { state, session, elapsed, remaining } = context

  return useMemo(() => {
    // State helpers
    const isIdle = state === 'IDLE'
    const isPending = state === 'PENDING'
    const isRunning = state === 'RUNNING'
    const isPaused = state === 'PAUSED'
    const isResults = state === 'RESULTS'
    const isActive = isRunning || isPaused

    // Capability helpers
    const canStart = isPending
    const canPause = isRunning
    const canResume = isPaused
    const canFinish = isRunning || isPaused
    const canStop = isPending || isRunning || isPaused
    const canDismiss = isResults
    const canStartNew = isIdle

    // Time helpers
    const elapsedFormatted = formatTime(elapsed)
    const remainingFormatted = formatTime(remaining)

    // Progress percentage (0-100) for timed sessions
    let progress = 0
    if (remaining != null && elapsed != null && (elapsed + remaining) > 0) {
      const total = elapsed + remaining
      progress = Math.min(100, Math.max(0, (elapsed / total) * 100))
    }

    // Session helpers
    const sessionType = session?.type
    const sessionName = session?.name
    const isQualifying = sessionType === 'qualifying'
    const isRace = sessionType === 'race'

    return {
      // Spread original context values
      ...context,

      // State helpers
      isIdle,
      isPending,
      isRunning,
      isPaused,
      isResults,
      isActive,

      // Capability helpers
      canStart,
      canPause,
      canResume,
      canFinish,
      canStop,
      canDismiss,
      canStartNew,

      // Time helpers
      elapsed,
      remaining,
      elapsedFormatted,
      remainingFormatted,
      progress,

      // Session helpers
      sessionType,
      sessionName,
      isQualifying,
      isRace
    }
  }, [context, state, session, elapsed, remaining])
}

export default useRaceState
