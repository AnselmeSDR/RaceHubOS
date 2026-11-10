import { SessionType } from '@racehubos/shared';
import SessionService from '../../services/SessionService.js';

/**
 * A session's leaderboard from its stored laps (not deleted): each entry's laps, total time, best
 * and last lap, then gaps and positions. A balancing session also lists each lap, in order, for its chart.
 */
export async function storedLeaderboard(prisma, session) {
  const laps = await prisma.lap.findMany({
    where: { sessionId: session.id, deletedAt: null },
    orderBy: { timestamp: 'desc' },
  });
  const entries = session.drivers.map((sd) => {
    const own = laps.filter((lap) => lap.controller === sd.controller);
    const times = own.map((lap) => lap.lapTime);
    const entry = {
      controller: sd.controller,
      driverId: sd.driverId,
      driver: sd.driver,
      car: sd.car,
      gridPos: sd.gridPos,
      totalLaps: own.length,
      totalTime: times.reduce((sum, time) => sum + Math.round(time), 0),
      bestLapTime: times.length > 0 ? Math.min(...times) : null,
      lastLapTime: times.length > 0 ? times[0] : null,
    };
    if (session.type === SessionType.BALANCING) {
      entry.laps = [...own]
        .sort((a, b) => a.lapNumber - b.lapNumber)
        .map((lap) => ({ lapNumber: lap.lapNumber, lapTime: Math.round(lap.lapTime) }));
    }
    return entry;
  });
  return SessionService.calculateDriverGaps(entries, session.type);
}
