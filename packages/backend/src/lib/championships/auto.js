import { distributeEvenly, distributeSequential, SessionType } from '@racehubos/shared';

// Moved to the shared package, which the interface's preview uses too
export { distributeEvenly, distributeSequential };

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
