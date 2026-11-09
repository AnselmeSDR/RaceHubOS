import { SessionType } from '@racehubos/shared';
import { withImageUrl } from '../../utils/imageUrl.js';
import { bySuccess, isPodium, isWin, pointsFor, raceCounts } from './figures.js';

const renumbered = (entries) => entries.map((entry, index) => ({ ...entry, position: index + 1 }));

/** Most laps first, then the best lap, those without one last. */
function raceOrder(a, b) {
  if (b.laps !== a.laps) return b.laps - a.laps;
  if (a.bestLap === null) return 1;
  if (b.bestLap === null) return -1;
  return a.bestLap - b.bestLap;
}

/**
 * A session's entries with their laps, best and last lap (entries loaded with the session's laps).
 * By best lap for practice and qualifying (those without one left out), in race order for a race,
 * as placed otherwise.
 */
export function sessionLeaderboard(entries, phase) {
  const rows = entries.map((sd) => {
    const laps = sd.session.laps.filter((lap) => lap.driverId === sd.driverId);
    const times = laps.map((lap) => lap.lapTime);
    return {
      position: sd.finalPos || sd.position || null,
      driver: withImageUrl(sd.driver),
      car: withImageUrl(sd.car),
      laps: laps.length,
      bestLap: times.length > 0 ? Math.min(...times) : null,
      lastLap: times.length > 0 ? times[times.length - 1] : null,
      gap: null,
    };
  });
  if (phase === SessionType.PRACTICE || phase === SessionType.QUALIF) {
    return renumbered(rows.filter((row) => row.bestLap !== null).sort((a, b) => a.bestLap - b.bestLap));
  }
  if (phase === SessionType.RACE) return renumbered(rows.sort(raceOrder));
  return rows;
}

/** All-time wins, podiums and races per driver (drivers loaded with their race entries). */
export function overallLeaderboard(drivers) {
  return drivers
    .map((driver) => ({ driver, ...raceCounts(driver.sessions) }))
    .sort(bySuccess)
    .map(({ driver, wins, podiums, races }, index) => ({
      position: index + 1,
      driver: withImageUrl(driver),
      wins,
      podiums,
      races,
    }));
}

/** Team points, wins, podiums and races from their drivers' race places, with the gap to the leader. */
export function teamLeaderboard(teams) {
  const stats = teams
    .map((team) => {
      const races = team.drivers.flatMap((driver) => driver.sessions);
      return {
        team,
        points: races.reduce((sum, sd) => sum + pointsFor(sd.finalPos), 0),
        wins: races.filter(isWin).length,
        podiums: races.filter(isPodium).length,
        races: races.length,
      };
    })
    .sort((a, b) => b.points - a.points || b.wins - a.wins || b.podiums - a.podiums);
  return stats.map((stat, index) => ({
    position: index + 1,
    team: withImageUrl(stat.team),
    points: stat.points,
    wins: stat.wins,
    podiums: stat.podiums,
    races: stat.races,
    gap: index > 0 ? stats[0].points - stat.points : null,
  }));
}
