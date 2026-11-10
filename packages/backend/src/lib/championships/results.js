import { SessionStatus, SessionType } from '@racehubos/shared';
import { championshipAwards } from './awards.js';
import { raceStandings } from './standings.js';

/** The championship's race standings per driver, its podium and its awards, from its finished sessions. */
export function championshipResults(sessions) {
  const finished = sessions.filter((s) => s.status === SessionStatus.FINISHED);
  const qualifs = finished.filter((s) => s.type === SessionType.QUALIF);
  const races = finished.filter((s) => s.type === SessionType.RACE);
  const entries = races.flatMap((s) => s.drivers).filter((sd) => sd.driverId);
  const standings = raceStandings(entries, { perCar: false });
  return {
    podium: standings.slice(0, 3),
    standings,
    awards: championshipAwards({ finished, qualifs, races, standings }),
  };
}
