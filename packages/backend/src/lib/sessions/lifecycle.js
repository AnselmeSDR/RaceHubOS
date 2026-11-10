import { SessionStatus } from '@racehubos/shared';

const { DRAFT, ACTIVE, PAUSED, FINISHING, FINISHED } = SessionStatus;

/** The statuses a session can be set to by hand, and where each can go from. */
export const SETTABLE_STATUSES = [DRAFT, ACTIVE, PAUSED, FINISHING, FINISHED];
const TRANSITIONS = {
  [DRAFT]: [ACTIVE],
  [ACTIVE]: [PAUSED, FINISHING, FINISHED],
  [PAUSED]: [ACTIVE, FINISHED],
  [FINISHING]: [FINISHED],
  [FINISHED]: [DRAFT],
};

/** Why `status` can't be set by hand, or null. */
export function statusError(status) {
  if (SETTABLE_STATUSES.includes(status)) return null;
  return `Invalid status. Must be one of: ${SETTABLE_STATUSES.join(', ')}`;
}

/** Why a session can't go from `current` to `next` (a settable status), or null. */
export function transitionError(current, next) {
  return TRANSITIONS[current]?.includes(next) ? null : `Cannot transition from '${current}' to '${next}'`;
}

/**
 * Moves session `id` from `current` to `next` (an allowed transition): starting, pausing, resuming
 * and finishing go through the session service; back to draft clears the times; finishing is stored.
 */
export async function applyTransition(service, id, current, next) {
  if (next === ACTIVE && current === DRAFT) return service.startSession(id);
  if (next === PAUSED) return service.pauseSession();
  if (next === ACTIVE) return service.resumeSession();
  if (next === FINISHED) return service.stopSession();
  const data = { status: next };
  if (next === DRAFT) Object.assign(data, { startedAt: null, finishingAt: null, finishedAt: null });
  return service.prisma.session.update({ where: { id }, data });
}

/** The session actions, the statuses each starts from, and what each says. */
export const ACTIONS = {
  start: {
    from: [DRAFT],
    run: (service, id) => service.startSession(id),
    refusal: (status) => `Session must be 'draft' to start, current: ${status}`,
    message: 'Session started',
  },
  pause: {
    from: [ACTIVE],
    run: (service) => service.pauseSession(),
    refusal: (status) => `Session must be 'active' to pause, current: ${status}`,
    message: 'Session paused',
  },
  resume: {
    from: [PAUSED],
    run: (service) => service.resumeSession(),
    refusal: (status) => `Session must be 'paused' to resume, current: ${status}`,
    message: 'Session resumed',
  },
  stop: {
    from: [ACTIVE, PAUSED, FINISHING],
    run: (service) => service.stopSession(),
    refusal: (status) => `Session must be active/paused/finishing to stop, current: ${status}`,
    message: 'Session stopped',
  },
};
