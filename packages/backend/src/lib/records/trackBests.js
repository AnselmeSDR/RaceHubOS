import { SessionType } from '@racehubos/shared';
import { withImageUrl } from '../../utils/imageUrl.js';

const SESSION_PICK = { select: { id: true, type: true, name: true } };
const pairKey = (row) => `${row.driverId}-${row.carId}`;

/** Median of `times`, null when empty. */
export function medianOf(times) {
  if (times.length === 0) return null;
  const sorted = [...times].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Average of the best 60% of `times`, null below three laps kept. */
export function avg60Of(times) {
  const best = [...times].sort((a, b) => a - b).slice(0, Math.ceil(times.length * 0.6));
  if (best.length < 3) return null;
  return best.reduce((sum, time) => sum + time, 0) / best.length;
}

/**
 * Per driver and car pairing, the totals of its entry with the longest total time — the first one
 * met when none has a time.
 */
export function raceTotals(entries) {
  const totals = new Map();
  for (const entry of entries) {
    const kept = totals.get(pairKey(entry));
    if (!kept || (entry.totalTime && entry.totalTime > kept.totalTime)) {
      totals.set(pairKey(entry), { totalTime: entry.totalTime, totalLaps: entry.totalLaps });
    }
  }
  return totals;
}

/**
 * Per car, the median and best-60% average of `laps` ({ carId, sessionId, lapTime }), overall and
 * for each session in `sessionIds` order.
 */
export function balancingFigures(laps, sessionIds) {
  const byCar = new Map();
  for (const { carId, sessionId, lapTime } of laps) {
    if (!byCar.has(carId)) byCar.set(carId, { times: [], bySession: new Map() });
    const car = byCar.get(carId);
    car.times.push(lapTime);
    if (!car.bySession.has(sessionId)) car.bySession.set(sessionId, []);
    car.bySession.get(sessionId).push(lapTime);
  }

  const figures = new Map();
  for (const [carId, { times, bySession }] of byCar) {
    const history = sessionIds
      .filter((id) => bySession.has(id))
      .map((id) => bySession.get(id))
      .map((sessionTimes) => ({
        median: medianOf(sessionTimes),
        avg60: avg60Of(sessionTimes),
        laps: sessionTimes.length,
      }));
    figures.set(carId, { median: medianOf(times), avg60: avg60Of(times), history });
  }
  return figures;
}

/**
 * The best lap of each driver and car pairing among the `where` laps of `type` sessions, with its
 * lap count — and for races, the totals of the pairing's longest entry in those sessions.
 */
export async function pairingBests(prisma, where, type) {
  const laps = await prisma.lap.findMany({
    where,
    orderBy: { lapTime: 'asc' },
    distinct: ['driverId', 'carId'],
    include: { driver: true, car: true, session: SESSION_PICK },
  });
  const counts = await prisma.lap.groupBy({ by: ['driverId', 'carId'], where, _count: { id: true } });
  const lapCount = new Map(counts.map((row) => [pairKey(row), row._count.id]));
  const totals =
    type === SessionType.RACE
      ? raceTotals(await prisma.sessionDriver.findMany({ where: { sessionId: { in: laps.map((l) => l.sessionId) } } }))
      : new Map();

  return laps.map((lap) => ({
    ...lap,
    driver: withImageUrl(lap.driver),
    car: withImageUrl(lap.car),
    laps: lapCount.get(pairKey(lap)),
    ...totals.get(pairKey(lap)),
  }));
}

/**
 * The best balancing lap of each car among the `where` laps, with its lap count and the median and
 * best-60% average of its laps after the first, overall and per session, oldest first.
 */
export async function balancingBests(prisma, where) {
  const laps = await prisma.lap.findMany({
    where,
    orderBy: { lapTime: 'asc' },
    distinct: ['carId'],
    include: { car: true, driver: true, session: SESSION_PICK },
  });
  const counts = await prisma.lap.groupBy({ by: ['carId'], where, _count: { id: true } });
  const lapCount = new Map(counts.map((row) => [row.carId, row._count.id]));

  // The first lap starts from the grid: left out of the figures
  const timed = await prisma.lap.findMany({
    where: { ...where, lapNumber: { gt: 1 } },
    select: { carId: true, sessionId: true, lapTime: true },
  });
  const sessions = await prisma.session.findMany({
    where: { id: { in: timed.map((l) => l.sessionId) } },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });
  const figures = balancingFigures(
    timed,
    sessions.map((s) => s.id)
  );

  return laps.map((lap) => {
    const { median = null, avg60 = null, history = [] } = figures.get(lap.carId) ?? {};
    return {
      ...lap,
      car: withImageUrl(lap.car),
      driver: withImageUrl(lap.driver),
      laps: lapCount.get(lap.carId),
      median,
      avg60,
      history,
    };
  });
}
