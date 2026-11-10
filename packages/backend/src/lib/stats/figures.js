import { SessionType } from '@racehubos/shared';

const PODIUM = 3;
// Simple F1 scale for team standings (a championship's own points system was never stored)
const POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

/** Best and average time of the laps not deleted; null for each when there are none. */
export function lapFigures(laps) {
  const times = laps.filter((lap) => !lap.deletedAt).map((lap) => lap.lapTime);
  if (times.length === 0) return { bestLap: null, avgLapTime: null };
  return { bestLap: Math.min(...times), avgLapTime: times.reduce((sum, t) => sum + t, 0) / times.length };
}

/** The race entries among session entries (loaded with their session). */
export const raceEntries = (entries) => entries.filter((sd) => sd.session.type === SessionType.RACE);

export const isWin = (sd) => sd.finalPos === 1;
export const isPodium = (sd) => Boolean(sd.finalPos) && sd.finalPos <= PODIUM;

/** Races, wins and podiums of race entries. */
export const raceCounts = (races) => ({
  races: races.length,
  wins: races.filter(isWin).length,
  podiums: races.filter(isPodium).length,
});

/** The points a race place earns in team standings. */
export const pointsFor = (finalPos) => POINTS[finalPos - 1] ?? 0;

/** Most wins first, then most podiums, then most races. */
export const bySuccess = (a, b) => b.wins - a.wins || b.podiums - a.podiums || b.races - a.races;

/** A session filter from the query: one championship, one track, or championships only. */
export function sessionFilterOf({ championshipId, trackId, has_championship }) {
  const onlyChampionship = has_championship === 'true';
  if (!championshipId && !trackId && !onlyChampionship) return null;
  return {
    ...(championshipId && { championshipId }),
    ...(trackId && { trackId }),
    ...(onlyChampionship && { championshipId: { not: null } }),
  };
}
