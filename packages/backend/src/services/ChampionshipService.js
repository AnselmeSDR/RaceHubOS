import { PrismaClient } from '@prisma/client';

/**
 * ChampionshipService - Championship-specific operations
 *
 * Responsibilities:
 * - Emit championship:standings_changed when standings need refresh
 * - Calculate championship standings
 */
export class ChampionshipService {
  constructor(io) {
    this.prisma = new PrismaClient();
    this.io = io;
    this.sessionService = null;
  }

  setSessionService(sessionService) {
    this.sessionService = sessionService;
  }

  // ==================== Session Creation ====================

  /**
   * Create a session in this championship
   */
  async createSession(championshipId, params) {
    const championship = await this.prisma.championship.findUnique({
      where: { id: championshipId },
    });

    if (!championship) {
      throw new Error('Championship not found');
    }

    return this.sessionService.createSession({
      ...params,
      championshipId,
      trackId: championship.trackId,
    });
  }

  // ==================== Callbacks from SessionService ====================

  /**
   * Called when a session finishes
   * Emits championship:standings_changed for frontend to refetch standings
   */
  onSessionFinished(sessionId, championshipId) {
    if (!championshipId) return;

    this.io?.emit('championship:standings_changed', {
      championshipId,
      sessionId,
      reason: 'session_finished',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Called when practice is reset or session deleted
   */
  onStandingsChanged(championshipId, sessionId, reason) {
    if (!championshipId) return;

    this.io?.emit('championship:standings_changed', {
      championshipId,
      sessionId,
      reason,
      timestamp: new Date().toISOString(),
    });
  }

  // ==================== Standings ====================

  /**
   * Get championship standings (calculated from session results)
   */
  async getStandings(championshipId) {
    const championship = await this.prisma.championship.findUnique({
      where: { id: championshipId },
      include: {
        sessions: {
          where: { status: 'finished' },
          include: {
            drivers: {
              include: { driver: true },
              orderBy: { finalPos: 'asc' },
            },
          },
        },
        pointsSystem: true,
      },
    });

    if (!championship) return null;

    // Build standings from finished sessions
    const driverPoints = new Map();

    for (const session of championship.sessions) {
      const points = this.getPointsForSession(session, championship.pointsSystem);

      for (const sd of session.drivers) {
        if (!sd.driverId) continue;

        const existing = driverPoints.get(sd.driverId) || {
          driverId: sd.driverId,
          driver: sd.driver,
          totalPoints: 0,
          sessions: [],
        };

        const sessionPoints = points[sd.finalPos] || 0;
        existing.totalPoints += sessionPoints;
        existing.sessions.push({
          sessionId: session.id,
          type: session.type,
          position: sd.finalPos,
          points: sessionPoints,
        });

        driverPoints.set(sd.driverId, existing);
      }
    }

    // Sort by total points descending
    const standings = Array.from(driverPoints.values())
      .sort((a, b) => b.totalPoints - a.totalPoints)
      .map((entry, index) => ({
        position: index + 1,
        ...entry,
      }));

    return standings;
  }

  /**
   * Get points distribution for a session type
   */
  getPointsForSession(session, pointsSystem) {
    if (!pointsSystem) {
      // Default F1-style points
      return { 1: 25, 2: 18, 3: 15, 4: 12, 5: 10, 6: 8, 7: 6, 8: 4, 9: 2, 10: 1 };
    }

    // Use points system based on session type
    if (session.type === 'race') {
      return pointsSystem.racePoints || {};
    } else if (session.type === 'qualif') {
      return pointsSystem.qualifPoints || {};
    }

    return {};
  }

  /**
   * Close connections
   */
  async close() {
    await this.prisma.$disconnect();
  }
}

export default ChampionshipService;
