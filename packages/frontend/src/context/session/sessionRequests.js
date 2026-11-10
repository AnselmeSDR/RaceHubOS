import { SessionStatus } from '@racehubos/shared'
import { sessionNames } from '@/lib/sessionNames'

const API_URL = import.meta.env.VITE_API_URL || ''
const JSON_HEADERS = { 'Content-Type': 'application/json' }

// Statuses whose session the server's sync service must hold to time it
const SYNCED_STATUSES = [SessionStatus.DRAFT, SessionStatus.ACTIVE, SessionStatus.PAUSED]

const getJson = (path) => fetch(`${API_URL}${path}`).then((r) => r.json())

const postJson = (path, body) =>
  fetch(`${API_URL}${path}`, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(body) }).then((r) =>
    r.json()
  )

/** The answer `{ success, data | error }` of GET /api/sessions/:id. */
export const getSession = (sessionId) => getJson(`/api/sessions/${sessionId}`)

/** The answer of a lifecycle action: start, pause, resume, stop or reset. */
export const postSessionAction = (sessionId, action) =>
  fetch(`${API_URL}/api/sessions/${sessionId}/${action}`, { method: 'POST' }).then((r) => r.json())

/** The latest free session (no championship) of this type on this track, null when there is none. */
export async function findFreeSession(trackId, type) {
  const params = new URLSearchParams({ trackId, type, championshipId: 'null' })
  const body = await getJson(`/api/sessions?${params}`)
  if (!body.success || !body.data?.length) return null
  return [...body.data].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0]
}

/** A new draft free session, named in the interface language; null when refused. */
export async function createFreeSession(trackId, type) {
  const body = await postJson('/api/sessions', {
    trackId,
    type,
    name: sessionNames()[type],
    status: SessionStatus.DRAFT,
  })
  return body.success ? body.data : null
}

/** The answer of creating a session, in its championship when it has one. */
export function createSession({ championshipId, ...session }) {
  return postJson(championshipId ? `/api/championships/${championshipId}/sessions` : '/api/sessions', session)
}

/** The session to load, as `{ ok, session }` or `{ ok: false, error }` when refused. */
export async function fetchSessionToLoad(sessionId) {
  const response = await fetch(`${API_URL}/api/sessions/${sessionId}`)
  const body = await response.json()
  if (!response.ok || !body.success) return { ok: false, error: body.error }
  return { ok: true, session: body.data }
}

/** Hands a session that can still run to the server's sync service, then reads its leaderboard (null if unreadable). */
export async function prepareSession(session) {
  if (SYNCED_STATUSES.includes(session.status)) {
    await fetch(`${API_URL}/api/sync/load-session/${session.id}`, { method: 'POST' })
  }
  const body = await getJson(`/api/sessions/${session.id}/leaderboard`)
  return body.success && Array.isArray(body.data) ? body.data : null
}
