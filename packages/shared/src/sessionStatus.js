/** Cycle de vie d'une session. Stocké en texte dans Session.status. */
export const SessionStatus = Object.freeze({
  DRAFT: 'draft',
  READY: 'ready',
  ACTIVE: 'active',
  PAUSED: 'paused',
  FINISHING: 'finishing',
  FINISHED: 'finished',
})

export const SESSION_STATUSES = Object.freeze(Object.values(SessionStatus))

/** Une session en cours, quelle que soit sa forme. */
export const RUNNING_SESSION_STATUSES = Object.freeze([
  SessionStatus.ACTIVE,
  SessionStatus.PAUSED,
  SessionStatus.FINISHING,
])

export function isSessionStatus(value) {
  return SESSION_STATUSES.includes(value)
}
