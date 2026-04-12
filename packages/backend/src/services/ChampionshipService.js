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

  // ==================== Auto Championship ====================

  /**
   * Distribute items evenly across groups using round-robin
   * e.g. 10 items, max 4 → 3 groups of [4, 3, 3] (interleaved)
   */
  distributeEvenly(items, maxPerGroup) {
    const n = items.length;
    const numGroups = Math.ceil(n / maxPerGroup);
    const groups = Array.from({ length: numGroups }, () => []);
    for (let i = 0; i < n; i++) {
      groups[i % numGroups].push(items[i]);
    }
    return groups;
  }

  /**
   * Distribute items into balanced sequential chunks
   * e.g. 10 items, max 6 → 2 groups of [5, 5] (sequential order preserved)
   */
  distributeSequential(items, maxPerGroup) {
    const n = items.length;
    const numGroups = Math.ceil(n / maxPerGroup);
    const baseSize = Math.floor(n / numGroups);
    const extra = n % numGroups;
    const groups = [];
    let offset = 0;
    for (let g = 0; g < numGroups; g++) {
      const size = baseSize + (g < extra ? 1 : 0);
      groups.push(items.slice(offset, offset + size));
      offset += size;
    }
    return groups;
  }

  /**
   * Generate all qualif and race sessions for an auto championship
   */
  async generateAutoSessions(championshipId) {
    const championship = await this.prisma.championship.findUnique({
      where: { id: championshipId },
      include: { participants: { orderBy: { order: 'asc' } } },
    });

    if (!championship || championship.mode !== 'auto') return;

    const { participants, driversPerQualif, driversPerRace, trackId } = championship;
    if (!participants.length || !driversPerQualif || !driversPerRace || !trackId) return;

    // Delete existing auto-generated sessions (qualif + race only)
    await this.prisma.session.deleteMany({
      where: {
        championshipId,
        type: { in: ['qualif', 'race'] },
      },
    });

    let sessionOrder = 1; // 0 = practice

    // Generate qualif sessions
    const qualifGroups = this.distributeEvenly(participants, driversPerQualif);
    for (let g = 0; g < qualifGroups.length; g++) {
      const group = qualifGroups[g];
      const session = await this.prisma.session.create({
        data: {
          name: `Qualification ${g + 1}`,
          type: 'qualif',
          status: 'draft',
          trackId,
          championshipId,
          maxDuration: championship.qualifMaxDuration,
          maxLaps: championship.qualifMaxLaps,
          order: sessionOrder++,
          autoGroup: g,
        },
      });

      for (let i = 0; i < group.length; i++) {
        await this.prisma.sessionDriver.create({
          data: {
            sessionId: session.id,
            driverId: group[i].driverId,
            controller: i,
          },
        });
      }
    }

    // Generate race sessions (empty shells, filled after qualifs)
    const raceGroupCount = Math.ceil(participants.length / driversPerRace);
    for (let g = 0; g < raceGroupCount; g++) {
      await this.prisma.session.create({
        data: {
          name: `Course ${g + 1}`,
          type: 'race',
          status: 'draft',
          trackId,
          championshipId,
          maxDuration: championship.raceMaxDuration,
          maxLaps: championship.raceMaxLaps,
          order: sessionOrder++,
          autoGroup: g,
        },
      });
    }
  }

  /**
   * Assign drivers to race sessions based on merged qualif results
   */
  async assignDriversToRaces(championshipId) {
    const championship = await this.prisma.championship.findUnique({
      where: { id: championshipId },
      include: { participants: true },
    });

    if (!championship || championship.mode !== 'auto') return;

    // Get all finished qualif sessions with driver results
    const qualifSessions = await this.prisma.session.findMany({
      where: {
        championshipId,
        type: 'qualif',
        status: 'finished',
        deletedAt: null,
      },
      include: {
        drivers: { where: { deletedAt: null } },
      },
    });

    // Merge: best lap per driver across all qualif sessions
    const driverBests = new Map();
    for (const session of qualifSessions) {
      for (const sd of session.drivers) {
        if (!sd.driverId) continue;
        const existing = driverBests.get(sd.driverId);
        const bestTime = sd.bestLapTime ?? Infinity;
        if (!existing || bestTime < existing.bestTime) {
          driverBests.set(sd.driverId, {
            driverId: sd.driverId,
            bestTime,
          });
        }
      }
    }

    // Include participants who didn't set a time (place at end)
    for (const p of championship.participants) {
      if (!driverBests.has(p.driverId)) {
        driverBests.set(p.driverId, {
          driverId: p.driverId,
          bestTime: Infinity,
        });
      }
    }

    // Sort by best time ascending
    const ranking = Array.from(driverBests.values())
      .sort((a, b) => a.bestTime - b.bestTime);

    // Get race sessions sorted by autoGroup
    const raceSessions = await this.prisma.session.findMany({
      where: {
        championshipId,
        type: 'race',
        deletedAt: null,
      },
      orderBy: { autoGroup: 'asc' },
    });

    // Distribute ranking into balanced sequential groups (5+5 instead of 6+4, order preserved)
    const raceGroups = this.distributeSequential(ranking, championship.driversPerRace);

    for (let r = 0; r < raceSessions.length; r++) {
      const raceSession = raceSessions[r];
      const raceDrivers = raceGroups[r] || [];

      // Clear existing session drivers
      await this.prisma.sessionDriver.deleteMany({
        where: { sessionId: raceSession.id },
      });

      // Assign drivers
      for (let i = 0; i < raceDrivers.length; i++) {
        await this.prisma.sessionDriver.create({
          data: {
            sessionId: raceSession.id,
            driverId: raceDrivers[i].driverId,
            controller: i,
            gridPos: i + 1,
          },
        });
      }
    }

    this.io?.emit('championship:races_assigned', {
      championshipId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get bracket data for an auto championship
   */
  async getBracket(championshipId) {
    const championship = await this.prisma.championship.findUnique({
      where: { id: championshipId, deletedAt: null },
      include: {
        participants: {
          include: { driver: true },
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!championship || championship.mode !== 'auto') return null;

    const sessions = await this.prisma.session.findMany({
      where: { championshipId, deletedAt: null },
      include: {
        drivers: {
          where: { deletedAt: null },
          include: { driver: true, car: true },
          orderBy: { controller: 'asc' },
        },
      },
      orderBy: { order: 'asc' },
    });

    const qualifSessions = sessions.filter(s => s.type === 'qualif');
    const raceSessions = sessions.filter(s => s.type === 'race');
    const allQualifsFinished = qualifSessions.length > 0
      && qualifSessions.every(s => s.status === 'finished');

    // Build merged qualif ranking if all qualifs are done
    let mergedRanking = [];
    if (allQualifsFinished) {
      const driverBests = new Map();
      for (const session of qualifSessions) {
        for (const sd of session.drivers) {
          if (!sd.driverId) continue;
          const existing = driverBests.get(sd.driverId);
          const bestTime = sd.bestLapTime ?? Infinity;
          if (!existing || bestTime < existing.bestTime) {
            driverBests.set(sd.driverId, {
              driverId: sd.driverId,
              driver: sd.driver,
              bestTime: bestTime === Infinity ? null : bestTime,
            });
          }
        }
      }
      mergedRanking = Array.from(driverBests.values())
        .sort((a, b) => (a.bestTime ?? Infinity) - (b.bestTime ?? Infinity))
        .map((entry, i) => ({ position: i + 1, ...entry }));
    }

    return {
      mode: 'auto',
      driversPerQualif: championship.driversPerQualif,
      driversPerRace: championship.driversPerRace,
      participants: championship.participants,
      qualifGroups: qualifSessions.map(s => ({
        sessionId: s.id,
        group: s.autoGroup,
        label: `Q${(s.autoGroup ?? 0) + 1}`,
        name: s.name,
        status: s.status,
        drivers: s.drivers,
      })),
      allQualifsFinished,
      mergedRanking,
      raceGroups: raceSessions.map(s => ({
        sessionId: s.id,
        group: s.autoGroup,
        label: `R${(s.autoGroup ?? 0) + 1}`,
        name: s.name,
        status: s.status,
        drivers: s.drivers,
      })),
    };
  }

  // ==================== Callbacks from SessionService ====================

  /**
   * Called when a session finishes
   * Emits championship:standings_changed for frontend to refetch standings
   * For auto championships, checks if all qualifs are done to assign races
   */
  async onSessionFinished(sessionId, championshipId) {
    if (!championshipId) return;

    this.io?.emit('championship:standings_changed', {
      championshipId,
      sessionId,
      reason: 'session_finished',
      timestamp: new Date().toISOString(),
    });

    // Auto-progression: check if all qualifs finished
    const championship = await this.prisma.championship.findUnique({
      where: { id: championshipId },
      include: { sessions: { where: { deletedAt: null } } },
    });

    if (championship?.mode !== 'auto') return;

    const finishedSession = championship.sessions.find(s => s.id === sessionId);
    if (finishedSession?.type !== 'qualif') return;

    const qualifSessions = championship.sessions.filter(s => s.type === 'qualif');
    const allFinished = qualifSessions.every(s => s.status === 'finished');

    if (allFinished) {
      await this.assignDriversToRaces(championshipId);
    }
  }

  /**
   * Called when practice is reset or session deleted
   * For auto mode: if a qualif is reset, clear race driver assignments
   */
  async onStandingsChanged(championshipId, sessionId, reason) {
    if (!championshipId) return;

    this.io?.emit('championship:standings_changed', {
      championshipId,
      sessionId,
      reason,
      timestamp: new Date().toISOString(),
    });

    if (reason !== 'session_reset') return;

    const championship = await this.prisma.championship.findUnique({
      where: { id: championshipId },
      include: { sessions: { where: { deletedAt: null } } },
    });

    if (championship?.mode !== 'auto') return;

    const resetSession = championship.sessions.find(s => s.id === sessionId);
    if (resetSession?.type !== 'qualif') return;

    // Clear race session drivers since qualif results changed
    const raceSessions = championship.sessions.filter(s => s.type === 'race');
    for (const race of raceSessions) {
      await this.prisma.sessionDriver.deleteMany({ where: { sessionId: race.id } });
    }

    this.io?.emit('championship:races_assigned', {
      championshipId,
      cleared: true,
      timestamp: new Date().toISOString(),
    });
  }

  // ==================== Standings ====================

  /**
   * Get championship standings (calculated from session results)
   */
  async getStandings(championshipId) {
    const championship = await this.prisma.championship.findUnique({
      where: { id: championshipId, deletedAt: null },
      include: {
        sessions: {
          where: { status: 'finished', deletedAt: null },
          include: {
            drivers: {
              where: { deletedAt: null },
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
