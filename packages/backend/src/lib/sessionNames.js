import { SessionType } from '@racehubos/shared';

/**
 * Names given to the sessions the server creates on its own. The interface
 * sends its own names, in its language; these are the fallback, in English.
 */
export const DEFAULT_SESSION_NAMES = {
  [SessionType.PRACTICE]: 'Free Practice',
  [SessionType.QUALIF]: 'Qualifying',
  [SessionType.RACE]: 'Race',
  [SessionType.BALANCING]: 'Balancing',
};

/** Name for a session of this type: the one sent by the interface, or the English default. */
export function sessionName(type, names = {}) {
  return names?.[type] || DEFAULT_SESSION_NAMES[type] || DEFAULT_SESSION_NAMES[SessionType.PRACTICE];
}
