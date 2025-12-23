import { PrismaClient } from '@prisma/client';
import EventEmitter from 'events';

const GRACE_PERIOD_MS = 30000; // 30 seconds

/**
 * ChampionshipSessionManager - Manages championship session lifecycle
 *
 * Responsibilities:
 * - WebSocket events for session state changes
 * - Grace period (30s) management
 * - DNF detection
 * - Heartbeat during active sessions
 * - Standings recalculation triggers
 */
export class ChampionshipSessionManager extends EventEmitter {
  constructor(io) {
    super();
    this.prisma = new PrismaClient();
    this.io = io;
    this.trackSync = null;

    // Active session state
    this.activeSessionId = null;
    this.heartbeatInterval = null;
    this.gracePeriodTimer = null;
    this.gracePeriodEndsAt = null;
    this.waitingForRaceStart = false; // True when session is active but CU not racing yet
  }

  /**
   * Connect to TrackSyncService for CU control and lap events
   */
  setTrackSync(trackSync) {
    this.trackSync = trackSync;

    // Listen to lap events
    trackSync.on('lap-completed', (lapData) => {
      this.handleLapCompleted(lapData);
    });

    console.log('[ChampionshipSessionManager] Connected to TrackSyncService');
  }

  /**
   * Start a championship session
   */
  async startSession(sessionId) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        drivers: { include: { driver: true, car: true } },
        championship: true,
        track: true,
      },
    });

    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    if (session.status !== 'ready') {
      throw new Error(`Session must be in 'ready' status to start, current: ${session.status}`);
    }

    const previousStatus = session.status;

    // Update session status to active
    const updatedSession = await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        status: 'active',
        startedAt: new Date(),
      },
      include: {
        drivers: { include: { driver: true, car: true } },
        championship: true,
        track: true,
      },
    });

    this.activeSessionId = sessionId;

    // Start heartbeat
    this.startHeartbeat(updatedSession);

    // Emit status change
    this.emitSessionStatusChanged(updatedSession, previousStatus);

    return updatedSession;
  }

  /**
   * Handle lap completed event
   */
  async handleLapCompleted(lapData) {
    if (!this.activeSessionId) return;

    const session = await this.prisma.session.findUnique({
      where: { id: this.activeSessionId },
      include: {
        drivers: { include: { driver: true, car: true } },
        championship: true,
      },
    });

    if (!session) return;

    // Update session driver stats
    const sessionDriver = await this.prisma.sessionDriver.findFirst({
      where: {
        sessionId: this.activeSessionId,
        controller: lapData.controller,
      },
    });

    if (sessionDriver) {
      await this.prisma.sessionDriver.update({
        where: { id: sessionDriver.id },
        data: {
          totalLaps: { increment: 1 },
          totalTime: { increment: Math.round(lapData.lapTime) },
        },
      });
    }

    // Emit lap_completed event with enriched data
    const enrichedLapData = await this.buildLapCompletedEvent(lapData, session);
    this.io?.emit('lap_completed', enrichedLapData);

    // Check if session should transition to finishing
    if (session.status === 'active') {
      const shouldFinish = await this.checkSessionEndCondition(session);
      if (shouldFinish) {
        await this.startFinishingPhase(session, shouldFinish.reason);
      }
    }

    // If in finishing phase, check if all drivers completed their lap
    if (session.status === 'finishing') {
      const allFinished = await this.checkAllDriversFinished(session);
      if (allFinished) {
        await this.finishSession(session, 'all_drivers_finished');
      }
    }
  }

  /**
   * Build enriched lap_completed event data
   */
  async buildLapCompletedEvent(lapData, session) {
    const leaderboard = await this.getSessionLeaderboard(session.id);
    const driverEntry = leaderboard.find(e => e.controller === lapData.controller);

    return {
      event: 'lap_completed',
      serverTime: new Date().toISOString(),
      data: {
        sessionId: session.id,
        controller: lapData.controller,
        driverId: lapData.driverId,
        lapNumber: lapData.lapNumber || (driverEntry?.totalLaps || 0),
        lapTime: lapData.lapTime,
        isBestLap: driverEntry?.bestLap === lapData.lapTime,
        isFastestLap: leaderboard.every(e => !e.bestLap || lapData.lapTime <= e.bestLap),
        position: driverEntry?.position || 0,
        gap: driverEntry?.gap || null,
      },
    };
  }

  /**
   * Check if session should end based on duration or laps
   */
  async checkSessionEndCondition(session) {
    // Check duration limit
    if (session.duration && session.startedAt) {
      const elapsed = Date.now() - new Date(session.startedAt).getTime();
      const durationMs = session.duration * 60 * 1000;
      if (elapsed >= durationMs) {
        return { reason: 'time_elapsed' };
      }
    }

    // Check lap limit
    if (session.maxLaps) {
      const lapCounts = await this.prisma.lap.groupBy({
        by: ['controller'],
        where: { sessionId: session.id, softDeletedAt: null },
        _count: { id: true },
      });

      const leaderLaps = Math.max(...lapCounts.map(l => l._count.id), 0);
      if (leaderLaps >= session.maxLaps) {
        return { reason: 'leader_finished' };
      }
    }

    return null;
  }

  /**
   * Start the finishing phase (grace period)
   */
  async startFinishingPhase(session, reason) {
    const previousStatus = session.status;
    const endsAt = new Date(Date.now() + GRACE_PERIOD_MS);

    // Update session status
    await this.prisma.session.update({
      where: { id: session.id },
      data: {
        status: 'finishing',
        finishingAt: new Date(),
      },
    });

    // Snapshot lapsAtFinishing for each driver
    const sessionDrivers = await this.prisma.sessionDriver.findMany({
      where: { sessionId: session.id },
    });

    for (const sd of sessionDrivers) {
      const lapCount = await this.prisma.lap.count({
        where: {
          sessionId: session.id,
          controller: sd.controller,
          softDeletedAt: null,
        },
      });

      await this.prisma.sessionDriver.update({
        where: { id: sd.id },
        data: { lapsAtFinishing: lapCount },
      });
    }

    this.gracePeriodEndsAt = endsAt;

    // Emit session_finishing event
    this.io?.emit('session_finishing', {
      event: 'session_finishing',
      data: {
        sessionId: session.id,
        championshipId: session.championshipId,
        reason,
        endsAt: endsAt.toISOString(),
        remainingSeconds: 30,
      },
    });

    // Emit status change
    const updatedSession = await this.prisma.session.findUnique({
      where: { id: session.id },
      include: { championship: true },
    });
    this.emitSessionStatusChanged(updatedSession, previousStatus);

    // Start grace period timer
    this.gracePeriodTimer = setTimeout(async () => {
      const currentSession = await this.prisma.session.findUnique({
        where: { id: session.id },
      });
      if (currentSession?.status === 'finishing') {
        await this.finishSession(currentSession, 'grace_period_elapsed');
      }
    }, GRACE_PERIOD_MS);

    console.log(`[ChampionshipSessionManager] Session ${session.id} entering finishing phase (${reason})`);
  }

  /**
   * Check if all drivers have completed at least one lap during grace period
   */
  async checkAllDriversFinished(session) {
    const sessionDrivers = await this.prisma.sessionDriver.findMany({
      where: { sessionId: session.id },
    });

    for (const sd of sessionDrivers) {
      if (sd.lapsAtFinishing === null) continue;
      if (sd.lapsAtFinishing === 0) continue; // Wasn't racing

      const currentLaps = await this.prisma.lap.count({
        where: {
          sessionId: session.id,
          controller: sd.controller,
          softDeletedAt: null,
        },
      });

      // Driver hasn't completed a lap during grace period
      if (currentLaps <= sd.lapsAtFinishing) {
        return false;
      }
    }

    return true;
  }

  /**
   * Finish the session
   */
  async finishSession(session, reason) {
    // Clear grace period timer if exists
    if (this.gracePeriodTimer) {
      clearTimeout(this.gracePeriodTimer);
      this.gracePeriodTimer = null;
    }
    this.gracePeriodEndsAt = null;

    const previousStatus = session.status;

    // Calculate DNF status and final positions
    await this.calculateDNFAndPositions(session.id);

    // Update session status
    const updatedSession = await this.prisma.session.update({
      where: { id: session.id },
      data: {
        status: 'finished',
        finishedAt: new Date(),
      },
      include: {
        drivers: { include: { driver: true, car: true } },
        championship: true,
        track: true,
      },
    });

    // Stop heartbeat
    this.stopHeartbeat();
    this.activeSessionId = null;

    // Get results
    const results = await this.getSessionResults(session.id);

    // Emit session_finished event
    this.io?.emit('session_finished', {
      event: 'session_finished',
      data: {
        sessionId: session.id,
        championshipId: session.championshipId,
        type: session.type,
        results,
      },
    });

    // Emit status change
    this.emitSessionStatusChanged(updatedSession, previousStatus);

    // Emit standings_changed if championship session
    if (session.championshipId) {
      await this.recalculateStandings(session.championshipId);

      this.io?.emit('standings_changed', {
        event: 'standings_changed',
        data: {
          championshipId: session.championshipId,
          types: [session.type === 'qualif' ? 'qualif' : session.type],
        },
      });
    }

    // Stop CU (toggle to lights mode)
    if (this.trackSync?.controlUnit?.isConnected()) {
      try {
        await this.trackSync.controlUnit.start();
      } catch (e) {
        console.error('[ChampionshipSessionManager] Failed to stop CU:', e);
      }
    }

    console.log(`[ChampionshipSessionManager] Session ${session.id} finished (${reason})`);

    return updatedSession;
  }

  /**
   * Calculate DNF status and final positions
   */
  async calculateDNFAndPositions(sessionId) {
    const sessionDrivers = await this.prisma.sessionDriver.findMany({
      where: { sessionId },
      include: { driver: true },
    });

    // Get current lap counts and times
    const driverStats = [];
    for (const sd of sessionDrivers) {
      const laps = await this.prisma.lap.findMany({
        where: {
          sessionId,
          controller: sd.controller,
          softDeletedAt: null,
        },
      });

      const totalLaps = laps.length;
      const totalTime = laps.reduce((sum, lap) => sum + Math.round(lap.lapTime), 0);
      const bestLap = laps.length > 0 ? Math.min(...laps.map(l => l.lapTime)) : null;

      // DNF detection: had laps at finishing but didn't complete any during grace period
      let isDNF = false;
      if (sd.lapsAtFinishing !== null && sd.lapsAtFinishing > 0) {
        isDNF = totalLaps === sd.lapsAtFinishing;
      }

      driverStats.push({
        sessionDriverId: sd.id,
        driverId: sd.driverId,
        totalLaps,
        totalTime,
        bestLap,
        isDNF,
      });
    }

    // Sort by: non-DNF first, then by laps (desc), then by time (asc)
    const session = await this.prisma.session.findUnique({ where: { id: sessionId } });

    if (session?.type === 'qualif') {
      // Qualifying: sort by best lap time
      driverStats.sort((a, b) => {
        if (a.bestLap === null && b.bestLap === null) return 0;
        if (a.bestLap === null) return 1;
        if (b.bestLap === null) return -1;
        return a.bestLap - b.bestLap;
      });
    } else {
      // Race: DNF last, then laps desc, then time asc
      driverStats.sort((a, b) => {
        if (a.isDNF !== b.isDNF) return a.isDNF ? 1 : -1;
        if (a.totalLaps !== b.totalLaps) return b.totalLaps - a.totalLaps;
        return a.totalTime - b.totalTime;
      });
    }

    // Update final positions
    for (let i = 0; i < driverStats.length; i++) {
      const stat = driverStats[i];
      await this.prisma.sessionDriver.update({
        where: { id: stat.sessionDriverId },
        data: {
          finalPos: i + 1,
          totalLaps: stat.totalLaps,
          totalTime: stat.totalTime,
          isDNF: stat.isDNF,
        },
      });
    }
  }

  /**
   * Get session results
   */
  async getSessionResults(sessionId) {
    const sessionDrivers = await this.prisma.sessionDriver.findMany({
      where: { sessionId },
      include: { driver: true, car: true },
      orderBy: { finalPos: 'asc' },
    });

    return sessionDrivers.map(sd => ({
      driverId: sd.driverId,
      driver: {
        id: sd.driver.id,
        name: sd.driver.name,
        color: sd.driver.color,
        number: sd.driver.number,
      },
      finalPos: sd.finalPos,
      totalLaps: sd.totalLaps,
      totalTime: sd.totalTime,
      isDNF: sd.isDNF,
    }));
  }

  /**
   * Get session leaderboard
   */
  async getSessionLeaderboard(sessionId) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session) return [];

    const sessionDrivers = await this.prisma.sessionDriver.findMany({
      where: { sessionId },
      include: { driver: true, car: true },
    });

    const entries = [];
    for (const sd of sessionDrivers) {
      const laps = await this.prisma.lap.findMany({
        where: {
          sessionId,
          controller: sd.controller,
          softDeletedAt: null,
        },
        orderBy: { timestamp: 'desc' },
      });

      const totalLaps = laps.length;
      const totalTime = laps.reduce((sum, lap) => sum + Math.round(lap.lapTime), 0);
      const bestLap = laps.length > 0 ? Math.min(...laps.map(l => l.lapTime)) : null;
      const lastLap = laps.length > 0 ? laps[0].lapTime : null;

      entries.push({
        controller: sd.controller,
        driverId: sd.driverId,
        driver: sd.driver,
        car: sd.car,
        totalLaps,
        totalTime,
        bestLap,
        lastLap,
        position: 0,
        gap: null,
      });
    }

    // Sort entries
    if (session.type === 'qualif') {
      entries.sort((a, b) => {
        if (a.bestLap === null && b.bestLap === null) return 0;
        if (a.bestLap === null) return 1;
        if (b.bestLap === null) return -1;
        return a.bestLap - b.bestLap;
      });
    } else {
      entries.sort((a, b) => {
        if (a.totalLaps !== b.totalLaps) return b.totalLaps - a.totalLaps;
        return a.totalTime - b.totalTime;
      });
    }

    // Calculate positions and gaps
    const leader = entries[0];
    for (let i = 0; i < entries.length; i++) {
      entries[i].position = i + 1;

      if (i === 0) {
        entries[i].gap = null;
      } else if (session.type === 'qualif') {
        if (leader?.bestLap && entries[i].bestLap) {
          const diff = entries[i].bestLap - leader.bestLap;
          entries[i].gap = `+${(diff / 1000).toFixed(3)}`;
        }
      } else {
        if (entries[i].totalLaps < leader?.totalLaps) {
          const lapsDiff = leader.totalLaps - entries[i].totalLaps;
          entries[i].gap = lapsDiff === 1 ? '+1 LAP' : `+${lapsDiff} LAPS`;
        } else if (leader?.totalTime) {
          const timeDiff = entries[i].totalTime - leader.totalTime;
          entries[i].gap = `+${(timeDiff / 1000).toFixed(3)}`;
        }
      }
    }

    return entries;
  }

  /**
   * Recalculate championship standings
   */
  async recalculateStandings(championshipId) {
    const championship = await this.prisma.championship.findUnique({
      where: { id: championshipId },
      include: {
        sessions: {
          where: { status: 'finished' },
          include: {
            drivers: { include: { driver: true } },
            laps: true,
          },
        },
      },
    });

    if (!championship) return;

    const pointsSystem = JSON.parse(championship.pointsSystem || '{}');
    const driverStats = {};

    const initDriver = (driverId) => {
      if (!driverStats[driverId]) {
        driverStats[driverId] = {
          points: 0,
          wins: 0,
          podiums: 0,
          qualifBestTime: null,
          raceTotalLaps: 0,
          raceTotalTime: 0,
        };
      }
    };

    for (const session of championship.sessions) {
      for (const sd of session.drivers) {
        if (sd.finalPos !== null) {
          initDriver(sd.driverId);
          const points = pointsSystem[sd.finalPos] || 0;
          driverStats[sd.driverId].points += points;
          if (sd.finalPos === 1) driverStats[sd.driverId].wins++;
          if (sd.finalPos <= 3) driverStats[sd.driverId].podiums++;
        }
      }

      for (const lap of session.laps) {
        initDriver(lap.driverId);
        const lapTimeMs = Math.round(lap.lapTime);

        if (lap.phase === 'qualif') {
          const current = driverStats[lap.driverId].qualifBestTime;
          if (current === null || lapTimeMs < current) {
            driverStats[lap.driverId].qualifBestTime = lapTimeMs;
          }
        }

        if (lap.phase === 'race') {
          driverStats[lap.driverId].raceTotalLaps++;
          driverStats[lap.driverId].raceTotalTime += lapTimeMs;
        }
      }
    }

    const sortedDrivers = Object.entries(driverStats)
      .sort((a, b) => {
        if (b[1].points !== a[1].points) return b[1].points - a[1].points;
        return b[1].wins - a[1].wins;
      })
      .map(([driverId, stats], index) => ({
        championshipId,
        driverId,
        position: index + 1,
        ...stats,
      }));

    await this.prisma.championshipStanding.deleteMany({ where: { championshipId } });
    if (sortedDrivers.length > 0) {
      await this.prisma.championshipStanding.createMany({ data: sortedDrivers });
    }
  }

  /**
   * Emit session_status_changed event
   */
  emitSessionStatusChanged(session, previousStatus) {
    this.io?.emit('session_status_changed', {
      event: 'session_status_changed',
      data: {
        sessionId: session.id,
        championshipId: session.championshipId,
        previousStatus,
        status: session.status,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Start heartbeat (1x/sec)
   */
  startHeartbeat(session) {
    this.stopHeartbeat();

    this.heartbeatInterval = setInterval(async () => {
      if (!this.activeSessionId) {
        this.stopHeartbeat();
        return;
      }

      const currentSession = await this.prisma.session.findUnique({
        where: { id: this.activeSessionId },
      });

      if (!currentSession || currentSession.status === 'finished') {
        this.stopHeartbeat();
        return;
      }

      const elapsedTime = currentSession.startedAt
        ? Date.now() - new Date(currentSession.startedAt).getTime()
        : 0;

      let remainingTime = null;
      if (currentSession.duration) {
        remainingTime = Math.max(0, currentSession.duration * 60 * 1000 - elapsedTime);
      }

      let remainingLaps = null;
      if (currentSession.maxLaps) {
        const lapCounts = await this.prisma.lap.groupBy({
          by: ['controller'],
          where: { sessionId: this.activeSessionId, softDeletedAt: null },
          _count: { id: true },
        });
        const leaderLaps = Math.max(...lapCounts.map(l => l._count.id), 0);
        remainingLaps = Math.max(0, currentSession.maxLaps - leaderLaps);
      }

      // Calculate grace period remaining if in finishing state
      let gracePeriodRemaining = null;
      if (currentSession.status === 'finishing' && this.gracePeriodEndsAt) {
        gracePeriodRemaining = Math.max(0, this.gracePeriodEndsAt.getTime() - Date.now());
      }

      this.io?.emit('heartbeat', {
        event: 'heartbeat',
        serverTime: new Date().toISOString(),
        data: {
          sessionId: this.activeSessionId,
          status: currentSession.status,
          elapsedTime,
          remainingTime,
          remainingLaps,
          gracePeriodRemaining,
        },
      });
    }, 1000);
  }

  /**
   * Stop heartbeat
   */
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Reset practice session (soft delete laps)
   */
  async resetPractice(sessionId) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: { championship: true },
    });

    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    if (session.type !== 'practice') {
      throw new Error('Can only reset practice sessions');
    }

    // Soft delete all laps
    await this.prisma.lap.updateMany({
      where: {
        sessionId,
        softDeletedAt: null,
      },
      data: {
        softDeletedAt: new Date(),
      },
    });

    // Emit practice_reset event
    this.io?.emit('practice_reset', {
      event: 'practice_reset',
      data: {
        sessionId,
        championshipId: session.championshipId,
        timestamp: new Date().toISOString(),
      },
    });

    // Emit standings_changed if championship session
    if (session.championshipId) {
      this.io?.emit('standings_changed', {
        event: 'standings_changed',
        data: {
          championshipId: session.championshipId,
          types: ['practice'],
        },
      });
    }

    console.log(`[ChampionshipSessionManager] Practice session ${sessionId} reset`);
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: { championship: true },
    });

    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const championshipId = session.championshipId;
    const sessionType = session.type;

    // Delete related data
    await this.prisma.lap.deleteMany({ where: { sessionId } });
    await this.prisma.raceEvent.deleteMany({ where: { sessionId } });
    await this.prisma.sessionDriver.deleteMany({ where: { sessionId } });
    await this.prisma.sessionPhase.deleteMany({ where: { sessionId } });
    await this.prisma.session.delete({ where: { id: sessionId } });

    // Emit session_deleted event
    this.io?.emit('session_deleted', {
      event: 'session_deleted',
      data: {
        sessionId,
        championshipId,
        type: sessionType,
      },
    });

    // Emit standings_changed if championship session
    if (championshipId) {
      await this.recalculateStandings(championshipId);

      this.io?.emit('standings_changed', {
        event: 'standings_changed',
        data: {
          championshipId,
          types: [sessionType === 'qualif' ? 'qualif' : sessionType],
        },
      });
    }

    console.log(`[ChampionshipSessionManager] Session ${sessionId} deleted`);
  }

  /**
   * Manually trigger session finishing (for force stop)
   */
  async forceFinish(sessionId) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    if (session.status !== 'active' && session.status !== 'finishing') {
      throw new Error(`Cannot finish session in status ${session.status}`);
    }

    await this.finishSession(session, 'manual_stop');
  }

  /**
   * Change session status (draft <-> ready)
   */
  async changeSessionStatus(sessionId, newStatus) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: { championship: true },
    });

    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const allowedTransitions = {
      draft: ['ready'],
      ready: ['draft', 'active'],
      finished: ['draft'], // Reset finished session
    };

    if (!allowedTransitions[session.status]?.includes(newStatus)) {
      throw new Error(`Cannot transition from ${session.status} to ${newStatus}`);
    }

    const previousStatus = session.status;

    const updateData = { status: newStatus };
    if (newStatus === 'draft' && previousStatus === 'finished') {
      // Reset session for re-run
      updateData.startedAt = null;
      updateData.finishingAt = null;
      updateData.finishedAt = null;
    }

    const updatedSession = await this.prisma.session.update({
      where: { id: sessionId },
      data: updateData,
      include: { championship: true },
    });

    this.emitSessionStatusChanged(updatedSession, previousStatus);

    return updatedSession;
  }

  /**
   * Close connections
   */
  async close() {
    this.stopHeartbeat();
    if (this.gracePeriodTimer) {
      clearTimeout(this.gracePeriodTimer);
    }
    await this.prisma.$disconnect();
  }
}

export default ChampionshipSessionManager;
