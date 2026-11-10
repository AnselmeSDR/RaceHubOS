import { STANDARD_SESSION_TYPES, SessionStatus, SessionType } from '@racehubos/shared'

const API_URL = import.meta.env.VITE_API_URL || ''
const JSON_HEADERS = { 'Content-Type': 'application/json' }

/** The `data` of a successful answer from `path`, null otherwise (errors logged). */
export async function getData(path) {
  try {
    const body = await fetch(`${API_URL}${path}`).then((r) => r.json())
    return body.success ? body.data : null
  } catch (err) {
    console.error(`Failed to load ${path}:`, err)
    return null
  }
}

export const sendJson = (path, method, body) =>
  fetch(`${API_URL}${path}`, { method, headers: JSON_HEADERS, body: JSON.stringify(body) })

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

/** The stored leaderboard of a session that isn't running, empty when it can't be read. */
export async function getSessionLeaderboard(sessionId) {
  return (await getData(`/api/sessions/${sessionId}/leaderboard`)) ?? []
}

/** Who drives what on which controller in a session, as its drivers are saved. */
export const driverAssignments = (sessionDrivers) =>
  sessionDrivers.map(({ controller, driverId, carId }) => ({ controller, driverId, carId }))

export const setSessionDrivers = (sessionId, drivers) =>
  sendJson(`/api/sessions/${sessionId}/drivers`, 'PUT', { drivers })

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
  if (drivers?.length > 0) await setSessionDrivers(session.id, drivers)
}

export const deleteSession = (sessionId) => fetch(`${API_URL}/api/sessions/${sessionId}`, { method: 'DELETE' })

/**
 * Gives `drivers` to the latest free session of each other type on the track, when it is still a draft:
 * the free sessions of a track keep the same line-up.
 */
export async function shareFreeSessionDrivers(trackId, type, drivers) {
  for (const other of STANDARD_SESSION_TYPES.filter((t) => t !== type)) {
    const res = await fetch(`${API_URL}/api/sessions?trackId=${trackId}&type=${other}&championshipId=null`)
    const result = await res.json()
    if (!(result.success && result.data?.length > 0)) continue
    const latest = [...result.data].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0]
    if (latest.status === SessionStatus.DRAFT) await setSessionDrivers(latest.id, drivers)
  }
}

/**
 * The best free-session laps of a track by session type, as the standings tabs read them, and its balancing
 * standings; null when unreadable.
 */
export async function getTrackStandings(trackId) {
  try {
    const res = await fetch(`${API_URL}/api/records/track/${trackId}?championshipId=null`)
    const body = await res.json()
    if (!body.success) return null
    const withBestTime = (laps) => (laps || []).map((lap) => ({ ...lap, bestTime: lap.lapTime }))
    return {
      [SessionType.PRACTICE]: withBestTime(body.data.practice),
      [SessionType.QUALIF]: withBestTime(body.data.qualif),
      [SessionType.RACE]: withBestTime(body.data.race).map((lap) => ({
        ...lap,
        totalLaps: lap.totalLaps || lap.laps || 0,
        totalTime: lap.totalTime || null,
      })),
      [SessionType.BALANCING]: body.data.balancing || [],
    }
  } catch (err) {
    console.error('Error fetching standings:', err)
    return null
  }
}
