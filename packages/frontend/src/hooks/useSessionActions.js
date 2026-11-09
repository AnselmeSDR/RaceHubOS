import { useSession } from '@/context/SessionContext'
import { deleteSession, saveSessionConfig } from '@/lib/championshipApi'

/**
 * What the session panel of a championship can do to its sessions, each reloading the sessions (and the
 * standings when results change) once done. `detail` is what `useChampionshipDetail` returns.
 */
export function useSessionActions({ selectedSession, selectSession, reloadSessions, reloadStandings }) {
  const { loadSession, startSession, pauseSession, resumeSession, stopSession, resetSession } = useSession()

  // A session context action on the selected session
  const control = (action, { standings = false } = {}) =>
    async function () {
      if (!selectedSession) return
      const r = await action(selectedSession.id)
      if (!r.success) return
      reloadSessions()
      if (standings) reloadStandings()
    }

  async function saveConfig(changes) {
    if (!selectedSession) return
    try {
      await saveSessionConfig(selectedSession, changes)
      reloadSessions()
      await loadSession(selectedSession.id)
    } catch (err) {
      console.error('Failed to save the session:', err)
    }
  }

  async function remove(sessionId) {
    try {
      await deleteSession(sessionId)
      reloadSessions()
      reloadStandings()
      if (selectedSession?.id === sessionId) selectSession(null)
    } catch (err) {
      console.error('Failed to delete the session:', err)
    }
  }

  async function reset(sessionId) {
    const r = await resetSession(sessionId)
    if (!r.success) return
    reloadSessions()
    reloadStandings()
  }

  return {
    start: control(startSession),
    pause: control(pauseSession),
    resume: control(resumeSession),
    stop: control(stopSession, { standings: true }),
    saveConfig,
    remove,
    reset,
  }
}
