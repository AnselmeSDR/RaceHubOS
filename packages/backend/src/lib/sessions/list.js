const NO_CHAMPIONSHIP = 'null';
const ALL_STATUSES = 'all';

const oneOrMany = (value) => (value.includes(',') ? { in: value.split(',') } : value);

/** The championship filter: ids, and/or 'null' for free sessions. */
function championshipFilter(championshipId) {
  const requested = championshipId.split(',');
  const ids = requested.filter((id) => id !== NO_CHAMPIONSHIP);
  if (!requested.includes(NO_CHAMPIONSHIP)) return { championshipId: ids.length > 1 ? { in: ids } : ids[0] };
  if (ids.length) return { OR: [{ championshipId: null }, { championshipId: { in: ids } }] };
  return { championshipId: null };
}

/** The sessions asked: deleted ones or not, by status, track, type and championship. */
export function listWhere({ status, trackId, type, deleted, championshipId, has_championship }) {
  return {
    deletedAt: deleted === 'true' ? { not: null } : null,
    ...(status && status !== ALL_STATUSES && { status: oneOrMany(status) }),
    ...(trackId && { trackId: oneOrMany(trackId) }),
    ...(type && { type: oneOrMany(type) }),
    ...(has_championship === 'true' && { championshipId: { not: null } }),
    ...(championshipId && championshipFilter(championshipId)),
  };
}

const durationOf = (s) => (s.startedAt && s.finishedAt ? new Date(s.finishedAt) - new Date(s.startedAt) : 0);

/** Sorts the database can't do: by track or championship name, entry count, lap count, duration. */
const COMPUTED_SORTS = {
  track: (a, b) => a.track.name.localeCompare(b.track.name),
  championship: (a, b) => (a.championship?.name || '').localeCompare(b.championship?.name || ''),
  drivers: (a, b) => a.drivers.length - b.drivers.length,
  laps: (a, b) => a._count.laps - b._count.laps,
  duration: (a, b) => durationOf(a) - durationOf(b),
};

/** The field `sortBy` names ('date' is the creation date). */
export const sortField = (sortBy) => (sortBy === 'date' ? 'createdAt' : sortBy);

/** Whether `field` is sorted here rather than by the database. */
export const isComputedSort = (field) => Object.hasOwn(COMPUTED_SORTS, field);

/** The sessions in a computed order (`sortOrder` 'asc', else descending). */
export function sortComputed(sessions, field, sortOrder) {
  const dir = sortOrder === 'asc' ? 1 : -1;
  return [...sessions].sort((a, b) => dir * COMPUTED_SORTS[field](a, b));
}

export const LIST_INCLUDE = {
  track: true,
  championship: true,
  drivers: { where: { deletedAt: null }, include: { driver: true, car: true } },
  _count: { select: { laps: { where: { deletedAt: null } } } },
};
