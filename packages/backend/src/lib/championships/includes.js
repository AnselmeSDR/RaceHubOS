const active = { where: { deletedAt: null } };
const entries = { drivers: { ...active, include: { driver: true, car: true } } };
const participants = { ...active, include: { driver: true }, orderBy: { order: 'asc' } };

/** A championship as its page shows it: track, participants, sessions with entries and laps. */
export const DETAIL_INCLUDE = {
  track: true,
  participants,
  sessions: {
    ...active,
    include: { track: true, ...entries, laps: { ...active, orderBy: { timestamp: 'asc' } } },
    orderBy: { createdAt: 'asc' },
  },
};

/** A championship as returned after creating it or changing its participants. */
export const SAVED_INCLUDE = {
  participants,
  sessions: { ...active, include: entries, orderBy: { order: 'asc' } },
};

/** The championships list: track and the sessions' type and status. */
export const LIST_INCLUDE = {
  track: true,
  sessions: { ...active, select: { id: true, type: true, status: true } },
};
