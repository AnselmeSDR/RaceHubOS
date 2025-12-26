import { PrismaClient } from '@prisma/client';
import EventEmitter from 'events';

const DEFAULT_GRACE_PERIOD_MS = 30000;

/**
 * SessionService - Gestion de la logique session et emission vers clients
 *
 * Recoit les donnees formatees de SyncService et gere :
 * - Enregistrement des laps en DB
 * - Calcul des positions et gaps
 * - Detection fin de session (temps/tours)
 * - Emission des events aux clients
 *
 * Emet aussi des events internes via EventEmitter pour les autres services.
 */
export class SessionService extends EventEmitter {
  constructor(io) {
    super();
    this.io = io;
    this.prisma = new PrismaClient();
    this.syncService = null;

    // Session state
    this.activeSessionId = null;
    this.activeTrackId = null;
    this.currentPhase = 'practice';
    this.sessionConfig = null;
    this.sessionStatus = null;

    // Driver states
    this.sessionDrivers = [];

    // Grace period
    this.raceFinishTime = null;
    this.gracePeriodTimer = null;
    this.gracePeriodEndsAt = null;

    // Heartbeat
    this.heartbeatInterval = null;
  }

  setSyncService(syncService) {
    this.syncService = syncService;
  }

  // ==================== Event Handlers (called by SyncService) ====================

  /**
   * Handle lap data from SyncService
   * @param {{ controller: number, timestamp: number, lapTime: number, sector: number }} data
   */
  async handleLap(data) {
    const { controller, lapTime, sector } = data;

    // Only process finish line (sector 1) with valid lap time
    if (sector !== 1 || lapTime <= 0) {
      return;
    }

    const driver = this.getDriverByController(controller);
    if (!driver) {
      return;
    }

    // 1. Update RAM
    driver.totalLaps++;
    driver.totalTime += Math.round(lapTime);
    driver.lastLapTime = Math.round(lapTime);
    if (driver.bestLapTime === null || lapTime < driver.bestLapTime) {
      driver.bestLapTime = Math.round(lapTime);
    }

    // 2. Recalculate positions
    this.recalculatePositions();

    // 3. Save to DB
    await this.saveLap(driver, lapTime);
    await this.updateSessionDriver(driver);

    // 4. Emit leaderboard
    this.emitLeaderboard();

    // 5. Check session completion
    await this.checkSessionComplete();
  }

  // ==================== Session Lifecycle ====================

  /**
   * Load session from DB
   */
  async loadSession(sessionId) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        drivers: {
          include: { driver: true, car: true },
          orderBy: { controller: 'asc' },
        },
        track: true,
        championship: true,
      },
    });

    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    this.activeSessionId = session.id;
    this.activeTrackId = session.trackId;
    this.currentPhase = session.type === 'qualif' ? 'qualif' :
                        session.type === 'practice' ? 'practice' : 'race';

    this.sessionConfig = {
      duration: session.duration,
      maxLaps: session.maxLaps,
      gracePeriod: session.gracePeriod || DEFAULT_GRACE_PERIOD_MS,
      startedAt: session.startedAt,
      championshipId: session.championshipId,
    };
    this.sessionStatus = session.status;

    // Initialize driver states
    this.sessionDrivers = session.drivers.map(sd => ({
      id: sd.id,
      controller: sd.controller,
      driverId: sd.driverId,
      carId: sd.carId,
      driver: sd.driver,
      car: sd.car,
      position: sd.position || 0,
      totalLaps: sd.totalLaps || 0,
      totalTime: sd.totalTime || 0,
      bestLapTime: sd.bestLapTime || null,
      lastLapTime: sd.lastLapTime || null,
      gap: null,
    }));

    this.raceFinishTime = null;
    this.recalculatePositions();

    return session;
  }

  /**
   * Start session
   */
  async startSession(sessionId) {
    // Reset sync service
    await this.syncService?.reset();

    await this.prisma.session.update({
      where: { id: sessionId },
      data: { status: 'active', startedAt: new Date() },
    });

    await this.loadSession(sessionId);
    this.sessionStatus = 'active';
    this.sessionConfig.startedAt = new Date();

    // Start CU/Simulator
    await this.syncService?.startRace();
    this.syncService?.startPolling();

    // Start heartbeat
    this.startHeartbeat();

    this.emit('session:started', { sessionId });
    this.emitStatusChanged('active', 'ready');

    return this.getState();
  }

  /**
   * Pause session
   */
  async pauseSession() {
    if (!this.activeSessionId) return null;

    await this.prisma.session.update({
      where: { id: this.activeSessionId },
      data: { status: 'paused' },
    });

    const previousStatus = this.sessionStatus;
    this.sessionStatus = 'paused';

    // Stop CU/Simulator
    await this.syncService?.stopRace();

    this.emit('session:paused', { sessionId: this.activeSessionId });
    this.emitStatusChanged('paused', previousStatus);

    return { sessionId: this.activeSessionId };
  }

  /**
   * Resume session
   */
  async resumeSession() {
    if (!this.activeSessionId || this.sessionStatus !== 'paused') return null;

    await this.prisma.session.update({
      where: { id: this.activeSessionId },
      data: { status: 'active' },
    });

    this.sessionStatus = 'active';

    // Resume CU/Simulator
    await this.syncService?.startRace();

    this.emit('session:resumed', { sessionId: this.activeSessionId });
    this.emitStatusChanged('active', 'paused');

    return { sessionId: this.activeSessionId };
  }

  /**
   * Stop session manually
   */
  async stopSession() {
    if (!this.activeSessionId) return null;

    const sessionId = this.activeSessionId;
    await this.finishSession('manual_stop');
    // Note: finishSession() already calls stopRace() and emits session:finished

    return { sessionId };
  }

  /**
   * Reset for new session
   */
  async resetForNewSession() {
    this.stopHeartbeat();

    this.sessionDrivers = [];
    this.raceFinishTime = null;
    this.gracePeriodEndsAt = null;
    this.activeSessionId = null;
    this.activeTrackId = null;
    this.currentPhase = 'practice';
    this.sessionConfig = null;
    this.sessionStatus = null;

    if (this.gracePeriodTimer) {
      clearTimeout(this.gracePeriodTimer);
      this.gracePeriodTimer = null;
    }

    await this.syncService?.reset();
  }

  // ==================== Hardware Control ====================

  async startRace() {
    await this.syncService?.startRace();
  }

  async stopRace() {
    await this.syncService?.stopRace();
  }

  isConnected() {
    return this.syncService?.isConnected() || false;
  }

  // ==================== Position & Leaderboard ====================

  getDriverByController(controller) {
    return this.sessionDrivers.find(d => d.controller === controller);
  }

  recalculatePositions() {
    if (this.sessionDrivers.length === 0) return;

    const isRace = this.currentPhase === 'race';

    if (isRace) {
      this.sessionDrivers.sort((a, b) => {
        if (b.totalLaps !== a.totalLaps) return b.totalLaps - a.totalLaps;
        return a.totalTime - b.totalTime;
      });
    } else {
      this.sessionDrivers.sort((a, b) => {
        if (a.bestLapTime === null && b.bestLapTime === null) return 0;
        if (a.bestLapTime === null) return 1;
        if (b.bestLapTime === null) return -1;
        return a.bestLapTime - b.bestLapTime;
      });
    }

    const leader = this.sessionDrivers[0];

    for (let i = 0; i < this.sessionDrivers.length; i++) {
      const driver = this.sessionDrivers[i];
      driver.position = i + 1;

      if (i === 0) {
        driver.gap = null;
      } else if (isRace) {
        const lapDiff = leader.totalLaps - driver.totalLaps;
        if (lapDiff > 0) {
          driver.gap = lapDiff;
        } else {
          driver.gap = driver.totalTime - leader.totalTime;
        }
      } else {
        if (leader.bestLapTime && driver.bestLapTime) {
          driver.gap = driver.bestLapTime - leader.bestLapTime;
        } else {
          driver.gap = null;
        }
      }
    }
  }

  emitLeaderboard() {
    this.emit('session:leaderboard', this.sessionDrivers);
  }

  // ==================== Heartbeat ====================

  startHeartbeat() {
    this.stopHeartbeat();

    this.heartbeatInterval = setInterval(() => {
      if (!this.activeSessionId || !this.isActive()) {
        this.stopHeartbeat();
        return;
      }

      const elapsedTime = this.sessionConfig?.startedAt
        ? Date.now() - new Date(this.sessionConfig.startedAt).getTime()
        : 0;

      let remainingTime = null;
      if (this.sessionConfig?.duration) {
        remainingTime = Math.max(0, this.sessionConfig.duration - elapsedTime);
      }

      let remainingLaps = null;
      if (this.sessionConfig?.maxLaps) {
        const leaderLaps = Math.max(...this.sessionDrivers.map(d => d.totalLaps), 0);
        remainingLaps = Math.max(0, this.sessionConfig.maxLaps - leaderLaps);
      }

      let gracePeriodRemaining = null;
      if (this.sessionStatus === 'finishing' && this.gracePeriodEndsAt) {
        gracePeriodRemaining = Math.max(0, this.gracePeriodEndsAt - Date.now());
      }

      this.emit('session:heartbeat', {
        sessionId: this.activeSessionId,
        status: this.sessionStatus,
        elapsedTime,
        remainingTime,
        remainingLaps,
        gracePeriodRemaining,
      });
    }, 1000);
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // ==================== Session Completion ====================

  async checkSessionComplete() {
    if (!this.activeSessionId || !this.sessionConfig) return;
    if (this.sessionStatus !== 'active' && this.sessionStatus !== 'finishing') return;

    const { duration, maxLaps, gracePeriod, startedAt } = this.sessionConfig;

    let shouldStop = false;
    let shouldStartFinishing = false;
    let reason = '';

    // Check time limit
    if (duration && startedAt) {
      const elapsed = Date.now() - new Date(startedAt).getTime();
      if (elapsed >= duration) {
        if (this.sessionStatus !== 'finishing') {
          shouldStartFinishing = true;
          reason = 'time_elapsed';
        }
      }
    }

    // Check lap limit
    if (maxLaps && !shouldStop) {
      const maxLapsReached = this.sessionDrivers.some(d => d.totalLaps >= maxLaps);

      if (maxLapsReached) {
        if (this.sessionStatus !== 'finishing') {
          shouldStartFinishing = true;
          reason = 'leader_finished';
          this.raceFinishTime = Date.now();
        } else if (this.currentPhase === 'qualif') {
          const allFinished = this.sessionDrivers
            .filter(d => d.totalLaps > 0)
            .every(d => d.totalLaps >= maxLaps);
          if (allFinished) {
            shouldStop = true;
            reason = 'all_finished';
          }
        } else {
          if (this.raceFinishTime && Date.now() - this.raceFinishTime >= gracePeriod) {
            shouldStop = true;
            reason = 'grace_period_elapsed';
          }
        }
      }
    }

    if (shouldStartFinishing && !shouldStop) {
      await this.startFinishingPhase(reason);
    }

    if (shouldStop) {
      await this.finishSession(reason);
    }
  }

  async startFinishingPhase(reason) {
    await this.prisma.session.update({
      where: { id: this.activeSessionId },
      data: { status: 'finishing', finishingAt: new Date() },
    });

    const previousStatus = this.sessionStatus;
    this.sessionStatus = 'finishing';

    // Snapshot laps for DNF detection
    for (const driver of this.sessionDrivers) {
      await this.prisma.sessionDriver.update({
        where: { id: driver.id },
        data: { lapsAtFinishing: driver.totalLaps },
      });
    }

    const gracePeriod = this.sessionConfig.gracePeriod || DEFAULT_GRACE_PERIOD_MS;
    this.gracePeriodEndsAt = Date.now() + gracePeriod;

    this.emit('session:finishing', {
      sessionId: this.activeSessionId,
      reason,
      gracePeriodMs: gracePeriod,
      endsAt: new Date(Date.now() + gracePeriod).toISOString(),
    });

    this.emitStatusChanged('finishing', previousStatus);

    // Auto-finish after grace period
    this.gracePeriodTimer = setTimeout(async () => {
      if (this.sessionStatus === 'finishing') {
        await this.finishSession('grace_period_elapsed');
      }
    }, gracePeriod);
  }

  async finishSession(reason) {
    if (this.gracePeriodTimer) {
      clearTimeout(this.gracePeriodTimer);
      this.gracePeriodTimer = null;
    }

    const sessionId = this.activeSessionId;
    const previousStatus = this.sessionStatus;
    const championshipId = this.sessionConfig?.championshipId;

    // Calculate DNF
    await this.calculateDNF();

    // Save final positions
    await this.prisma.$transaction([
      ...this.sessionDrivers.map(driver =>
        this.prisma.sessionDriver.update({
          where: { id: driver.id },
          data: {
            finalPos: driver.position,
            totalLaps: driver.totalLaps,
            totalTime: driver.totalTime,
            bestLapTime: driver.bestLapTime,
            lastLapTime: driver.lastLapTime,
          },
        })
      ),
      this.prisma.session.update({
        where: { id: sessionId },
        data: { status: 'finished', finishedAt: new Date() },
      }),
    ]);

    // Broadcast to clients
    this.emit('session:finished', { sessionId, reason, championshipId });
    this.emitStatusChanged('finished', previousStatus);

    // Emit internal event for other services (ChampionshipManager)
    super.emit('sessionFinished', { sessionId, championshipId });

    // Stop CU/Simulator
    await this.syncService?.stopRace();

    // Reset state
    await this.resetForNewSession();
  }

  async calculateDNF() {
    for (const driver of this.sessionDrivers) {
      const sd = await this.prisma.sessionDriver.findUnique({
        where: { id: driver.id },
      });

      if (sd?.lapsAtFinishing !== null && sd.lapsAtFinishing > 0) {
        const isDNF = driver.totalLaps === sd.lapsAtFinishing;
        if (isDNF) {
          await this.prisma.sessionDriver.update({
            where: { id: driver.id },
            data: { isDNF: true },
          });
        }
      }
    }
  }

  // ==================== DB Operations ====================

  async saveLap(driver, lapTime) {
    await this.prisma.lap.create({
      data: {
        sessionId: this.activeSessionId,
        trackId: this.activeTrackId,
        driverId: driver.driverId,
        carId: driver.carId,
        controller: driver.controller,
        phase: this.currentPhase,
        lapNumber: driver.totalLaps,
        lapTime: lapTime,
      },
    });
  }

  async updateSessionDriver(driver) {
    await this.prisma.sessionDriver.update({
      where: { id: driver.id },
      data: {
        position: driver.position,
        totalLaps: driver.totalLaps,
        totalTime: driver.totalTime,
        bestLapTime: driver.bestLapTime,
        lastLapTime: driver.lastLapTime,
      },
    });
  }

  // ==================== Session Operations ====================

  /**
   * Create a session with drivers from track's controller config
   * @param {Object} params - { type, name, trackId, championshipId, duration, maxLaps, order, gridFromQualifying }
   */
  async createSession(params) {
    const { type, name, trackId, championshipId, duration, maxLaps, order, gridFromQualifying } = params;

    if (!['practice', 'qualif', 'race'].includes(type)) {
      throw new Error('Invalid session type. Must be practice, qualif, or race');
    }

    // Resolve trackId from championship if needed
    let finalTrackId = trackId;
    if (championshipId && !trackId) {
      const championship = await this.prisma.championship.findUnique({ where: { id: championshipId } });
      if (!championship?.trackId) {
        throw new Error('Championship has no track assigned');
      }
      finalTrackId = championship.trackId;
    }

    if (!finalTrackId) {
      throw new Error('trackId or championshipId required');
    }

    // Create session
    const session = await this.prisma.session.create({
      data: {
        name: name || (type === 'qualif' ? 'Qualifying' : type === 'race' ? 'Race' : 'Practice'),
        type,
        status: 'draft',
        trackId: finalTrackId,
        championshipId: championshipId || null,
        duration: duration || null,
        maxLaps: maxLaps || null,
        order: order ?? 0,
      },
    });

    // Get controller configs for this track
    const configs = await this.prisma.controllerConfig.findMany({
      where: { trackId: finalTrackId },
      include: { driver: true, car: true },
    });

    // Get grid order from last qualifying if requested (for race)
    let gridOrder = null;
    if (type === 'race' && gridFromQualifying) {
      const lastQualifying = await this.prisma.session.findFirst({
        where: { trackId: finalTrackId, type: 'qualif', status: 'finished' },
        orderBy: { finishedAt: 'desc' },
        include: { drivers: { orderBy: { finalPos: 'asc' } } },
      });
      if (lastQualifying) {
        gridOrder = lastQualifying.drivers.map(d => d.driverId);
      }
    }

    // Add drivers from controller config
    for (let i = 0; i < configs.length; i++) {
      const config = configs[i];
      if (config.driverId && config.carId) {
        const gridPos = gridOrder
          ? (gridOrder.indexOf(config.driverId) + 1) || configs.length
          : i + 1;

        await this.prisma.sessionDriver.create({
          data: {
            sessionId: session.id,
            driverId: config.driverId,
            carId: config.carId,
            controller: config.controller,
            gridPos: type === 'race' ? gridPos : null,
          },
        });
      }
    }

    // Return full session with relations
    return await this.prisma.session.findUnique({
      where: { id: session.id },
      include: {
        track: true,
        championship: true,
        drivers: {
          include: { driver: true, car: true },
          orderBy: type === 'race' ? { gridPos: 'asc' } : { controller: 'asc' },
        },
      },
    });
  }

  /**
   * Reset session to ready state
   * - Practice: soft delete laps (for stats)
   * - Qualif/Race: hard delete laps
   */
  async resetSession(sessionId) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Stop if this is the active session
    if (this.activeSessionId === sessionId) {
      await this.resetForNewSession();
    }

    // Practice: soft delete (keep for stats)
    // Qualif/Race: hard delete
    if (session.type === 'practice') {
      await this.prisma.lap.updateMany({
        where: { sessionId, softDeletedAt: null },
        data: { softDeletedAt: new Date() },
      });
    } else {
      await this.prisma.lap.deleteMany({ where: { sessionId } });
    }

    // Delete events
    await this.prisma.raceEvent.deleteMany({ where: { sessionId } });

    // Reset session driver stats
    await this.prisma.sessionDriver.updateMany({
      where: { sessionId },
      data: {
        position: null,
        finalPos: null,
        totalLaps: 0,
        totalTime: 0,
        bestLapTime: null,
        lastLapTime: null,
        isDNF: false,
        lapsAtFinishing: null,
      },
    });

    // Reset session to ready
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { status: 'ready', startedAt: null, finishingAt: null, finishedAt: null },
    });

    // Emit internal event for ChampionshipService
    if (session.championshipId) {
      super.emit('sessionReset', { sessionId, championshipId: session.championshipId });
    }
  }

  /**
   * Delete a session and all related data
   */
  async deleteSession(sessionId) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Stop if this is the active session
    if (this.activeSessionId === sessionId) {
      await this.resetForNewSession();
    }

    const championshipId = session.championshipId;

    // Clear TrackRecord references
    await this.prisma.trackRecord.updateMany({
      where: { sessionId },
      data: { sessionId: null },
    });

    // Delete related data
    await this.prisma.lap.deleteMany({ where: { sessionId } });
    await this.prisma.raceEvent.deleteMany({ where: { sessionId } });
    await this.prisma.sessionDriver.deleteMany({ where: { sessionId } });
    await this.prisma.session.delete({ where: { id: sessionId } });

    // Emit internal event for ChampionshipService
    if (championshipId) {
      super.emit('sessionDeleted', { sessionId, championshipId });
    }
  }

  // ==================== Emit Helpers ====================

  /**
   * Emit to WebSocket clients (shadows EventEmitter.emit)
   */
  emit(event, data) {
    this.io?.emit(event, data);
  }

  emitStatusChanged(status, previousStatus) {
    this.emit('session:status_changed', {
      sessionId: this.activeSessionId,
      championshipId: this.sessionConfig?.championshipId,
      status,
      previousStatus,
      timestamp: new Date().toISOString(),
    });
  }

  // ==================== Getters ====================

  getState() {
    return {
      activeSessionId: this.activeSessionId,
      activeTrackId: this.activeTrackId,
      currentPhase: this.currentPhase,
      sessionStatus: this.sessionStatus,
      sessionDrivers: this.sessionDrivers,
    };
  }

  getLeaderboard() {
    return this.sessionDrivers;
  }

  isActive() {
    return this.sessionStatus === 'active' || this.sessionStatus === 'finishing';
  }

  async close() {
    await this.resetForNewSession();
    await this.prisma.$disconnect();
  }
}

export default SessionService;
