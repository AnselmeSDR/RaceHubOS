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
    this.previousPositions = new Map(); // controller -> previous position
    this.displayedDeltas = new Map(); // controller -> delta to display

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

    // Track crossings - first crossing is start, doesn't count as lap
    // const isFirstCrossing = driver.crossings === 0; // DISABLED: count first lap
    driver.crossings++;

    // if (isFirstCrossing) { // DISABLED
      // // First crossing = crossing start line from grid, not a lap
      // this.emitLeaderboard();
    // }

    // 1. Update RAM
    driver.totalLaps++;
    driver.lastLapTime = Math.round(lapTime);
    if (driver.bestLapTime === null || lapTime < driver.bestLapTime) {
      driver.bestLapTime = Math.round(lapTime);
    }

    // Only accumulate time up to maxLaps (for race classification)
    // Extra laps during grace period don't count toward total time
    const maxLaps = this.sessionConfig?.maxLaps;
    if (!maxLaps || driver.totalLaps <= maxLaps) {
      driver.totalTime += Math.round(lapTime);
    }

    // 2. Recalculate positions (pass controller who just completed a lap)
    this.recalculatePositions(controller);

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

    // Reset position tracking for new session
    if (!this.previousPositions) {
      this.previousPositions = new Map();
    } else {
      this.previousPositions.clear();
    }
    if (!this.displayedDeltas) {
      this.displayedDeltas = new Map();
    } else {
      this.displayedDeltas.clear();
    }

    this.sessionConfig = {
      maxDuration: session.maxDuration,
      maxLaps: session.maxLaps,
      gracePeriod: session.gracePeriod || DEFAULT_GRACE_PERIOD_MS,
      startedAt: session.startedAt,
      championshipId: session.championshipId,
      pauses: session.pauses ? JSON.parse(session.pauses) : [],
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
      lapsAtFinishing: sd.lapsAtFinishing ?? null, // For checkered flag logic
      gap: null,
      crossings: sd.totalLaps || 0, // Track line crossings (first doesn't count as lap)
    }));

    this.raceFinishTime = null;
    this.recalculatePositions();
    this.emitLeaderboard();

    // If session is in finishing state, recreate grace period timer
    if (session.status === 'finishing' && session.finishingAt) {
      const gracePeriod = this.sessionConfig.gracePeriod || DEFAULT_GRACE_PERIOD_MS;
      const elapsed = Date.now() - new Date(session.finishingAt).getTime();
      const remaining = Math.max(0, gracePeriod - elapsed);

      this.gracePeriodEndsAt = Date.now() + remaining;

      if (remaining > 0) {
        this.gracePeriodTimer = setTimeout(async () => {
          if (this.sessionStatus === 'finishing') {
            await this.finishSession('grace_period_elapsed');
          }
        }, remaining);
      } else {
        // Grace period already elapsed, finish immediately
        setImmediate(async () => {
          if (this.sessionStatus === 'finishing') {
            await this.finishSession('grace_period_elapsed');
          }
        });
      }
    }

    return session;
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
      data: { status: 'active' },
    });

    await this.loadSession(sessionId);
    this.sessionStatus = 'active';

    // Start polling to receive CU status and lap data
    this.syncService?.startPolling();

    // Put CU in L1 state (waiting for START)
    await this.syncService?.prepareRace();

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

    const now = Date.now();

    // Add pause entry to history
    const pauses = this.sessionConfig?.pauses || [];
    pauses.push({ start: now, end: null });
    this.sessionConfig.pauses = pauses;

    await this.prisma.session.update({
      where: { id: this.activeSessionId },
      data: { status: 'paused', pauses: JSON.stringify(pauses) },
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
    if (!this.activeSessionId || this.sessionStatus !== 'paused') return null;

    // Set status to active but keep pause open until GO
    await this.prisma.session.update({
      where: { id: this.activeSessionId },
      data: { status: 'active' },
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
    if (this.previousPositions) {
      this.previousPositions.clear();
    }
    if (this.displayedDeltas) {
      this.displayedDeltas.clear();
    }
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

  /**
   * Called by SyncService when CU transitions to racing (GO!)
   * - First start: sets startedAt
   * - Resume from pause: closes pause entry
   */
  async onRaceStart() {
    if (!this.activeSessionId || this.sessionStatus !== 'active') return;

    const now = Date.now();

    // Check if resuming from pause (has open pause entry)
    const pauses = this.sessionConfig?.pauses || [];
    const lastPause = pauses[pauses.length - 1];
    const isResumingFromPause = lastPause && lastPause.end === null;

    if (isResumingFromPause) {
      // Close the pause entry
      lastPause.end = now;

      await this.prisma.session.update({
        where: { id: this.activeSessionId },
        data: { pauses: JSON.stringify(pauses) },
      });

      this.emit('session:race_resumed', {
        sessionId: this.activeSessionId,
        resumedAt: new Date(now).toISOString(),
      });
    } else if (!this.sessionConfig.startedAt) {
      // First start - set startedAt
      const startedAt = new Date(now);
      this.sessionConfig.startedAt = startedAt;

      await this.prisma.session.update({
        where: { id: this.activeSessionId },
        data: { startedAt },
      });

      this.emit('session:race_started', {
        sessionId: this.activeSessionId,
        startedAt: startedAt.toISOString(),
      });
    }
  }

  // ==================== Position & Leaderboard ====================

  getDriverByController(controller) {
    return this.sessionDrivers.find(d => d.controller === controller);
  }

  recalculatePositions(lapController = null) {
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
      const newPosition = i + 1;
      const previousPosition = this.previousPositions.get(driver.controller);

      if (previousPosition !== undefined && previousPosition !== newPosition) {
        // Position changed - update delta for this driver
        this.displayedDeltas.set(driver.controller, previousPosition - newPosition);
      } else if (driver.controller === lapController) {
        // This driver just completed a lap but position didn't change - clear their delta
        this.displayedDeltas.set(driver.controller, 0);
      }
      // Other drivers with no position change keep their existing delta

      // Get displayed delta
      driver.positionDelta = this.displayedDeltas.get(driver.controller) || 0;

      // Update position
      driver.position = newPosition;

      // Store current position for next comparison
      this.previousPositions.set(driver.controller, newPosition);

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

  /**
   * Static method to calculate gaps on drivers array
   * Used by API routes when returning session data
   */
  static calculateDriverGaps(drivers, sessionType) {
    if (!drivers || drivers.length === 0) return drivers;

    const isRace = sessionType === 'race';
    const sorted = [...drivers].sort((a, b) => {
      if (isRace) {
        if (b.totalLaps !== a.totalLaps) return b.totalLaps - a.totalLaps;
        return a.totalTime - b.totalTime;
      } else {
        if (a.bestLapTime === null && b.bestLapTime === null) return 0;
        if (a.bestLapTime === null) return 1;
        if (b.bestLapTime === null) return -1;
        return a.bestLapTime - b.bestLapTime;
      }
    });

    const leader = sorted[0];
    return sorted.map((driver, i) => {
      let gap = null;
      if (i > 0 && leader) {
        if (isRace) {
          const lapDiff = leader.totalLaps - driver.totalLaps;
          gap = lapDiff > 0 ? lapDiff : driver.totalTime - leader.totalTime;
        } else {
          if (leader.bestLapTime && driver.bestLapTime) {
            gap = driver.bestLapTime - leader.bestLapTime;
          }
        }
      }
      return { ...driver, gap, position: i + 1 };
    });
  }

  // ==================== Heartbeat ====================

  startHeartbeat() {
    this.stopHeartbeat();

    this.heartbeatInterval = setInterval(async () => {
      if (!this.activeSessionId || !this.isActive()) {
        this.stopHeartbeat();
        return;
      }

      const now = Date.now();

      // Calculate total pause duration from pauses array
      const pauses = this.sessionConfig?.pauses || [];
      let totalPauseDuration = 0;
      let currentPauseDuration = null;

      for (const p of pauses) {
        if (p.end) {
          totalPauseDuration += p.end - p.start;
        } else {
          // Open pause (currently paused)
          currentPauseDuration = now - p.start;
          totalPauseDuration += currentPauseDuration;
        }
      }

      // Elapsed racing time = wall clock time - pause time
      let elapsedTime = 0;
      if (this.sessionConfig?.startedAt) {
        const wallTime = now - new Date(this.sessionConfig.startedAt).getTime();
        elapsedTime = wallTime - totalPauseDuration;
      }

      let remainingTime = null;
      if (this.sessionConfig?.maxDuration) {
        remainingTime = Math.max(0, this.sessionConfig.maxDuration - elapsedTime);

        // Checkered flag: start finishing phase when time is up
        if (remainingTime === 0 && this.sessionStatus === 'active') {
          await this.startFinishingPhase('time_elapsed');
        }
      }

      let remainingLaps = null;
      if (this.sessionConfig?.maxLaps) {
        const leaderLaps = Math.max(...this.sessionDrivers.map(d => d.totalLaps), 0);
        remainingLaps = Math.max(0, this.sessionConfig.maxLaps - leaderLaps);
      }

      let gracePeriodRemaining = null;
      if (this.sessionStatus === 'finishing' && this.gracePeriodEndsAt) {
        gracePeriodRemaining = Math.max(0, this.gracePeriodEndsAt - Date.now());
        // Check if all drivers finished their lap during finishing phase
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
        leaderboard: this.sessionDrivers,
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

    const { maxLaps } = this.sessionConfig;

    let shouldStop = false;
    let shouldStartFinishing = false;
    let reason = '';

    // Note: time-based finishing is now handled in heartbeat

    // Check lap limit (checkered flag when leader reaches maxLaps)
    if (maxLaps && this.sessionStatus === 'active') {
      const maxLapsReached = this.sessionDrivers.some(d => d.totalLaps >= maxLaps);
      if (maxLapsReached) {
        shouldStartFinishing = true;
        reason = 'leader_finished';
      }
    }

    // Checkered flag logic: check if all drivers finished
    if (this.sessionStatus === 'finishing') {
      const allFinished = this.checkAllDriversFinished();
      if (allFinished) {
        shouldStop = true;
        reason = 'all_finished';
      }
    }

    if (shouldStartFinishing && !shouldStop) {
      await this.startFinishingPhase(reason);
    }

    if (shouldStop) {
      await this.finishSession(reason);
    }
  }

  /**
   * Check if all active drivers have finished
   * - Lap-based race: all must reach maxLaps
   * - Time-based race: all must complete their current lap (lapsAtFinishing + 1)
   */
  checkAllDriversFinished() {
    const maxLaps = this.sessionConfig?.maxLaps;

    const activeDrivers = this.sessionDrivers.filter(d => {
      // Driver was active at checkered flag if they had completed at least 1 lap
      return d.lapsAtFinishing !== null && d.lapsAtFinishing !== undefined && d.lapsAtFinishing > 0;
    });

    if (activeDrivers.length === 0) {
      // No active drivers, finish immediately
      return true;
    }

    if (maxLaps) {
      // Lap-based race: all must reach maxLaps
      return activeDrivers.every(d => d.totalLaps >= maxLaps);
    } else {
      // Time-based race: all must complete their current lap
      return activeDrivers.every(d => d.totalLaps > d.lapsAtFinishing);
    }
  }

  async startFinishingPhase(reason) {
    await this.prisma.session.update({
      where: { id: this.activeSessionId },
      data: { status: 'finishing', finishingAt: new Date() },
    });

    const previousStatus = this.sessionStatus;
    this.sessionStatus = 'finishing';

    // Snapshot laps for checkered flag logic (finish current lap)
    for (const driver of this.sessionDrivers) {
      driver.lapsAtFinishing = driver.totalLaps; // RAM state
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

    // Broadcast to clients with final leaderboard
    this.emit('session:finished', {
      sessionId,
      reason,
      championshipId,
      leaderboard: this.sessionDrivers
    });
    this.emitStatusChanged('finished', previousStatus);

    // Emit internal event for other services (ChampionshipManager)
    super.emit('sessionFinished', { sessionId, championshipId });

    // Stop CU/Simulator
    await this.syncService?.stopRace();

    // Reset state
    await this.resetForNewSession();
  }

  async calculateDNF() {
    const maxLaps = this.sessionConfig?.maxLaps;

    for (const driver of this.sessionDrivers) {
      const sd = await this.prisma.sessionDriver.findUnique({
        where: { id: driver.id },
      });

      if (sd?.lapsAtFinishing !== null && sd.lapsAtFinishing > 0) {
        let isDNF = false;

        if (maxLaps) {
          // Lap-based race: DNF if didn't reach maxLaps
          isDNF = driver.totalLaps < maxLaps;
        } else {
          // Time-based race: DNF if didn't finish current lap
          isDNF = driver.totalLaps === sd.lapsAtFinishing;
        }

        if (isDNF) {
          driver.isDNF = true;
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
   * @param {Object} params - { type, name, trackId, championshipId, maxDuration, maxLaps, order, gridFromQualifying }
   */
  async createSession(params) {
    const { type, name, trackId, championshipId, maxDuration, maxLaps, order, gridFromQualifying, status: initialStatus } = params;

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
        status: initialStatus || 'draft',
        trackId: finalTrackId,
        championshipId: championshipId || null,
        maxDuration: maxDuration || null,
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
        where: { trackId: finalTrackId, type: 'qualif', status: 'finished', deletedAt: null },
        orderBy: { finishedAt: 'desc' },
        include: { drivers: { where: { deletedAt: null }, orderBy: { finalPos: 'asc' } } },
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

    // Send stop signal to CU/Simulator
    await this.syncService?.stopRace();

    // Practice: soft delete (keep for stats)
    // Qualif/Race: hard delete
    if (session.type === 'practice') {
      await this.prisma.lap.updateMany({
        where: { sessionId, deletedAt: null },
        data: { deletedAt: new Date() },
      });
    } else {
      await this.prisma.lap.deleteMany({ where: { sessionId } });
    }

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
      data: { status: 'ready', startedAt: null, finishingAt: null, finishedAt: null, pauses: null },
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

    const now = new Date();

    // Soft delete cascade: laps, session drivers, session
    await this.prisma.lap.updateMany({
      where: { sessionId, deletedAt: null },
      data: { deletedAt: now },
    });
    await this.prisma.sessionDriver.updateMany({
      where: { sessionId, deletedAt: null },
      data: { deletedAt: now },
    });
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { deletedAt: now },
    });

    // Emit internal event for ChampionshipService
    if (session.championshipId) {
      super.emit('sessionDeleted', { sessionId, championshipId: session.championshipId });
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
    return ['active', 'paused', 'finishing'].includes(this.sessionStatus);
  }

  async close() {
    await this.resetForNewSession();
    await this.prisma.$disconnect();
  }
}

export default SessionService;

