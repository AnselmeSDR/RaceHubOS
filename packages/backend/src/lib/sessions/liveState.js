import { withDivisions } from '../divisions.js';

/** A session entry as the live session tracks it, from its stored row (with driver and car). */
export function liveDriverOf(entry) {
  return {
    id: entry.id,
    controller: entry.controller,
    driverId: entry.driverId,
    carId: entry.carId,
    driver: withDivisions(entry.driver),
    car: withDivisions(entry.car),
    gridPos: entry.gridPos,
    position: entry.position || 0,
    totalLaps: entry.totalLaps || 0,
    totalTime: entry.totalTime || 0,
    bestLapTime: entry.bestLapTime || null,
    lastLapTime: entry.lastLapTime || null,
    lapsAtFinishing: entry.lapsAtFinishing ?? null, // For checkered flag logic
    gap: null,
    crossings: entry.totalLaps || 0,
  };
}

/** The laps of each controller, in order (`controller → [{ lapNumber, lapTime }]`), for a balancing chart. */
export function lapHistoryOf(laps) {
  const history = new Map();
  for (const lap of [...laps].sort((a, b) => a.lapNumber - b.lapNumber)) {
    if (!history.has(lap.controller)) history.set(lap.controller, []);
    history.get(lap.controller).push({ lapNumber: lap.lapNumber, lapTime: Math.round(lap.lapTime) });
  }
  return history;
}

/** A session's pauses, stored as JSON; none when empty. */
export const pausesOf = (json) => (json ? JSON.parse(json) : []);
