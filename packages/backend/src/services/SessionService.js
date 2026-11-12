import { createPrismaClient } from '../lib/prisma.js';
import EventEmitter from 'events';
import { SessionStatus, SessionType, isSessionType } from '@racehubos/shared';
import { bestLapOf, gapTo, compareEntries, rankEntries } from '../lib/sessions/ranking.js';
import { pauseDurations, racingTime } from '../lib/sessions/clock.js';
import { hasDriverFinished, isDNF, nextStep } from '../lib/sessions/finish.js';
import { cuSettingsOf } from '../lib/sessions/carSettings.js';
import { lapHistoryOf, liveDriverOf, pausesOf } from '../lib/sessions/liveState.js';
import { createSessionFromControllers, resetStoredSession } from '../lib/sessions/storage.js';
import { PEOPLE_INCLUDE } from '../lib/divisions.js';
import { softDeleteSession } from '../lib/softDelete.js';

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
    this.prisma = createPrismaClient();
    this.syncService = null;

    // Session state
    this.activeSessionId = null;
    this.activeTrackId = null;
    this.currentPhase = SessionType.PRACTICE;
    this.sessionConfig = null;
    this.sessionStatus = null;

    // Driver states
    this.sessionDrivers = [];
    this.previousPositions = new Map(); // controller -> previous position
    this.displayedDeltas = new Map(); // controller -> delta to display

    // Grace period
    this.gracePeriodTimer = null;
    this.gracePeriodEndsAt = null;

    // Heartbeat
    this.heartbeatInterval = null;

    // Lap history for balancing sessions (controller -> [{lapNumber, lapTime}])
    this.lapHistory = new Map();
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

    // Ignore stale hardware events when there is no running session.
    if (!this.activeSessionId || !this.isActive()) return;
    // Only process finish line (sector 1) with valid lap time
    if (sector !== 1 || lapTime <= 0) return;

    const driver = this.getDriverByController(controller);
    if (!driver) return;

    // A driver who has already crossed their finish line must not record
    // additional laps while the other drivers use the grace period.
    if (this.hasDriverFinished(driver)) return;

    // Every crossing counts as a lap, the first one included
    driver.crossings++;

    // Balancing: ignore laps beyond maxLaps per controller
    const maxLaps = this.sessionConfig?.maxLaps;
    const isBalancing = this.currentPhase === SessionType.BALANCING;
    if (isBalancing && maxLaps && driver.totalLaps >= maxLaps) return;

    // 1. Update RAM
    const roundedLap = Math.round(lapTime);
    driver.totalLaps++;
    driver.lastLapTime = roundedLap;

    // Track lap history for balancing chart
    if (isBalancing) {
      if (!this.lapHistory.has(controller)) this.lapHistory.set(controller, []);
      this.lapHistory.get(controller).push({ lapNumber: driver.totalLaps, lapTime: roundedLap });
    }

    const previousSessionBest = this.getSessionBestLapTime();
    if (driver.bestLapTime === null || lapTime < driver.bestLapTime) driver.bestLapTime = roundedLap;
    if (previousSessionBest === null || roundedLap < previousSessionBest) this.emitBestLap(driver, roundedLap);

    // Only accumulate time up to maxLaps (for race classification)
    // Extra laps during grace period don't count toward total time
    if (!maxLaps || driver.totalLaps <= maxLaps) driver.totalTime += roundedLap;

    // 2. Recalculate positions (pass controller who just completed a lap)
    this.recalculatePositions(controller);

    // 3. Save to DB
    await this.saveLap(driver, lapTime);
    await this.updateSessionDriver(driver);

    // 4. Emit leaderboard
    this.emitLeaderboard();

    // 5. Throttle car if this driver has met the finish condition
    await this.throttleIfFinished(driver);

    // 6. Check session completion
    await this.checkSessionComplete();
  }

  emitBestLap(driver, lapTime) {
    this.emit('session:bestlap', {
      controller: driver.controller,
      driverName: driver.driver?.name || null,
      carBrand: driver.car?.brand || null,
      carModel: driver.car?.model || null,
      sessionType: this.currentPhase,
      lapTime,
      totalLaps: driver.totalLaps,
      maxLapsCompleted: Math.max(...this.sessionDrivers.map((d) => d.totalLaps)),
    });
  }

  /**
   * Check whether a driver has completed their individual finish condition.
   * - Lap-based race: the configured lap limit has been reached.
   * - Time-based race: one final lap has been completed after the checkered flag.
   */
  hasDriverFinished(driver) {
    return hasDriverFinished(driver, { maxLaps: this.sessionConfig?.maxLaps, status: this.sessionStatus });
  }

  /**
   * Reduce speed to 1 for a driver who has completed their finish condition.
   * Other drivers keep their normal speed.
   */
  async throttleIfFinished(driver) {
    if (driver._throttled) return;
    if (!this.hasDriverFinished(driver)) return;

    const device = this.syncService?.getDevice();
    if (!device?.setSpeed) return;

    try {
      await device.setSpeed(driver.controller, 1);
      driver._throttled = true;
    } catch (err) {
      console.warn('[SessionService] throttle failed:', err.message);
    }
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
          include: PEOPLE_INCLUDE,
          orderBy: { controller: 'asc' },
        },
        track: true,
        championship: true,
      },
    });
    if (!session) throw new Error(`Session ${sessionId} not found`);

    this.activeSessionId = session.id;
    this.activeTrackId = session.trackId;
    // A lap's phase is its session's type; an unknown type runs as a race
    this.currentPhase = isSessionType(session.type) ? session.type : SessionType.RACE;

    // Reset position tracking for new session
    this.previousPositions.clear();
    this.displayedDeltas.clear();

    this.sessionConfig = {
      maxDuration: session.maxDuration,
      maxLaps: session.maxLaps,
      gracePeriod: session.gracePeriod || DEFAULT_GRACE_PERIOD_MS,
      startedAt: session.startedAt,
      championshipId: session.championshipId,
      pauses: pausesOf(session.pauses),
    };
    this.sessionStatus = session.status;
    this.sessionDrivers = session.drivers.map(liveDriverOf);

    // Load lap history for balancing sessions (needed for chart data)
    this.lapHistory =
      session.type === SessionType.BALANCING
        ? lapHistoryOf(await this.prisma.lap.findMany({ where: { sessionId: session.id, deletedAt: null } }))
        : new Map();

    this.recalculatePositions();
    this.emitLeaderboard();

    // Caught finishing (a restart during the grace period): finish when it would have ended
    if (session.status === SessionStatus.FINISHING && session.finishingAt) {
      const elapsed = Date.now() - new Date(session.finishingAt).getTime();
      this.armGracePeriod(Math.max(0, this.sessionConfig.gracePeriod - elapsed));
    }

    return session;
  }

  /** Finishes the session once `delay` ms are over, if it is still finishing then. */
  armGracePeriod(delay) {
    this.gracePeriodEndsAt = Date.now() + delay;
    const finish = async () => {
      if (this.sessionStatus === SessionStatus.FINISHING) await this.finishSession('grace_period_elapsed');
    };
    if (delay > 0) this.gracePeriodTimer = setTimeout(finish, delay);
    else setImmediate(finish);
  }

  /**
   * Start session
   * Puts session in 'active' state and triggers CU lights (1/5).
   * User must click START buttons to advance through lights (2/5...5/5) then race starts.
   * Note: startedAt is set later by onRaceStart() when CU goes to racing (GO!)
   */
  async startSession(sessionId) {
    // Check device connection
    if (!this.syncService?.isConnected()) {
      throw new Error('No device connected. Connect a CU or Simulator first.');
    }

    // Reset sync service
    await this.syncService?.reset();

    await this.prisma.session.update({
      where: { id: sessionId },
      data: { status: SessionStatus.ACTIVE },
    });

    await this.loadSession(sessionId);
    this.sessionStatus = 'active';

    // Start polling to receive CU status and lap data
    this.syncService?.startPolling();

    // Put CU in L1 state (waiting for START)
    await this.syncService?.prepareRace();

    // Apply each car's profile (speed/brake/fuel) to the CU
    // Done AFTER prepareRace so the START press isn't blocked by 18 setword commands
    await this.applyCarConfigs();

    // Start heartbeat
    this.startHeartbeat();

    this.emit('session:started', { sessionId });
    this.emitStatusChanged('active', 'draft');

    return this.getState();
  }

  /**
   * Pause session
   */
  async pauseSession() {
    if (!this.activeSessionId) return null;

    // Add pause entry to history
    const pauses = this.sessionConfig?.pauses || [];
    pauses.push({ start: Date.now(), end: null });
    this.sessionConfig.pauses = pauses;

    await this.prisma.session.update({
      where: { id: this.activeSessionId },
      data: { status: SessionStatus.PAUSED, pauses: JSON.stringify(pauses) },
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
   * Puts CU in lights mode. Pause closes and chrono resumes at GO (via onRaceStart)
   */
  async resumeSession() {
    if (!this.activeSessionId || this.sessionStatus !== SessionStatus.PAUSED) return null;

    // Set status to active but keep pause open until GO
    await this.prisma.session.update({
      where: { id: this.activeSessionId },
      data: { status: SessionStatus.ACTIVE },
    });

    this.sessionStatus = 'active';

    // Start CU lights sequence (pause closes at GO via onRaceStart)
    await this.syncService?.prepareRace();

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
    // finishSession() stops the race and tells everyone
    await this.finishSession('manual_stop');
    return { sessionId };
  }

  /**
   * Reset for new session
   */
  async resetForNewSession() {
    this.stopHeartbeat();

    // Keep sessionDrivers for leaderboard queries until new session loads
    this.previousPositions.clear();
    this.displayedDeltas.clear();
    this.gracePeriodEndsAt = null;
    this.activeSessionId = null;
    this.activeTrackId = null;
    this.currentPhase = SessionType.PRACTICE;
    this.sessionConfig = null;
    this.sessionStatus = null;
    this.lapHistory = new Map();

    clearTimeout(this.gracePeriodTimer);
    this.gracePeriodTimer = null;

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

  /**
   * Called by SyncService when CU transitions to racing (GO!)
   * - First start: sets startedAt
   * - Resume from pause: closes pause entry
   */
  async onRaceStart() {
    if (!this.activeSessionId || this.sessionStatus !== SessionStatus.ACTIVE) return;

    const now = Date.now();
    const pauses = this.sessionConfig?.pauses || [];
    const lastPause = pauses.at(-1);

    if (lastPause && lastPause.end === null) {
      // Resuming from pause: close it
      lastPause.end = now;
      await this.prisma.session.update({
        where: { id: this.activeSessionId },
        data: { pauses: JSON.stringify(pauses) },
      });
      this.emit('session:race_resumed', { sessionId: this.activeSessionId, resumedAt: new Date(now).toISOString() });
    } else if (!this.sessionConfig.startedAt) {
      // First start
      const startedAt = new Date(now);
      this.sessionConfig.startedAt = startedAt;
      await this.prisma.session.update({ where: { id: this.activeSessionId }, data: { startedAt } });
      this.emit('session:race_started', { sessionId: this.activeSessionId, startedAt: startedAt.toISOString() });
    }
  }

  // ==================== Position & Leaderboard ====================

  getDriverByController(controller) {
    return this.sessionDrivers.find((d) => d.controller === controller);
  }

  getSessionBestLapTime() {
    return bestLapOf(this.sessionDrivers);
  }

  /**
   * Ranks the drivers in place with their gaps. A driver whose place changed shows by how much
   * (`positionDelta`), until their next lap without a change (`lapController` just lapped).
   */
  recalculatePositions(lapController = null) {
    if (this.sessionDrivers.length === 0) return;

    this.sessionDrivers.sort(compareEntries(this.currentPhase));
    const [leader] = this.sessionDrivers;

    for (const [i, driver] of this.sessionDrivers.entries()) {
      const newPosition = i + 1;
      const previousPosition = this.previousPositions.get(driver.controller);

      if (previousPosition !== undefined && previousPosition !== newPosition) {
        this.displayedDeltas.set(driver.controller, previousPosition - newPosition);
      } else if (driver.controller === lapController) {
        this.displayedDeltas.set(driver.controller, 0);
      }
      // Other drivers with no position change keep their existing delta

      driver.positionDelta = this.displayedDeltas.get(driver.controller) || 0;
      driver.position = newPosition;
      this.previousPositions.set(driver.controller, newPosition);
      driver.gap = i === 0 ? null : gapTo(leader, driver, this.currentPhase);
    }
  }

  getEnrichedLeaderboard() {
    if (this.currentPhase === SessionType.BALANCING && this.lapHistory.size > 0) {
      return this.sessionDrivers.map((d) => ({ ...d, laps: this.lapHistory.get(d.controller) || [] }));
    }
    return this.sessionDrivers;
  }

  emitLeaderboard() {
    this.emit('session:leaderboard', this.getEnrichedLeaderboard());
  }

  /** Stored entries ranked, with their gaps and positions: for the API, outside the live session. */
  static calculateDriverGaps(drivers, sessionType) {
    return rankEntries(drivers, sessionType);
  }

  // ==================== Heartbeat ====================

  startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => this.beat(), 1000);
  }

  stopHeartbeat() {
    clearInterval(this.heartbeatInterval);
    this.heartbeatInterval = null;
  }

  /**
   * One heartbeat: the racing time and what is left of it, laps or grace period, sent with the
   * leaderboard. Time up waves the flag (balancing finishes at once); finishing, it checks
   * whether everyone is home.
   */
  async beat() {
    if (!this.activeSessionId || !this.isActive()) {
      this.stopHeartbeat();
      return;
    }

    const now = Date.now();
    const pauses = this.sessionConfig?.pauses || [];
    const { total: totalPauseDuration, current: currentPauseDuration } = pauseDurations(pauses, now);
    const elapsedTime = racingTime(this.sessionConfig?.startedAt, totalPauseDuration, now);

    let remainingTime = null;
    if (this.sessionConfig?.maxDuration) {
      remainingTime = Math.max(0, this.sessionConfig.maxDuration - elapsedTime);
      if (remainingTime === 0 && this.sessionStatus === SessionStatus.ACTIVE) {
        if (this.currentPhase === SessionType.BALANCING) await this.finishSession('time_elapsed');
        else await this.startFinishingPhase('time_elapsed');
      }
    }

    let remainingLaps = null;
    if (this.sessionConfig?.maxLaps) {
      const leaderLaps = Math.max(...this.sessionDrivers.map((d) => d.totalLaps), 0);
      remainingLaps = Math.max(0, this.sessionConfig.maxLaps - leaderLaps);
    }

    let gracePeriodRemaining = null;
    if (this.sessionStatus === SessionStatus.FINISHING && this.gracePeriodEndsAt) {
      gracePeriodRemaining = Math.max(0, this.gracePeriodEndsAt - Date.now());
      await this.checkSessionComplete();
    }

    this.emit('session:heartbeat', {
      sessionId: this.activeSessionId,
      status: this.sessionStatus,
      startedAt: this.sessionConfig?.startedAt,
      elapsedTime,
      remainingTime,
      remainingLaps,
      gracePeriodRemaining,
      pauseDuration: currentPauseDuration,
      totalPauseDuration,
      pauses,
      leaderboard: this.getEnrichedLeaderboard(),
    });
  }

  // ==================== Session Completion ====================

  /** After a lap or a heartbeat: waves the flag or finishes the session when its end has come. */
  async checkSessionComplete() {
    if (!this.activeSessionId || !this.sessionConfig) return;

    const step = nextStep({
      phase: this.currentPhase,
      status: this.sessionStatus,
      maxLaps: this.sessionConfig.maxLaps,
      drivers: this.sessionDrivers,
    });
    if (step?.action === 'flag') await this.startFinishingPhase(step.reason);
    if (step?.action === 'finish') await this.finishSession(step.reason);
  }

  /** The checkered flag: each driver's laps are noted, and the grace period starts. */
  async startFinishingPhase(reason) {
    await this.prisma.session.update({
      where: { id: this.activeSessionId },
      data: { status: SessionStatus.FINISHING, finishingAt: new Date() },
    });

    const previousStatus = this.sessionStatus;
    this.sessionStatus = 'finishing';

    // Snapshot laps for checkered flag logic (finish current lap)
    for (const driver of this.sessionDrivers) {
      driver.lapsAtFinishing = driver.totalLaps;
      await this.prisma.sessionDriver.update({
        where: { id: driver.id },
        data: { lapsAtFinishing: driver.totalLaps },
      });
    }

    const gracePeriod = this.sessionConfig.gracePeriod || DEFAULT_GRACE_PERIOD_MS;
    this.emit('session:finishing', {
      sessionId: this.activeSessionId,
      reason,
      gracePeriodMs: gracePeriod,
      endsAt: new Date(Date.now() + gracePeriod).toISOString(),
    });
    this.emitStatusChanged('finishing', previousStatus);

    this.armGracePeriod(gracePeriod);
  }

  async finishSession(reason) {
    // Guard against multiple concurrent/repeated calls (grace timer + heartbeat + lap event)
    if (this.sessionStatus === SessionStatus.FINISHED || this._finishing) return;
    this._finishing = true;

    clearTimeout(this.gracePeriodTimer);
    this.gracePeriodTimer = null;

    const sessionId = this.activeSessionId;
    const previousStatus = this.sessionStatus;
    const championshipId = this.sessionConfig?.championshipId;

    await this.calculateDNF();

    // Save final positions
    await this.prisma.$transaction([
      ...this.sessionDrivers.map((driver) =>
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
        data: { status: SessionStatus.FINISHED, finishedAt: new Date() },
      }),
    ]);

    // Broadcast to clients with final leaderboard
    this.emit('session:finished', {
      sessionId,
      reason,
      championshipId,
      sessionType: this.currentPhase,
      leaderboard: this.getEnrichedLeaderboard(),
    });
    this.emitStatusChanged('finished', previousStatus);

    // Emit internal event for other services (ChampionshipManager)
    super.emit('sessionFinished', { sessionId, championshipId });

    // Stop CU/Simulator
    await this.syncService?.stopRace();

    await this.resetForNewSession();
    this._finishing = false;
  }

  /**
   * Sends each of the 6 controllers its car's settings (speed, brake, fuel), the factory ones
   * for a free slot. At session start, and at its end to restore a throttled or stopped car.
   */
  async applyCarConfigs() {
    const device = this.syncService?.getDevice();
    if (!device?.setSpeed) return;

    const driverByController = new Map(this.sessionDrivers.map((d) => [d.controller, d]));
    for (let addr = 0; addr < 6; addr++) {
      const driver = driverByController.get(addr);
      const { speed, brake, fuel } = cuSettingsOf(driver?.car);
      try {
        await device.setSpeed(addr, speed);
        if (device.setBrake) await device.setBrake(addr, brake);
        if (device.setFuel) await device.setFuel(addr, fuel);
        if (driver) driver._throttled = false;
      } catch (err) {
        console.warn('[SessionService] applyCarConfigs failed for addr', addr, ':', err.message);
      }
    }
  }

  /** Marks DNF who was on track at the flag but did not finish; the flag's laps come from the database. */
  async calculateDNF() {
    const maxLaps = this.sessionConfig?.maxLaps;
    for (const driver of this.sessionDrivers) {
      const entry = await this.prisma.sessionDriver.findUnique({ where: { id: driver.id } });
      if (!isDNF(driver.totalLaps, entry?.lapsAtFinishing ?? null, maxLaps)) continue;
      driver.isDNF = true;
      await this.prisma.sessionDriver.update({ where: { id: driver.id }, data: { isDNF: true } });
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
        lapTime,
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
   * @param {Object} params - { type, name, trackId, championshipId, maxDuration, maxLaps, order, gridFromQualifying, status }
   */
  createSession(params) {
    return createSessionFromControllers(this.prisma, params);
  }

  /** The stored session, or an error; the running one is stopped first. */
  async leaveSession(sessionId) {
    const session = await this.prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) throw new Error(`Session ${sessionId} not found`);
    if (this.activeSessionId === sessionId) await this.resetForNewSession();
    return session;
  }

  /** Back to draft, its laps hidden (kept for the statistics); a championship is told. */
  async resetSession(sessionId) {
    const session = await this.leaveSession(sessionId);
    // Send stop signal to CU/Simulator
    await this.syncService?.stopRace();
    await resetStoredSession(this.prisma, sessionId);
    if (session.championshipId) super.emit('sessionReset', { sessionId, championshipId: session.championshipId });
  }

  /** Hides the session with everything recorded in it; a championship is told. */
  async deleteSession(sessionId) {
    const session = await this.leaveSession(sessionId);
    await softDeleteSession(this.prisma, sessionId);
    if (session.championshipId) super.emit('sessionDeleted', { sessionId, championshipId: session.championshipId });
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
    return this.getEnrichedLeaderboard();
  }

  isActive() {
    return ['active', 'paused', 'finishing'].includes(this.sessionStatus);
  }

  async close() {
    await this.resetForNewSession();
    await this.prisma.$disconnect();
  }
}

export default SessionService;
