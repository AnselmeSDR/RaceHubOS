import { SessionType } from '@racehubos/shared';

/**
 * Round-robin groups, as few as `maxPerGroup` allows:
 * 10 items, max 4 → [0,3,6,9] [1,4,7] [2,5,8].
 */
export function distributeEvenly(items, maxPerGroup) {
  const groups = Array.from({ length: Math.ceil(items.length / maxPerGroup) }, () => []);
  items.forEach((item, i) => groups[i % groups.length].push(item));
  return groups;
}

/**
 * Balanced consecutive groups, order kept: 10 items, max 6 → 5 + 5 rather than 6 + 4.
 */
export function distributeSequential(items, maxPerGroup) {
  const count = Math.ceil(items.length / maxPerGroup);
  const base = Math.floor(items.length / count);
  const extra = items.length % count;
  const groups = [];
  let offset = 0;
  for (let g = 0; g < count; g++) {
    const size = base + (g < extra ? 1 : 0);
    groups.push(items.slice(offset, offset + size));
    offset += size;
  }
  return groups;
}

/**
 * Each driver's best lap across the qualifying sessions, fastest first (`Infinity` without a lap).
 * `participants` adds those who never ran one, last.
 */
export function qualifRanking(qualifSessions, participants = []) {
  const bests = new Map();
  for (const session of qualifSessions) {
    for (const { driverId, driver, bestLapTime } of session.drivers) {
      if (!driverId) continue;
      const bestTime = bestLapTime ?? Infinity;
      const known = bests.get(driverId);
      if (!known || bestTime < known.bestTime) bests.set(driverId, { driverId, driver, bestTime });
    }
  }
  for (const { driverId } of participants) {
    if (!bests.has(driverId)) bests.set(driverId, { driverId, bestTime: Infinity });
  }
  // Infinity - Infinity is NaN, which sort takes for a tie
  return [...bests.values()].sort((a, b) => a.bestTime - b.bestTime);
}

export const isQualif = (session) => session.type === SessionType.QUALIF;
export const isRace = (session) => session.type === SessionType.RACE;

/** A qualifying or race group of the bracket: `Q1`, `R2`… */
export const bracketGroup = (prefix) => (session) => ({
  sessionId: session.id,
  group: session.autoGroup,
  label: `${prefix}${(session.autoGroup ?? 0) + 1}`,
  name: session.name,
  status: session.status,
  drivers: session.drivers,
});
