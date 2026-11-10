import { withImageUrl } from '../../utils/imageUrl.js';
import { bySuccess, lapFigures, raceCounts, raceEntries } from './figures.js';

const MINUTE_MS = 60000;

const successOf = ({ statistics: s }) => ({ wins: s.wins, podiums: s.podiums, races: s.totalRaces });

/** Each driver's races, wins, podiums, poles, DNFs and lap times; the most successful first. */
export function driverStats(drivers) {
  return drivers
    .map((driver) => {
      const races = raceEntries(driver.sessions);
      const { wins, podiums } = raceCounts(races);
      const { laps } = driver;
      return {
        id: driver.id,
        name: driver.name,
        number: driver.number,
        color: driver.color,
        ...withImageUrl({ img: driver.img }),
        team: withImageUrl(driver.team),
        statistics: {
          totalRaces: races.length,
          totalLaps: laps.length,
          wins,
          podiums,
          ...lapFigures(laps),
          dnf: races.filter((sd) => !sd.finalPos).length,
          polePositions: races.filter((sd) => sd.gridPos === 1).length,
        },
      };
    })
    .sort((a, b) => bySuccess(successOf(a), successOf(b)));
}

/** Each car's races, wins, reliability (races finished, %) and lap times; the most winning first. */
export function carStats(cars) {
  return cars
    .map((car) => {
      const races = raceEntries(car.sessions);
      const { laps } = car;
      return {
        id: car.id,
        brand: car.brand,
        model: car.model,
        year: car.year,
        color: car.color,
        ...withImageUrl({ img: car.img }),
        statistics: {
          totalRaces: races.length,
          totalLaps: laps.length,
          wins: raceCounts(races).wins,
          ...lapFigures(laps),
          reliability: races.length > 0 ? (races.filter((sd) => sd.finalPos).length / races.length) * 100 : 0,
        },
      };
    })
    .sort((a, b) => b.statistics.wins - a.statistics.wins);
}

/** Average length of the sessions in minutes, counting those never run as zero; null without sessions. */
function averageMinutes(sessions) {
  if (sessions.length === 0) return null;
  const total = sessions.reduce(
    (sum, s) => (s.startedAt && s.finishedAt ? sum + (new Date(s.finishedAt) - new Date(s.startedAt)) : sum),
    0
  );
  return total / sessions.length / MINUTE_MS;
}

/**
 * Each track's sessions, laps, best lap (the stored one when no lap was run) and average session
 * length; the busiest first. Sessions come with their fastest lap and their lap count.
 */
export function trackStats(tracks) {
  return tracks
    .map((track) => {
      const { sessions } = track;
      const fastest = sessions.flatMap((s) => s.laps).map((lap) => lap.lapTime);
      return {
        id: track.id,
        name: track.name,
        color: track.color,
        ...withImageUrl({ img: track.img }),
        length: track.length,
        corners: track.corners,
        statistics: {
          totalSessions: sessions.length,
          totalLaps: sessions.reduce((sum, s) => sum + s._count.laps, 0),
          bestLap: fastest.length > 0 ? Math.min(...fastest) : track.bestLap,
          bestLapBy: track.bestLapBy,
          avgSessionDuration: averageMinutes(sessions),
        },
      };
    })
    .sort((a, b) => b.statistics.totalSessions - a.statistics.totalSessions);
}
