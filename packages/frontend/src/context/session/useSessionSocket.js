import { useServerSocket } from '@/hooks/useServerSocket'

// Server events the pages listen to as window events, after the context has handled them
export const FORWARDED_EVENTS = [
  'session:status_changed',
  'session:finished',
  'championship:standings_changed',
  'championship:races_assigned',
]

export const SESSION_EVENTS = [
  'session:leaderboard',
  'race:session',
  'session:status_changed',
  'session:finishing',
  'session:finished',
  'positions:updated',
  'session:heartbeat',
  'session:bestlap',
  'championship:standings_changed',
  'championship:races_assigned',
]

/** One socket for the app's lifetime; each event goes to `handlers[event]`, as they are at that moment. */
export function useSessionSocket(handlers) {
  useServerSocket(SESSION_EVENTS, (event, data) => {
    handlers[event]?.(data)
    if (FORWARDED_EVENTS.includes(event)) window.dispatchEvent(new CustomEvent(event, { detail: data }))
  })
}
