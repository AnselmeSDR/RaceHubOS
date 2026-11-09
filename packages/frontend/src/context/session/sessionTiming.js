/** The clock of a session before any heartbeat or load: nothing elapsed, no pause. */
export const EMPTY_TIMING = {
  elapsed: 0,
  remaining: null,
  gracePeriodRemaining: null,
  pauseDuration: null,
  totalPauseDuration: 0,
  pauses: [],
  startedAt: null,
}

const seconds = (ms) => Math.floor(ms / 1000)

/** The pauses of a session, stored as JSON or already read. */
export const parsePauses = (pauses) => (typeof pauses === 'string' ? JSON.parse(pauses) : pauses || [])

/** The time spent in finished pauses, in seconds. */
export const closedPausesSeconds = (pauses) =>
  seconds(pauses.reduce((sum, p) => (p.end ? sum + (p.end - p.start) : sum), 0))

/** The clock of a session as loaded: when it started and its pauses; a session not started has run 0 s. */
export function loadedTiming(timing, session) {
  const pauses = parsePauses(session.pauses)
  const next = {
    ...timing,
    startedAt: session.startedAt || null,
    pauses,
    totalPauseDuration: closedPausesSeconds(pauses),
  }
  if (session.startedAt) return next
  return { ...next, elapsed: 0, remaining: null, gracePeriodRemaining: null }
}

/** The clock as the server's heartbeat gives it, times in seconds; what it leaves out is kept. */
export function heartbeatTiming(timing, data) {
  const next = {
    ...timing,
    pauseDuration: data.pauseDuration ? seconds(data.pauseDuration) : null,
    totalPauseDuration: data.totalPauseDuration ? seconds(data.totalPauseDuration) : 0,
    pauses: data.pauses || [],
  }
  if (data.elapsedTime !== undefined) next.elapsed = seconds(data.elapsedTime)
  if (data.remainingTime !== undefined) next.remaining = seconds(data.remainingTime)
  if (data.gracePeriodRemaining !== undefined) {
    next.gracePeriodRemaining = data.gracePeriodRemaining > 0 ? Math.ceil(data.gracePeriodRemaining / 1000) : null
  }
  if (data.startedAt) next.startedAt = data.startedAt
  return next
}

/** A leaderboard sent by the server, alone or in an object, null when it carries none. */
export function leaderboardIn(data) {
  if (Array.isArray(data)) return data
  return Array.isArray(data?.leaderboard) ? data.leaderboard : null
}
