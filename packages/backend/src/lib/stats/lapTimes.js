import { withImageUrl } from '../../utils/imageUrl.js';

const NO_CHAMPIONSHIP = 'none';

const oneOrMany = (value) => (value.includes(',') ? { in: value.split(',') } : value);

/** The session filter for `championshipId`: ids, and/or 'none' for laps outside any championship. */
function championshipFilter(championshipId) {
  const requested = championshipId.split(',');
  const ids = requested.filter((id) => id !== NO_CHAMPIONSHIP);
  if (!requested.includes(NO_CHAMPIONSHIP)) return { championshipId: ids.length > 1 ? { in: ids } : ids[0] };
  if (ids.length) return { OR: [{ championshipId: { in: ids } }, { championshipId: null }] };
  return { championshipId: null };
}

/** The laps asked: deleted ones or not, by driver, car, track, session type and championship. */
export function lapTimesWhere(query) {
  const { driverId, carId, trackId, sessionType, championshipId } = query;
  const where = query.deleted === 'true' ? { deletedAt: { not: null } } : { deletedAt: null };
  if (driverId) where.driverId = oneOrMany(driverId);
  if (carId) where.carId = oneOrMany(carId);

  const session = {
    ...(trackId && { trackId: oneOrMany(trackId) }),
    ...(sessionType && { type: oneOrMany(sessionType) }),
    ...(championshipId && championshipFilter(championshipId)),
    ...(query.has_championship === 'true' && { championshipId: { not: null } }),
  };
  if (Object.keys(session).length > 0) where.session = session;
  return where;
}

/** Per sort key: the database order, and the same order between two laps already read. */
const SORTS = {
  lapTime: { orderBy: (dir) => ({ lapTime: dir }), compare: (a, b) => a.lapTime - b.lapTime },
  timestamp: {
    orderBy: (dir) => ({ timestamp: dir }),
    compare: (a, b) => new Date(a.timestamp) - new Date(b.timestamp),
  },
  driver: {
    orderBy: (dir) => ({ driver: { name: dir } }),
    compare: (a, b) => (a.driver?.name || '').localeCompare(b.driver?.name || ''),
  },
  car: {
    orderBy: (dir) => ({ car: { brand: dir } }),
    compare: (a, b) => `${a.car?.brand} ${a.car?.model}`.localeCompare(`${b.car?.brand} ${b.car?.model}`),
  },
  track: {
    orderBy: (dir) => ({ session: { track: { name: dir } } }),
    compare: (a, b) => (a.session.track?.name || '').localeCompare(b.session.track?.name || ''),
  },
  sessionType: {
    orderBy: (dir) => ({ session: { type: dir } }),
    compare: (a, b) => (a.session.type || '').localeCompare(b.session.type || ''),
  },
  championship: {
    orderBy: (dir) => ({ session: { championship: { name: dir } } }),
    compare: (a, b) => (a.session.championship?.name || '').localeCompare(b.session.championship?.name || ''),
  },
  date: {
    orderBy: (dir) => ({ session: { createdAt: dir } }),
    compare: (a, b) => new Date(a.session.createdAt) - new Date(b.session.createdAt),
  },
};

/** The database order for `sortBy` (fastest first for an unknown key). */
export const lapOrderBy = (sortBy, sortOrder) => SORTS[sortBy]?.orderBy(sortOrder) ?? { lapTime: 'asc' };

/** Each driver, car and track's best lap of `laps`, in the `sortBy` order (by lap time for an unknown key). */
export function bestLapsOf(laps, sortBy, sortOrder) {
  const best = new Map();
  for (const lap of laps) {
    const key = `${lap.driverId}-${lap.carId}-${lap.session.track?.id}`;
    if (!best.has(key) || lap.lapTime < best.get(key).lapTime) best.set(key, lap);
  }
  const compare = (SORTS[sortBy] ?? SORTS.lapTime).compare;
  const dir = sortOrder === 'asc' ? 1 : -1;
  return [...best.values()].sort((a, b) => dir * compare(a, b));
}

export const LAP_INCLUDE = {
  driver: { select: { id: true, name: true, color: true, img: true, number: true } },
  car: { select: { id: true, brand: true, model: true, color: true, img: true } },
  session: {
    select: {
      id: true,
      type: true,
      createdAt: true,
      track: { select: { id: true, name: true, color: true, img: true } },
      championship: { select: { id: true, name: true } },
    },
  },
};

/** A lap as the lap times table shows it (read with `LAP_INCLUDE`). */
export const lapRow = (lap) => ({
  id: lap.id,
  lapTime: lap.lapTime,
  timestamp: lap.timestamp,
  sessionType: lap.session.type,
  driver: withImageUrl(lap.driver),
  car: withImageUrl(lap.car),
  track: withImageUrl(lap.session.track),
  championship: lap.session.championship,
  sessionId: lap.session.id,
  sessionDate: lap.session.createdAt,
});
