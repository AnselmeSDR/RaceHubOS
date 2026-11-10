import { SessionStatus, SessionType, sessionTypeAbbrKey } from '@racehubos/shared'

const RUNNING = [SessionStatus.ACTIVE, SessionStatus.PAUSED, SessionStatus.FINISHING]
export const isRunning = (session) => RUNNING.includes(session.status)

/** `mm:ss` of a time in seconds. */
export function formatClock(seconds) {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

/**
 * The wall-clock time of a session since its start, as `{ type: 'active' | 'pause', duration }`
 * segments, up to its end or `now`.
 */
export function timelineSegments({ startedAt, pauses, finishedAt, now }) {
  if (!startedAt) return []
  const endTime = finishedAt ? new Date(finishedAt).getTime() : now
  const segments = []
  let lastEnd = new Date(startedAt).getTime()
  const sorted = [...pauses].sort((a, b) => a.start - b.start)
  for (const pause of sorted) {
    if (pause.start > lastEnd) segments.push({ type: 'active', duration: pause.start - lastEnd })
    segments.push({ type: 'pause', duration: (pause.end || endTime) - pause.start })
    lastEnd = pause.end || endTime
  }
  if (!sorted.at(-1) || sorted.at(-1).end) {
    const duration = endTime - lastEnd
    if (duration > 0) segments.push({ type: 'active', duration })
  }
  return segments
}

/**
 * The racing time of a session, in seconds: `elapsed` while it runs, start to finish once
 * finished; with its limit and what is left of it. Null for a draft, or a finished session
 * without a limit and no time.
 */
export function timeProgressOf(session, elapsed, pauseTime) {
  const finished = session.status === SessionStatus.FINISHED
  const current =
    finished && session.startedAt && session.finishedAt
      ? (new Date(session.finishedAt) - new Date(session.startedAt)) / 1000
      : elapsed
  if (!(session.maxDuration > 0)) {
    const shown = (isRunning(session) && current >= 0) || (finished && current > 0)
    return shown ? { current, pauseTime, total: null, remaining: null, isComplete: finished } : null
  }
  const total = session.maxDuration / 1000
  return { current, pauseTime, total, remaining: Math.max(total - current, 0), isComplete: current >= total }
}

/**
 * The leader's laps against the session's count and what is left of it, from the draft on; without
 * a count, the laps so far while it runs. Null otherwise.
 */
export function lapsProgressOf(session, current) {
  if (!(session.maxLaps > 0)) {
    return isRunning(session) ? { percentage: 0, current, total: null, remaining: null, isComplete: false } : null
  }
  return {
    percentage: Math.min((current / session.maxLaps) * 100, 100),
    current,
    total: session.maxLaps,
    remaining: Math.max(session.maxLaps - current, 0),
    isComplete: current >= session.maxLaps,
  }
}

/**
 * A session's short label: its type and rank among the championship's sessions of that type
 * (`Q2`), the type alone for free practice or outside a championship, none for balancing.
 */
export function sessionLabelOf(session, sessions, t) {
  if (session.type === SessionType.BALANCING) return ''
  const abbr = t(sessionTypeAbbrKey(session.type))
  if (session.type === SessionType.PRACTICE) return abbr
  const sameType = sessions
    .filter((s) => s.type === session.type)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
  return `${abbr}${sameType.findIndex((s) => s.id === session.id) + 1 || ''}`
}
