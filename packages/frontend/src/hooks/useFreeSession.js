import { useEffect, useEffectEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { STANDARD_SESSION_TYPES, SessionStatus } from '@racehubos/shared'
import { useSession } from '@/context/SessionContext'
import { isLiveStatus } from '@/lib/leaderboardEntries'
import {
  deleteSession,
  driverAssignments,
  saveSessionConfig,
  setSessionDrivers,
  shareFreeSessionDrivers,
} from '@/lib/sessionApi'

/**
 * Opens the free session of a track and type, created when there is none. A new session without drivers
 * takes those of `previousDrivers`, the line-up of the session open before.
 */
async function openFreeSession({ trackId, type, previousDrivers, findOrCreateFreeSession, loadSession }) {
  try {
    const found = await findOrCreateFreeSession({ trackId, type })
    if (!found) return
    if (!found.drivers?.length && previousDrivers.length > 0) {
      await setSessionDrivers(found.id, driverAssignments(previousDrivers))
    }
    await loadSession(found.id)
  } catch (err) {
    console.error('Error loading session:', err)
  }
}

/**
 * The free session of the chosen track and type, opened in the session context, and what the page can do
 * with it. `reloadStandings` is called once results may have changed.
 */
export function useFreeSession({ trackId, type, reloadStandings }) {
  const { t } = useTranslation('freeSession')
  const context = useSession()
  const { session, createSession, loadSession, clearSession } = context
  const [openedKey, setOpenedKey] = useState(null)
  const [busy, setBusy] = useState(false)
  const key = trackId && type ? `${trackId}:${type}` : null

  const open = () =>
    openFreeSession({
      trackId,
      type,
      previousDrivers: session?.drivers || [],
      findOrCreateFreeSession: context.findOrCreateFreeSession,
      loadSession,
    })

  const openSelected = useEffectEvent(open)
  useEffect(() => {
    if (!key) return
    openSelected().then(() => setOpenedKey(key))
  }, [key])

  // A new draft of the same type, with the settings and line-up of the current session
  async function newSession() {
    if (!trackId || !type) return
    setBusy(true)
    try {
      const result = await createSession({
        trackId,
        type,
        name: t(`glossary:sessionTypeFull.${type}`),
        status: SessionStatus.DRAFT,
        maxDuration: session?.maxDuration || null,
        maxLaps: session?.maxLaps || null,
        gracePeriod: session?.gracePeriod || 30000,
      })
      if (result.success && result.data?.id && session?.drivers?.length > 0) {
        await setSessionDrivers(result.data.id, driverAssignments(session.drivers))
        await loadSession(result.data.id)
      }
    } catch (err) {
      console.error('Error creating session:', err)
    } finally {
      setBusy(false)
    }
  }

  // Runs a session context action on the open session
  const control = (action) => async () => {
    if (session?.id) await action(session.id)
  }

  async function stop() {
    if (!session?.id) return
    await context.stopSession(session.id)
    await reloadStandings()
  }

  // The line-up is shared with the other free sessions of the track; balancing keeps its cars to itself
  async function saveConfig(changes) {
    if (!session?.id) return
    try {
      await saveSessionConfig(session, changes)
      if (changes.drivers?.length > 0 && STANDARD_SESSION_TYPES.includes(type)) {
        await shareFreeSessionDrivers(trackId, type, changes.drivers)
      }
      await loadSession(session.id)
    } catch (err) {
      console.error('Error saving session config:', err)
    }
  }

  // The deleted session is replaced by the free session of the same track and type
  async function remove(sessionId) {
    try {
      await deleteSession(sessionId)
      clearSession()
      setBusy(true)
      await open()
    } catch (err) {
      console.error('Error deleting session:', err)
    } finally {
      setBusy(false)
    }
  }

  async function reset(sessionId) {
    const result = await context.resetSession(sessionId)
    if (result.success) await reloadStandings()
  }

  return {
    loading: busy || (key !== null && openedKey !== key),
    // A running session of the chosen type can't be replaced by a new one
    running: Boolean(session && isLiveStatus(session.status) && session.type === type),
    newSession,
    start: control(context.startSession),
    pause: control(context.pauseSession),
    resume: control(context.resumeSession),
    stop,
    saveConfig,
    remove,
    reset,
  }
}
