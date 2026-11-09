import { SessionStatus, SessionType } from '@racehubos/shared'

const API_URL = import.meta.env.VITE_API_URL || ''
const JSON_HEADERS = { 'Content-Type': 'application/json' }
const STANDING_TYPES = [SessionType.PRACTICE, SessionType.QUALIF, SessionType.RACE]

/** The `data` of a successful answer from `path`, null otherwise (errors logged). */
async function getData(path) {
  try {
    const body = await fetch(`${API_URL}${path}`).then((r) => r.json())
    return body.success ? body.data : null
  } catch (err) {
    console.error(`Failed to load ${path}:`, err)
    return null
  }
}

const sendJson = (path, method, body) =>
  fetch(`${API_URL}${path}`, { method, headers: JSON_HEADERS, body: JSON.stringify(body) })

export const getChampionship = (id) => getData(`/api/championships/${id}`)

export const getChampionshipSessions = (id) => getData(`/api/sessions?championshipId=${id}`)

/** The drivers, cars and tracks, each left undefined when its list can't be read. */
export async function getReferenceData() {
  try {
    const [drivers, cars, tracks] = await Promise.all(
      ['drivers', 'cars', 'tracks'].map((name) => fetch(`${API_URL}/api/${name}`).then((r) => r.json()))
    )
    const ok = (body) => (body.success ? body.data : undefined)
    return { drivers: ok(drivers), cars: ok(cars), tracks: ok(tracks) }
  } catch (err) {
    console.error('Failed to load the drivers, cars and tracks:', err)
    return {}
  }
}

/** The practice, qualifying and race standings of a championship, null when they can't be read. */
export async function getStandings(id) {
  try {
    const bodies = await Promise.all(
      STANDING_TYPES.map((type) =>
        fetch(`${API_URL}/api/championships/${id}/standings?type=${type}`).then((r) => r.json())
      )
    )
    return Object.fromEntries(STANDING_TYPES.map((type, i) => [type, bodies[i].standings || []]))
  } catch (err) {
    console.error('Failed to load the standings:', err)
    return null
  }
}

/** The stored leaderboard of a session that isn't running, empty when it can't be read. */
export async function getSessionLeaderboard(sessionId) {
  return (await getData(`/api/sessions/${sessionId}/leaderboard`)) ?? []
}

/**
 * Saves what changed in a session's configuration: its settings, its status, its drivers.
 * Each part is only sent when `changes` has it.
 */
export async function saveSessionConfig(session, changes) {
  const { name, maxDuration, maxLaps, gracePeriod, status, drivers } = changes
  if ([name, maxDuration, maxLaps, gracePeriod].some((v) => v !== undefined)) {
    await sendJson(`/api/sessions/${session.id}`, 'PUT', { name, maxDuration, maxLaps, gracePeriod })
  }
  if (status !== undefined && status !== session.status) {
    await sendJson(`/api/sessions/${session.id}/status`, 'PATCH', { status })
  }
  if (drivers?.length > 0) {
    await sendJson(`/api/sessions/${session.id}/drivers`, 'PUT', { drivers })
  }
}

export const deleteSession = (sessionId) => fetch(`${API_URL}/api/sessions/${sessionId}`, { method: 'DELETE' })

/** Marks a championship finished; its new state, or null when that failed. */
export async function finishChampionship(id) {
  try {
    const res = await sendJson(`/api/championships/${id}`, 'PUT', { status: SessionStatus.FINISHED })
    return res.ok ? (await res.json()).data : null
  } catch (err) {
    console.error('Error finishing championship:', err)
    return null
  }
}

/** Deletes a championship, which hides its sessions and laps too (cascade). */
export const deleteChampionship = (id) => fetch(`${API_URL}/api/championships/${id}`, { method: 'DELETE' })
