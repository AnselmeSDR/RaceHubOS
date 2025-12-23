import { PrismaClient } from '@prisma/client';
import EventEmitter from 'events';

/**
 * SyncService - Service unifie de synchronisation CU/Simulateur
 *
 * Flow: Event → RAM → Emit → DB
 * Principe: emit === DB (meme structure)
 *
 * @see sync-flow-from-sim-or-cu.md
 */
export class SyncService extends EventEmitter {
  constructor(eventSource, io) {
    super();
    this.source = eventSource; // ControlUnit ou Simulator
    this.io = io;
    this.prisma = new PrismaClient();

    // Session state
    this.activeSessionId = null;
    this.activeTrackId = null;
    this.currentPhase = 'free'; // 'free' | 'qualif' | 'race'

    // Driver states - format unifie (RAM === DB === Emit)
    this.sessionDrivers = [];

    // Timestamps pour calcul lapTime
    this.lastTimestamps = new Map(); // controller -> timestamp

    // Grace period tracking
    this.raceFinishTime = null;

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
        this.emit('connected');
        this.io?.emit('cu:connected');
      });
      this.source.on('disconnected', () => {
        this.emit('disconnected');
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
    const lap = await this.prisma.lap.create({
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

    // Emit lap completed event
    this.emit('lap-completed', { ...lap, controller });
    this.io?.emit('lap:completed', {
      sessionId: this.activeSessionId,
      controller,
      driverId: state.driverId,
      lapNumber: state.totalLaps,
      lapTime,
    });

    // Check session completion
    await this.checkSessionComplete();
  }

  /**
   * Recalculate positions and gaps
   * Modifies sessionDrivers in place
   */
  recalculatePositions() {
    if (this.sessionDrivers.length === 0) return;

    // Sort based on phase
    if (this.currentPhase === 'qualif') {
      // Qualif: best lap time (ascending, null last)
      this.sessionDrivers.sort((a, b) => {
        if (a.bestLapTime === null && b.bestLapTime === null) return 0;
        if (a.bestLapTime === null) return 1;
        if (b.bestLapTime === null) return -1;
        return a.bestLapTime - b.bestLapTime;
      });
    } else {
      // Race/Free: laps (desc), then total time (asc)
      this.sessionDrivers.sort((a, b) => {
        if (b.totalLaps !== a.totalLaps) {
          return b.totalLaps - a.totalLaps;
        }
        return a.totalTime - b.totalTime;
      });
    }

    // Update positions and calculate gaps
    const leader = this.sessionDrivers[0];

    for (let i = 0; i < this.sessionDrivers.length; i++) {
      const driver = this.sessionDrivers[i];
      driver.position = i + 1;

      if (i === 0) {
        driver.gap = null;
      } else if (this.currentPhase === 'qualif') {
        // Gap = time difference to leader's best lap
        if (leader.bestLapTime && driver.bestLapTime) {
          driver.gap = driver.bestLapTime - leader.bestLapTime;
        } else {
          driver.gap = null;
        }
      } else {
        // Race: gap in laps or time
        const lapDiff = leader.totalLaps - driver.totalLaps;
        if (lapDiff > 0) {
          driver.gap = lapDiff; // Number = laps behind
        } else if (leader.totalTime && driver.totalTime) {
          driver.gap = driver.totalTime - leader.totalTime; // ms behind
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
   */
  handleStatus(status) {
    this.io?.emit('cu:status', status);
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
    this.currentPhase = session.type === 'qualifying' ? 'qualif' :
                        session.type === 'practice' ? 'free' : 'race';

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
    this.currentPhase = 'free';

    // Reset source if it has reset method
    if (this.source.reset) {
      await this.source.reset();
    }
    if (this.source.clearPosition) {
      await this.source.clearPosition();
    }
  }

  /**
   * Check if session should auto-complete
   */
  async checkSessionComplete() {
    if (!this.activeSessionId) return;

    const session = await this.prisma.session.findUnique({
      where: { id: this.activeSessionId },
      include: { championship: true },
    });

    if (!session) return;
    if (session.status !== 'active' && session.status !== 'finishing') return;

    let shouldStop = false;
    let shouldStartFinishing = false;
    let reason = '';

    // Check time limit
    if (session.duration && session.startedAt) {
      const elapsed = Date.now() - new Date(session.startedAt).getTime();
      const durationMs = session.duration * 60 * 1000;
      if (elapsed >= durationMs) {
        shouldStop = true;
        reason = `Temps ecoule (${session.duration}min)`;
      }
    }

    // Check lap limit
    if (session.maxLaps && !shouldStop) {
      const maxLapsReached = this.sessionDrivers.some(d => d.totalLaps >= session.maxLaps);

      if (maxLapsReached) {
        if (session.status !== 'finishing') {
          shouldStartFinishing = true;
          reason = `Leader a termine ${session.maxLaps} tours`;
          this.raceFinishTime = Date.now();
        } else if (session.type === 'qualifying') {
          // Qualif: all must complete maxLaps
          const allFinished = this.sessionDrivers
            .filter(d => d.totalLaps > 0)
            .every(d => d.totalLaps >= session.maxLaps);
          if (allFinished) {
            shouldStop = true;
            reason = `Tous les pilotes ont termine ${session.maxLaps} tours`;
          }
        } else {
          // Race: 30s grace period
          if (this.raceFinishTime && Date.now() - this.raceFinishTime >= 30000) {
            shouldStop = true;
            reason = 'Delai de grace ecoule (30s)';
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

      this.io?.emit('session:finishing', {
        sessionId: this.activeSessionId,
        reason,
      });
    }

    // Finish session
    if (shouldStop) {
      await this.finishSession(reason, session.championshipId);
    }
  }

  /**
   * Finish session and save final positions
   */
  async finishSession(reason, championshipId = null) {
    // Update final positions in DB
    for (const driver of this.sessionDrivers) {
      await this.prisma.sessionDriver.update({
        where: { id: driver.id },
        data: {
          finalPos: driver.position,
          totalLaps: driver.totalLaps,
          totalTime: driver.totalTime,
          bestLapTime: driver.bestLapTime,
          lastLapTime: driver.lastLapTime,
        },
      });
    }

    // Update session status
    await this.prisma.session.update({
      where: { id: this.activeSessionId },
      data: {
        status: 'finished',
        finishedAt: new Date(),
      },
    });

    // Emit events
    this.io?.emit('session:finished', {
      sessionId: this.activeSessionId,
      reason,
    });

    this.io?.emit('session_status_changed', {
      sessionId: this.activeSessionId,
      status: 'finished',
      previousStatus: 'active',
    });

    // Recalculate championship standings
    if (championshipId) {
      await this.recalculateChampionshipStandings(championshipId);
    }

    // Clear state
    const sessionId = this.activeSessionId;
    this.activeSessionId = null;
    this.activeTrackId = null;
    this.sessionDrivers = [];
    this.raceFinishTime = null;

    this.emit('session-finished', sessionId);
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
    await this.prisma.$disconnect();
  }
}

export default SyncService;
