import { withImageUrl } from '../../utils/imageUrl.js';

const CONSISTENCY_MIN_LAPS = 5;
const CONSISTENCY_TRIM = 0.1;

/** The fastest lap of `sessions` with its session, the first one on a tie; null when none was driven. */
function fastestLap(sessions) {
  let fastest = null;
  for (const session of sessions) {
    for (const lap of session.laps) {
      if (!fastest || lap.lapTime < fastest.lap.lapTime) fastest = { lap, session };
    }
  }
  return fastest;
}

const lapFigures = ({ lap, session }) => ({
  lapTime: Math.round(lap.lapTime),
  driver: withImageUrl(lap.driver),
  car: withImageUrl(lap.car),
  sessionName: session.name,
});

/** The driver who gained the most places from the qualifying ranking to the race standings, if any did. */
function biggestComeback(qualifs, standings) {
  const bests = {};
  for (const lap of qualifs.flatMap((s) => s.laps)) {
    if (!bests[lap.driverId] || lap.lapTime < bests[lap.driverId]) bests[lap.driverId] = lap.lapTime;
  }
  const qualifPositions = new Map(
    Object.entries(bests)
      .sort((a, b) => a[1] - b[1])
      .map(([driverId], i) => [driverId, i + 1])
  );

  let best = null;
  for (const standing of standings) {
    const qualifPos = qualifPositions.get(standing.driverId);
    if (!qualifPos) continue;
    const gain = qualifPos - standing.position;
    if (!best || gain > best.gain) best = { driver: standing.driver, gain, qualifPos, racePos: standing.position };
  }
  return best?.gain > 0 ? best : null;
}

/** Standard deviation of the lap times, the fastest and slowest 10 % (at least one each) left out. */
export function trimmedStdDev(times) {
  const sorted = [...times].sort((a, b) => a - b);
  const trim = Math.max(1, Math.floor(sorted.length * CONSISTENCY_TRIM));
  const kept = sorted.slice(trim, sorted.length - trim);
  const mean = kept.reduce((sum, t) => sum + t, 0) / kept.length;
  return Math.sqrt(kept.reduce((sum, t) => sum + (t - mean) ** 2, 0) / kept.length);
}

/** The steadiest driver of a race (smallest trimmed deviation, five laps or more). */
function mostConsistent(races) {
  let best = null;
  for (const session of races) {
    const byDriver = new Map();
    for (const lap of session.laps) {
      if (!byDriver.has(lap.driverId)) byDriver.set(lap.driverId, { times: [], driver: withImageUrl(lap.driver) });
      byDriver.get(lap.driverId).times.push(lap.lapTime);
    }
    for (const { times, driver } of byDriver.values()) {
      if (times.length < CONSISTENCY_MIN_LAPS) continue;
      const stdDev = trimmedStdDev(times);
      if (!best || stdDev < best.stdDev) best = { stdDev, driver, sessionName: session.name };
    }
  }
  return best && { ...best, stdDev: Math.round(best.stdDev) };
}

/** The driver with the most race laps, the first one on a tie. */
const ironMan = (standings) => standings.reduce((best, s) => (!best || s.totalLaps > best.totalLaps ? s : best), null);

/**
 * The championship's awards, from its finished sessions: fastest lap overall, in qualifying and in
 * race, biggest comeback, steadiest driver, most race laps. Those nobody earned are left out.
 */
export function championshipAwards({ finished, qualifs, races, standings }) {
  const awards = [];
  const best = fastestLap(finished);
  if (best) {
    awards.push({
      id: 'best-lap',
      title: 'Meilleur tour',
      icon: 'timer',
      ...lapFigures(best),
      sessionType: best.session.type,
    });
  }
  const bestQualif = fastestLap(qualifs);
  if (bestQualif)
    awards.push({ id: 'best-qualif', title: 'Meilleur qualifié', icon: 'clock', ...lapFigures(bestQualif) });
  const bestRace = fastestLap(races);
  if (bestRace)
    awards.push({ id: 'best-race-lap', title: 'Plus rapide en course', icon: 'zap', ...lapFigures(bestRace) });

  const comeback = qualifs.length > 0 && races.length > 0 && biggestComeback(qualifs, standings);
  if (comeback) awards.push({ id: 'comeback', title: 'Plus gros comeback', icon: 'trending-up', ...comeback });

  const steadiest = mostConsistent(races);
  if (steadiest) awards.push({ id: 'consistent', title: 'Le plus régulier', icon: 'activity', ...steadiest });

  const endurance = ironMan(standings);
  if (endurance) {
    const { driver, totalLaps, finishedRaces } = endurance;
    awards.push({ id: 'iron-man', title: 'Le plus endurant', icon: 'heart', driver, totalLaps, finishedRaces });
  }
  return awards;
}
