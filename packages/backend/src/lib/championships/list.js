import { SessionType } from '@racehubos/shared';

/** The list filter: deleted ones or not, and the tracks and statuses asked (comma-separated). */
export function listWhere({ deleted, trackId, status }) {
  const where = deleted === 'true' ? { deletedAt: { not: null } } : { deletedAt: null };
  const oneOrMany = (value) => (value.includes(',') ? { in: value.split(',') } : value);
  if (trackId) where.trackId = oneOrMany(trackId);
  if (status) where.status = oneOrMany(status);
  return where;
}

const countOf = (type) => (championship) => championship.sessions?.filter((s) => s.type === type).length || 0;

/** Sorts the database can't do: by track name, qualif count or race count. */
const COMPUTED_SORTS = {
  track: (a, b) => (a.track?.name || '').localeCompare(b.track?.name || ''),
  qualifs: (a, b) => countOf(SessionType.QUALIF)(a) - countOf(SessionType.QUALIF)(b),
  races: (a, b) => countOf(SessionType.RACE)(a) - countOf(SessionType.RACE)(b),
};

/** Whether `sortBy` is computed here rather than by the database. */
export const isComputedSort = (sortBy) => Object.hasOwn(COMPUTED_SORTS, sortBy);

/** The championships in a computed order (`sortOrder` 'asc', else descending). */
export function sortComputed(championships, sortBy, sortOrder) {
  const dir = sortOrder === 'asc' ? 1 : -1;
  return [...championships].sort((a, b) => dir * COMPUTED_SORTS[sortBy](a, b));
}
