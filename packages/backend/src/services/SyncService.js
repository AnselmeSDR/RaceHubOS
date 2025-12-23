import { PrismaClient } from '@prisma/client';

// Default grace period after leader finishes (ms)
const DEFAULT_GRACE_PERIOD_MS = 30000;

/**
 * SyncService - Service unifie de synchronisation CU/Simulateur
 *
 * Flow: Event → RAM → Emit → DB
 * Principe: emit === DB (meme structure)
 *
 * @see sync-flow-from-sim-or-cu.md
 */
export class SyncService {
  constructor(eventSource, io) {
    this.source = eventSource; // ControlUnit ou Simulator
    this.io = io;
    this.prisma = new PrismaClient();

    // Session state
    this.activeSessionId = null;
    this.activeTrackId = null;
    this.currentPhase = 'practice'; // 'practice' | 'qualif' | 'race'
    this.sessionConfig = null; // Cached session config (duration, maxLaps, etc.)
    this.sessionStatus = null; // Cached session status

    // Driver states - format unifie (RAM === DB === Emit)
    this.sessionDrivers = [];

    // Timestamps pour calcul lapTime
    this.lastTimestamps = new Map(); // controller -> timestamp

    // Grace period tracking
    this.raceFinishTime = null;

    // CU status & polling
    this.cuStatus = null;
    this.pollInterval = 500; // Default 500ms
    this.pollTimer = null;

    // Setup listeners
    this.setupListeners();
  }

  /**
   * Setup event listeners on source (CU or Simulator)
   */
  setupListeners() {
    this.source.on('timer', (event) => this.handleTimerEvent(event));
    this.source.on('status', (status) => this.handleStatus(status));

    if (this.source.on) {
      this.source.on('connected', () => {
        this.io?.emit('cu:connected');
      });
      this.source.on('disconnected', () => {
        this.io?.emit('cu:disconnected');
      });
    }
  }

  /**
   * Get driver state by controller (O(n) but n <= 10)
   */
  getDriverByController(controller) {
    return this.sessionDrivers.find(d => d.controller === controller);
  }

  /**
   * Handle timer event from CU/Simulator
   * Format: { controller: 0-5, timestamp: ms, sector: 1-3 }
   */
  async handleTimerEvent(event) {
    const { controller, timestamp, sector } = event;

    // Calculate lap time
    const lastTimestamp = this.lastTimestamps.get(controller) || 0;
    const lapTime = lastTimestamp > 0 ? timestamp - lastTimestamp : 0;
    this.lastTimestamps.set(controller, timestamp);

    // Emit raw timer event
    this.io?.emit('cu:timer', { controller, timestamp, lapTime, sector });

    // Only process finish line (sector 1) with valid lap time
    if (sector !== 1 || lapTime === 0) {
      return;
    }

    // Get driver for this controller
    const state = this.getDriverByController(controller);
    if (!state) {
      return;
    }

    // 1. Update RAM
    state.totalLaps++;
    state.totalTime += Math.round(lapTime);
    state.lastLapTime = Math.round(lapTime);
    if (state.bestLapTime === null || lapTime < state.bestLapTime) {
      state.bestLapTime = Math.round(lapTime);
    }

    // 2. Recalculate positions & gaps
    this.recalculatePositions();

    // 3. Save Lap (source de verite)
    await this.prisma.lap.create({
      data: {
        sessionId: this.activeSessionId,
        trackId: this.activeTrackId,
        driverId: state.driverId,
        carId: state.carId,
        controller: state.controller,
        phase: this.currentPhase,
        lapNumber: state.totalLaps,
        lapTime: lapTime,
      },
    });

    // 4. Save SessionDriver (cache, meme structure que RAM)
    await this.prisma.sessionDriver.update({
      where: { id: state.id },
      data: {
        position: state.position,
        totalLaps: state.totalLaps,
        totalTime: state.totalTime,
        bestLapTime: state.bestLapTime,
        lastLapTime: state.lastLapTime,
      },
    });

    // 5. Emit leaderboard (meme format que DB)
    this.emitLeaderboard();

    // Check session completion
    await this.checkSessionComplete();
  }

  /**
   * Recalculate positions and gaps
   * Modifies sessionDrivers in place
   *
   * Sorting rules:
   * - practice/qualif: by bestLapTime (ascending, null last)
   * - race: by totalLaps (desc), then totalTime (asc)
   */
  recalculatePositions() {
    if (this.sessionDrivers.length === 0) return;

    const isRace = this.currentPhase === 'race';

    if (isRace) {
      // Race: most laps first, then fastest total time
      this.sessionDrivers.sort((a, b) => {
        if (b.totalLaps !== a.totalLaps) {
          return b.totalLaps - a.totalLaps;
        }
        return a.totalTime - b.totalTime;
      });
    } else {
      // Practice/Qualif: best lap time (ascending, null last)
      this.sessionDrivers.sort((a, b) => {
        if (a.bestLapTime === null && b.bestLapTime === null) return 0;
        if (a.bestLapTime === null) return 1;
        if (b.bestLapTime === null) return -1;
        return a.bestLapTime - b.bestLapTime;
      });
    }

    // Update positions and calculate gaps
    const leader = this.sessionDrivers[0];

    for (let i = 0; i < this.sessionDrivers.length; i++) {
      const driver = this.sessionDrivers[i];
      driver.position = i + 1;

      if (i === 0) {
        driver.gap = null;
      } else if (isRace) {
        // Race: gap in laps or time
        const lapDiff = leader.totalLaps - driver.totalLaps;
        if (lapDiff > 0) {
          driver.gap = lapDiff; // Number = laps behind
        } else if (leader.totalTime && driver.totalTime) {
          driver.gap = driver.totalTime - leader.totalTime; // ms behind
        } else {
          driver.gap = null;
        }
      } else {
        // Practice/Qualif: gap = time difference to leader's best lap
        if (leader.bestLapTime && driver.bestLapTime) {
          driver.gap = driver.bestLapTime - leader.bestLapTime;
        } else {
          driver.gap = null;
        }
      }
    }
  }

  /**
   * Emit leaderboard to frontend
   * Format matches SessionDriver DB structure
   */
  emitLeaderboard() {
    this.io?.emit('leaderboard', this.sessionDrivers);
  }

  /**
   * Handle status event from CU
   * Adapts polling speed during lights sequence
   */
  handleStatus(status) {
    const wasInLights = this.isInLightsSequence(this.cuStatus);
    const isInLights = this.isInLightsSequence(status);

    this.cuStatus = status;
    this.io?.emit('cu:status', status);

    // Adaptive polling: faster during lights sequence
    if (isInLights && !wasInLights) {
      this.setPollInterval(100); // 100ms during lights
    } else if (!isInLights && wasInLights) {
      this.setPollInterval(500); // Back to 500ms
    }
  }

  /**
   * Check if CU is in lights sequence (LIGHTS_1 to GO, including FALSE_START)
   * CU states: STOPPED(9), LIGHTS_1-5(1-5), FALSE_START(6), GO(7), RACING(0)
   */
  isInLightsSequence(status) {
    if (!status) return false;
    return status.start >= 1 && status.start <= 7;
  }

  /**
   * Set polling interval and restart polling
   */
  setPollInterval(ms) {
    if (this.pollInterval === ms) return;
    this.pollInterval = ms;

    // Restart polling if active
    if (this.pollTimer) {
      this.stopPolling();
      this.startPolling();
    }
  }

  /**
   * Start polling CU status
   */
  startPolling() {
    if (this.pollTimer) return;

    const poll = async () => {
      if (this.source.poll) {
        await this.source.poll();
      }
      this.pollTimer = setTimeout(poll, this.pollInterval);
    };

    poll();
  }

  /**
   * Stop polling
   */
  stopPolling() {
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
  }

  // ==================== CU Control Methods ====================

  /**
   * Start race (press START button on CU)
   */
  async startRace() {
    if (this.source.start) {
      await this.source.start();
    }
  }

  /**
   * Stop/pause race (press ESC button on CU)
   */
  async stopRace() {
    if (this.source.pressEsc) {
      await this.source.pressEsc();
    } else if (this.source.stop) {
      await this.source.stop();
    }
  }

  /**
   * Press a button on CU
   * @param {number} button - Button code (1=ESC, 2=START, 5=SPEED, 6=BRAKE, 7=FUEL, 8=CODE)
   */
  async pressButton(button) {
    if (this.source.pressButton) {
      await this.source.pressButton(button);
    }
  }

  /**
   * Get current CU status
   */
  getCuStatus() {
    return this.cuStatus;
  }

  /**
   * Load session and initialize driver states
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
      },
    });

    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    this.activeSessionId = session.id;
    this.activeTrackId = session.trackId;
    this.currentPhase = session.type === 'qualif' ? 'qualif' :
                        session.type === 'practice' ? 'practice' : 'race';

    // Cache session config for checkSessionComplete (avoid repeated DB queries)
    this.sessionConfig = {
      duration: session.duration,
      maxLaps: session.maxLaps,
      gracePeriod: session.gracePeriod || DEFAULT_GRACE_PERIOD_MS,
      startedAt: session.startedAt,
      championshipId: session.championshipId,
    };
    this.sessionStatus = session.status;

    // Initialize driver states from DB (unified format)
    this.sessionDrivers = session.drivers.map(sd => ({
      // Identifiers
      id: sd.id,
      controller: sd.controller,
      driverId: sd.driverId,
      carId: sd.carId,

      // Stats (from DB or default)
      position: sd.position || 0,
      totalLaps: sd.totalLaps || 0,
      totalTime: sd.totalTime || 0,
      bestLapTime: sd.bestLapTime || null,
      lastLapTime: sd.lastLapTime || null,
      gap: null,
    }));

    // Reset timestamps
    this.lastTimestamps.clear();
    this.raceFinishTime = null;

    // Recalculate positions from current state
    this.recalculatePositions();

    return session;
  }

  /**
   * Reset for new session
   */
  async resetForNewSession() {
    this.sessionDrivers = [];
    this.lastTimestamps.clear();
    this.raceFinishTime = null;
    this.activeSessionId = null;
    this.activeTrackId = null;
    this.currentPhase = 'practice';
    this.sessionConfig = null;
    this.sessionStatus = 'draft';

    // Reset source if it has reset method
    if (this.source.reset) {
      await this.source.reset();
    }
    if (this.source.clearPosition) {
      await this.source.clearPosition();
    }
  }

  /**
   * Check if session should auto-complete (uses cached sessionConfig, no DB query)
   */
  async checkSessionComplete() {
    if (!this.activeSessionId || !this.sessionConfig) return;
    if (this.sessionStatus !== 'active' && this.sessionStatus !== 'finishing') return;

    const { duration, maxLaps, gracePeriod, startedAt, championshipId } = this.sessionConfig;

    let shouldStop = false;
    let shouldStartFinishing = false;
    let reason = '';

    // Check time limit
    if (duration && startedAt) {
      const elapsed = Date.now() - new Date(startedAt).getTime();
      if (elapsed >= duration) {
        shouldStop = true;
        reason = `Temps ecoule (${Math.round(duration / 60000)}min)`;
      }
    }

    // Check lap limit
    if (maxLaps && !shouldStop) {
      const maxLapsReached = this.sessionDrivers.some(d => d.totalLaps >= maxLaps);

      if (maxLapsReached) {
        if (this.sessionStatus !== 'finishing') {
          shouldStartFinishing = true;
          reason = `Leader a termine ${maxLaps} tours`;
          this.raceFinishTime = Date.now();
        } else if (this.currentPhase === 'qualif') {
          // Qualif: all must complete maxLaps
          const allFinished = this.sessionDrivers
            .filter(d => d.totalLaps > 0)
            .every(d => d.totalLaps >= maxLaps);
          if (allFinished) {
            shouldStop = true;
            reason = `Tous les pilotes ont termine ${maxLaps} tours`;
          }
        } else {
          // Race: grace period
          if (this.raceFinishTime && Date.now() - this.raceFinishTime >= gracePeriod) {
            shouldStop = true;
            reason = `Delai de grace ecoule (${gracePeriod / 1000}s)`;
          }
        }
      }
    }

    // Start finishing mode
    if (shouldStartFinishing && !shouldStop) {
      await this.prisma.session.update({
        where: { id: this.activeSessionId },
        data: { status: 'finishing', finishingAt: new Date() },
      });
      this.sessionStatus = 'finishing';

      this.io?.emit('session:finishing', {
        sessionId: this.activeSessionId,
        reason,
      });
    }

    // Finish session
    if (shouldStop) {
      await this.finishSession(reason, championshipId);
    }
  }

  /**
   * Finish session and save final positions (batched transaction)
   */
  async finishSession(reason, championshipId = null) {
    const sessionId = this.activeSessionId;
    const previousStatus = this.sessionStatus;

    // Batch all updates in a single transaction
    await this.prisma.$transaction([
      // Update all drivers at once
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
      // Update session status
      this.prisma.session.update({
        where: { id: sessionId },
        data: {
          status: 'finished',
          finishedAt: new Date(),
        },
      }),
    ]);

    // Emit events
    this.io?.emit('session:finished', { sessionId, reason });
    this.io?.emit('session_status_changed', {
      sessionId,
      status: 'finished',
      previousStatus,
    });

    // Recalculate championship standings
    if (championshipId) {
      await this.recalculateChampionshipStandings(championshipId);
    }

    // Clear state
    this.activeSessionId = null;
    this.activeTrackId = null;
    this.sessionDrivers = [];
    this.sessionConfig = null;
    this.sessionStatus = null;
    this.raceFinishTime = null;
  }

  /**
   * Recalculate championship standings
   */
  async recalculateChampionshipStandings(championshipId) {
    const championship = await this.prisma.championship.findUnique({
      where: { id: championshipId },
      include: {
        sessions: {
          where: { status: 'finished' },
          include: {
            drivers: true,
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
          driverStats[sd.driverId].points += pointsSystem[sd.finalPos] || 0;
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

    const sorted = Object.entries(driverStats)
      .sort((a, b) => b[1].points - a[1].points || b[1].wins - a[1].wins)
      .map(([driverId, stats], i) => ({
        championshipId,
        driverId,
        position: i + 1,
        ...stats,
      }));

    await this.prisma.championshipStanding.deleteMany({ where: { championshipId } });
    if (sorted.length > 0) {
      await this.prisma.championshipStanding.createMany({ data: sorted });
    }
  }

  /**
   * Get current state
   */
  getState() {
    return {
      activeSessionId: this.activeSessionId,
      activeTrackId: this.activeTrackId,
      currentPhase: this.currentPhase,
      sessionDrivers: this.sessionDrivers,
      connected: this.source.isConnected?.() || false,
      cuStatus: this.cuStatus,
      pollInterval: this.pollInterval,
    };
  }

  /**
   * Get leaderboard (same format as emit)
   */
  getLeaderboard() {
    return this.sessionDrivers;
  }

  /**
   * Close connections
   */
  async close() {
    this.stopPolling();
    await this.prisma.$disconnect();
  }
}

export default SyncService;
