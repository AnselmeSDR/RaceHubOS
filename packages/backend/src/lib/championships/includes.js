import { DIVISIONS_INCLUDE, PEOPLE_INCLUDE } from '../divisions.js';

const active = { where: { deletedAt: null } };
const entries = { drivers: { ...active, include: PEOPLE_INCLUDE } };
const participants = { ...active, include: { driver: PEOPLE_INCLUDE.driver }, orderBy: { order: 'asc' } };

/**
 * A championship as its page shows it: track, divisions, participants, sessions with entries and laps.
 * Divisions come as links: `plainDivisions` before sending.
 */
export const DETAIL_INCLUDE = {
  track: true,
  divisions: DIVISIONS_INCLUDE,
  participants,
  sessions: {
    ...active,
    include: { track: true, ...entries, laps: { ...active, orderBy: { timestamp: 'asc' } } },
    orderBy: { createdAt: 'asc' },
  },
};

/** A championship as returned after creating it or changing its participants. */
export const SAVED_INCLUDE = {
  divisions: DIVISIONS_INCLUDE,
  participants,
  sessions: { ...active, include: entries, orderBy: { order: 'asc' } },
};

/** The championships list: track and the sessions' type and status. */
export const LIST_INCLUDE = {
  track: true,
  sessions: { ...active, select: { id: true, type: true, status: true } },
};
