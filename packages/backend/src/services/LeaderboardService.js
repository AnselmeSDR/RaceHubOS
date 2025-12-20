import { PrismaClient } from '@prisma/client';
import { EventEmitter } from 'events';

export class LeaderboardService extends EventEmitter {
  constructor(io) {
    super();
    this.prisma = new PrismaClient();
    this.io = io;
  }

  /**
   * Get leaderboard for a session (Qualifying or Race)
   * For Qualifying: sorted by best lap time
   * For Race: sorted by lap count (desc), then total time (asc)
   */
  async getSessionLeaderboard(sessionId) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        participants: {
          include: {
            driver: true,
            car: true
          }
        }
      }
    });

    if (!session) return [];

    // Get lap data for each participant
    const leaderboard = [];

    for (const participant of session.participants) {
      const laps = await this.prisma.lap.findMany({
        where: {
          sessionId,
          driverId: participant.driverId
        },
        orderBy: { lapTime: 'asc' }
      });

      const lapCount = laps.length;
      const bestLap = laps[0]?.lapTime || null;
      const lastLap = laps.length > 0 ? laps[laps.length - 1]?.lapTime : null;
      const totalTime = laps.reduce((sum, lap) => sum + lap.lapTime, 0);

      leaderboard.push({
        position: 0, // Will be calculated
        controller: participant.controller,
        driver: participant.driver,
        car: participant.car,
        lapCount,
        bestLap,
        lastLap,
        totalTime,
        gap: null, // Will be calculated
        interval: null // Will be calculated
      });
    }

    // Sort based on session type
    if (session.type === 'qualifying') {
      // Qualifying: best lap time wins
      leaderboard.sort((a, b) => {
        if (!a.bestLap && !b.bestLap) return 0;
        if (!a.bestLap) return 1;
        if (!b.bestLap) return -1;
        return a.bestLap - b.bestLap;
      });
    } else {
      // Race: most laps wins, then lowest total time
      leaderboard.sort((a, b) => {
        if (b.lapCount !== a.lapCount) return b.lapCount - a.lapCount;
        return a.totalTime - b.totalTime;
      });
    }

    // Assign positions and calculate gaps
    const leader = leaderboard[0];
    let prevEntry = null;

    for (let i = 0; i < leaderboard.length; i++) {
      leaderboard[i].position = i + 1;

      if (i === 0) {
        leaderboard[i].gap = null;
        leaderboard[i].interval = null;
      } else {
        if (session.type === 'qualifying') {
          // Gap is time difference to leader's best lap
          leaderboard[i].gap = leader.bestLap ? leaderboard[i].bestLap - leader.bestLap : null;
          leaderboard[i].interval = prevEntry.bestLap ? leaderboard[i].bestLap - prevEntry.bestLap : null;
        } else {
          // Gap is lap difference or time if same lap
          const lapDiff = leader.lapCount - leaderboard[i].lapCount;
          if (lapDiff > 0) {
            leaderboard[i].gap = `+${lapDiff} lap${lapDiff > 1 ? 's' : ''}`;
          } else {
            leaderboard[i].gap = leaderboard[i].totalTime - leader.totalTime;
          }

          // Interval to car ahead
          const prevLapDiff = prevEntry.lapCount - leaderboard[i].lapCount;
          if (prevLapDiff > 0) {
            leaderboard[i].interval = `+${prevLapDiff} lap${prevLapDiff > 1 ? 's' : ''}`;
          } else {
            leaderboard[i].interval = leaderboard[i].totalTime - prevEntry.totalTime;
          }
        }
      }

      prevEntry = leaderboard[i];
    }

    return leaderboard;
  }

  /**
   * Get leaderboard for Free Practice (by track)
   * Sorted by best lap time
   */
  async getFreePracticeLeaderboard(trackId, limit = 20) {
    // Get best lap per driver/car combo
    const bestLaps = await this.prisma.lap.groupBy({
      by: ['driverId', 'carId'],
      where: {
        trackId,
        sessionId: null // Free practice only
      },
      _min: {
        lapTime: true
      },
      _count: {
        id: true
      }
    });

    // Build leaderboard
    const leaderboard = [];

    for (const entry of bestLaps) {
      const driver = await this.prisma.driver.findUnique({ where: { id: entry.driverId } });
      const car = await this.prisma.car.findUnique({ where: { id: entry.carId } });

      leaderboard.push({
        position: 0,
        driver,
        car,
        bestLap: entry._min.lapTime,
        lapCount: entry._count.id,
        gap: null
      });
    }

    // Sort by best lap
    leaderboard.sort((a, b) => a.bestLap - b.bestLap);

    // Assign positions and gaps
    const leader = leaderboard[0];
    for (let i = 0; i < leaderboard.length; i++) {
      leaderboard[i].position = i + 1;
      leaderboard[i].gap = i === 0 ? null : leaderboard[i].bestLap - leader.bestLap;
    }

    return leaderboard.slice(0, limit);
  }

  /**
   * Format gap for display
   */
  formatGap(gap) {
    if (gap === null) return '-';
    if (typeof gap === 'string') return gap; // Already formatted (e.g., "+1 lap")

    if (gap < 1000) {
      return `+${(gap / 1000).toFixed(3)}`;
    } else if (gap < 60000) {
      return `+${(gap / 1000).toFixed(2)}`;
    } else {
      const mins = Math.floor(gap / 60000);
      const secs = ((gap % 60000) / 1000).toFixed(1);
      return `+${mins}:${secs.padStart(4, '0')}`;
    }
  }

  /**
   * Format lap time for display
   */
  formatLapTime(ms) {
    if (!ms) return '-';

    const mins = Math.floor(ms / 60000);
    const secs = ((ms % 60000) / 1000).toFixed(3);

    if (mins > 0) {
      return `${mins}:${secs.padStart(6, '0')}`;
    }
    return secs;
  }

  /**
   * Emit leaderboard update
   */
  async emitLeaderboardUpdate(sessionId) {
    const leaderboard = await this.getSessionLeaderboard(sessionId);
    this.io?.emit('leaderboard:updated', { sessionId, leaderboard });
    return leaderboard;
  }
}
