import { SessionType } from '@racehubos/shared';

const PODIUM = 3;

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

const kept = { deletedAt: null, session: { deletedAt: null } };

/**
 * What a driver's or car's figures are read from: its entries and its fastest lap, none deleted
 * nor in a deleted session. They are never stored: always right after a deletion or a restore.
 */
export const FIGURES_INCLUDE = {
  sessions: { where: kept, select: { finalPos: true, session: { select: { type: true } } } },
  laps: { where: kept, select: { lapTime: true }, orderBy: { lapTime: 'asc' }, take: 1 },
};

/** The record with its races, wins, podiums and best lap, read from `FIGURES_INCLUDE`. */
export const withFigures = ({ sessions = [], laps = [], ...record }) => ({
  ...record,
  ...raceCounts(raceEntries(sessions)),
  bestLap: laps[0]?.lapTime ?? null,
});

/** The figures of one driver or car of `model`. */
export const figuresOf = async (model, id) =>
  withFigures(await model.findUnique({ where: { id }, select: FIGURES_INCLUDE }));

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
