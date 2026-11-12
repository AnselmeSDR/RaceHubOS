import { SessionStatus, SessionType } from '@racehubos/shared';
import { withImageUrl } from '../../utils/imageUrl.js';

const ranked = (entries) => entries.map((entry, index) => ({ position: index + 1, ...entry }));

/** Laps ranked by each driver and car's best lap (ms, rounded), with how many laps they did. */
export function bestLapStandings(laps) {
  const stats = new Map();
  for (const lap of laps) {
    const key = `${lap.driverId}-${lap.carId}`;
    if (!stats.has(key)) {
      stats.set(key, {
        driverId: lap.driverId,
        carId: lap.carId,
        driver: withImageUrl(lap.driver),
        car: withImageUrl(lap.car),
        bestTime: Infinity,
        totalLaps: 0,
      });
    }
    const entry = stats.get(key);
    const time = Math.round(lap.lapTime);
    entry.totalLaps++;
    if (time < entry.bestTime) entry.bestTime = time;
  }
  return ranked([...stats.values()].filter((e) => e.bestTime !== Infinity).sort((a, b) => a.bestTime - b.bestTime));
}

/**
 * Session entries ranked by laps (most first), then total time, with the races finished (not DNF,
 * at least one lap). Per driver and car, or per driver only when `perCar` is false.
 */
export function raceStandings(entries, { perCar = true } = {}) {
  const stats = new Map();
  for (const sd of entries) {
    const key = perCar ? `${sd.driverId}-${sd.carId}` : sd.driverId;
    if (!stats.has(key)) {
      stats.set(key, {
        driverId: sd.driverId,
        ...(perCar && { carId: sd.carId }),
        driver: withImageUrl(sd.driver),
        car: withImageUrl(sd.car),
        totalLaps: 0,
        totalTime: 0,
        finishedRaces: 0,
      });
    }
    const entry = stats.get(key);
    entry.totalLaps += sd.totalLaps || 0;
    entry.totalTime += sd.totalTime || 0;
    if (!sd.isDNF && sd.totalLaps > 0) entry.finishedRaces++;
  }
  return ranked(
    [...stats.values()].sort((a, b) =>
      b.totalLaps !== a.totalLaps ? b.totalLaps - a.totalLaps : a.totalTime - b.totalTime
    )
  );
}

const withPeople = { include: { driver: true, car: true } };

/**
 * Per standings type: the sessions it counts, the laps it reads, and how it ranks them.
 * Qualifying: best lap over finished qualifs. Race: laps then time over finished races.
 * Practice: best lap over every practice session, deleted laps included.
 */
const STANDINGS = {
  [SessionType.QUALIF]: {
    sessions: { type: SessionType.QUALIF, status: SessionStatus.FINISHED },
    laps: { where: { deletedAt: null }, ...withPeople },
    rank: (sessions) => bestLapStandings(sessions.flatMap((s) => s.laps)),
  },
  [SessionType.RACE]: {
    sessions: { type: SessionType.RACE, status: SessionStatus.FINISHED },
    laps: undefined,
    rank: (sessions) => raceStandings(sessions.flatMap((s) => s.drivers)),
  },
  [SessionType.PRACTICE]: {
    sessions: { type: SessionType.PRACTICE },
    laps: withPeople,
    rank: (sessions) => bestLapStandings(sessions.flatMap((s) => s.laps)),
  },
};

export const STANDINGS_TYPES = Object.keys(STANDINGS);

/** The championship relations `type`'s standings are computed from. */
export function standingsInclude(type) {
  const { sessions, laps } = STANDINGS[type];
  return {
    sessions: {
      where: { deletedAt: null, ...sessions },
      include: { drivers: { where: { deletedAt: null }, ...withPeople }, laps },
    },
  };
}

/** The `type` standings of the championship's sessions (loaded with `standingsInclude(type)`). */
export const championshipStandings = (type, sessions) => STANDINGS[type].rank(sessions);
