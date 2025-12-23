import { PrismaClient } from '@prisma/client';
import { EventEmitter } from 'events';

// State machine states
const STATES = {
  IDLE: 'IDLE',           // Free practice mode
  PENDING: 'PENDING',     // Session created, waiting to start
  RUNNING: 'RUNNING',     // Race/qualif in progress
  PAUSED: 'PAUSED',       // Session paused
  RESULTS: 'RESULTS'      // Session finished, showing results
};

/**
 * RaceControllerService - State machine for race control
 * Integrates with TrackSyncService for CU communication
 */
export class RaceControllerService extends EventEmitter {
  constructor(io, leaderboardService) {
    super();
    this.prisma = new PrismaClient();
    this.io = io;
    this.leaderboardService = leaderboardService;
    this.trackSync = null; // Set via setTrackSync()

    // Current state
    this.state = STATES.IDLE;
    this.currentSession = null;
    this.activeTrackId = null;

    // Timer management
    this.startTime = null;
    this.pausedTime = 0;
    this.timerInterval = null;

    // Lap tracking for current session
    this.sessionLaps = new Map(); // controller -> { laps, bestLap, lastLap }
  }

  /**
   * Connect to TrackSyncService for CU control
   */
  setTrackSync(trackSync) {
    this.trackSync = trackSync;

    // Listen to lap events from TrackSync
    trackSync.on('lap-completed', (lapData) => {
      this.handleLapCompleted(lapData);
    });

    // Listen to CU connection events
    trackSync.on('cu-connected', () => {
      this.io?.emit('cu:connected');
    });

    trackSync.on('cu-disconnected', () => {
      this.io?.emit('cu:disconnected');
    });

    console.log('🔗 RaceControllerService connected to TrackSyncService');
  }

  /**
   * Handle lap completed event from TrackSync
   */
  async handleLapCompleted(lapData) {
    if (this.state !== STATES.RUNNING) return;

    const { controller, lapTime, lapNumber } = lapData;

    // Update session lap tracking
    const current = this.sessionLaps.get(controller) || { laps: 0, bestLap: null, lastLap: null };
    current.laps = lapNumber;
    current.lastLap = lapTime;
    if (!current.bestLap || lapTime < current.bestLap) {
      current.bestLap = lapTime;
    }
    this.sessionLaps.set(controller, current);

    // Check lap limit
    if (this.currentSession?.maxLaps) {
      const maxLapsReached = Array.from(this.sessionLaps.values()).some(
        data => data.laps >= this.currentSession.maxLaps
      );
      if (maxLapsReached) {
        console.log('🏁 Lap limit reached, finishing session');
        await this.finish();
      }
    }

    // Emit leaderboard update
    const leaderboard = await this.leaderboardService.getSessionLeaderboard(this.currentSession.id);
    this.io?.emit('race:leaderboard', leaderboard);
  }

  /**
   * Get current state
   */
  async getState() {
    let leaderboard = [];

    if (this.currentSession && this.state !== STATES.IDLE) {
      leaderboard = await this.leaderboardService.getSessionLeaderboard(this.currentSession.id);
    } else if (this.activeTrackId) {
      leaderboard = await this.leaderboardService.getFreePracticeLeaderboard(this.activeTrackId);
    }

    return {
      state: this.state,
      session: this.currentSession,
      trackId: this.activeTrackId,
      elapsed: this.getElapsedTime(),
      remaining: this.getRemainingTime(),
      cuConnected: this.trackSync?.controlUnit?.isConnected() || false,
      leaderboard
    };
  }

  /**
   * Set active track for free practice
   */
  setActiveTrack(trackId) {
    this.activeTrackId = trackId;
    this.io?.emit('race:trackChanged', { trackId });
  }

  /**
   * Start a qualifying session
   */
  async startQualifying(params) {
    if (this.state !== STATES.IDLE) {
      throw new Error(`Cannot start qualif: state is ${this.state}, expected IDLE`);
    }

    let { name, trackId, championshipId, duration, maxLaps, order } = params;

    // If championshipId is provided but no trackId, get it from the championship
    if (championshipId && !trackId) {
      const championship = await this.prisma.championship.findUnique({
        where: { id: championshipId }
      });
      if (!championship) {
        throw new Error('Championship not found');
      }
      if (!championship.trackId) {
        throw new Error('Championship has no track assigned');
      }
      trackId = championship.trackId;
    }

    if (!trackId) {
      throw new Error('trackId is required');
    }

    // Create session
    const session = await this.prisma.session.create({
      data: {
        name: name || 'Qualifying',
        type: 'qualif',
        status: 'draft',
        trackId,
        championshipId,
        duration,
        maxLaps,
        order: order ?? 0
      },
      include: { track: true }
    });

    // Get controller configs and create participants
    const configs = await this.prisma.controllerConfig.findMany({
      where: { trackId, isActive: true },
      include: { driver: true, car: true }
    });

    for (const config of configs) {
      if (config.driverId && config.carId) {
        await this.prisma.sessionDriver.create({
          data: {
            sessionId: session.id,
            driverId: config.driverId,
            carId: config.carId,
            controller: config.controller
          }
        });
      }
    }

    // Reload with participants
    this.currentSession = await this.prisma.session.findUnique({
      where: { id: session.id },
      include: {
        track: true,
        championship: true,
        drivers: {
          include: { driver: true, car: true },
          orderBy: { controller: 'asc' }
        }
      }
    });

    this.activeTrackId = trackId;
    this.sessionLaps.clear();

    // Reset CU/simulator for new session
    if (this.trackSync) {
      await this.trackSync.resetForNewSession();
    }

    this.setState(STATES.PENDING);

    return this.currentSession;
  }

  /**
   * Start a race session
   */
  async startRace(params) {
    if (this.state !== STATES.IDLE) {
      throw new Error(`Cannot start race: state is ${this.state}, expected IDLE`);
    }

    let { name, trackId, championshipId, duration, maxLaps, fuelMode, gridFromQualifying, order } = params;

    // If championshipId is provided but no trackId, get it from the championship
    if (championshipId && !trackId) {
      const championship = await this.prisma.championship.findUnique({
        where: { id: championshipId }
      });
      if (!championship) {
        throw new Error('Championship not found');
      }
      if (!championship.trackId) {
        throw new Error('Championship has no track assigned');
      }
      trackId = championship.trackId;
    }

    if (!trackId) {
      throw new Error('trackId is required');
    }

    // Create session
    const session = await this.prisma.session.create({
      data: {
        name: name || 'Race',
        type: 'race',
        status: 'draft',
        trackId,
        championshipId,
        duration,
        maxLaps,
        fuelMode: fuelMode || 'OFF',
        order: order ?? 0
      },
      include: { track: true }
    });

    // Get controller configs and create participants
    const configs = await this.prisma.controllerConfig.findMany({
      where: { trackId, isActive: true },
      include: { driver: true, car: true }
    });

    // Get grid order from last qualifying if requested
    let gridOrder = null;
    if (gridFromQualifying) {
      const lastQualifying = await this.prisma.session.findFirst({
        where: { trackId, type: 'qualif', status: 'finished' },
        orderBy: { finishedAt: 'desc' },
        include: {
          drivers: {
            orderBy: { finalPos: 'asc' }
          }
        }
      });
      if (lastQualifying) {
        gridOrder = lastQualifying.drivers.map(d => d.driverId);
      }
    }

    for (let i = 0; i < configs.length; i++) {
      const config = configs[i];
      if (config.driverId && config.carId) {
        const gridPos = gridOrder
          ? gridOrder.indexOf(config.driverId) + 1 || configs.length
          : i + 1;

        await this.prisma.sessionDriver.create({
          data: {
            sessionId: session.id,
            driverId: config.driverId,
            carId: config.carId,
            controller: config.controller,
            gridPos
          }
        });
      }
    }

    // Reload with participants
    this.currentSession = await this.prisma.session.findUnique({
      where: { id: session.id },
      include: {
        track: true,
        championship: true,
        drivers: {
          include: { driver: true, car: true },
          orderBy: { gridPos: 'asc' }
        }
      }
    });

    this.activeTrackId = trackId;
    this.sessionLaps.clear();

    // Reset CU/simulator for new session
    if (this.trackSync) {
      await this.trackSync.resetForNewSession();
    }

    this.setState(STATES.PENDING);

    return this.currentSession;
  }

  /**
   * Start the pending session (trigger CU countdown)
   */
  async start() {
    if (this.state !== STATES.PENDING) {
      throw new Error(`Cannot start: state is ${this.state}, expected PENDING`);
    }

    // Get CU info if connected
    let cuInfo = null;
    if (this.trackSync?.controlUnit?.isConnected()) {
      try {
        cuInfo = await this.trackSync.controlUnit.getInfo();
      } catch (e) {
        console.warn('Could not get CU info:', e.message);
      }
    }

    // Update session status
    this.currentSession = await this.prisma.session.update({
      where: { id: this.currentSession.id },
      data: {
        status: 'active',
        startedAt: new Date(),
        ...(cuInfo && {
          cuVersion: cuInfo.version,
          cuFuelMode: cuInfo.fuelMode,
          cuRealMode: cuInfo.realMode,
          cuPitLane: cuInfo.pitLane,
          cuLapCounter: cuInfo.lapCounter,
          cuNumCars: cuInfo.numCars
        })
      },
      include: {
        track: true,
        championship: true,
        drivers: {
          include: { driver: true, car: true }
        }
      }
    });

    // Load session into TrackSync for lap recording
    if (this.trackSync) {
      this.trackSync.activeSessionId = this.currentSession.id;
      this.trackSync.mapDriverByController.clear();

      for (const sd of this.currentSession.drivers) {
        this.trackSync.mapDriverByController.set(sd.controller, {
          sessionDriverId: sd.id,
          driverId: sd.driverId,
          carId: sd.carId,
          driver: sd.driver,
          car: sd.car,
          lapCount: 0,
          lastLapTime: null,
          position: sd.gridPos || 0
        });
      }

      // Start CU countdown
      await this.trackSync.startRace();
    }

    // Start timer
    this.startTime = Date.now();
    this.pausedTime = 0;
    this.startTimer();

    this.setState(STATES.RUNNING);

    return this.currentSession;
  }

  /**
   * Pause the current session
   */
  async pause() {
    if (this.state !== STATES.RUNNING) {
      throw new Error(`Cannot pause: state is ${this.state}, expected RUNNING`);
    }

    // Stop cars on CU (press START to toggle to lights mode)
    if (this.trackSync?.controlUnit?.isConnected()) {
      await this.trackSync.startRace(); // Toggle
    }

    // Record paused time
    this.pausedTime += Date.now() - this.startTime;
    this.stopTimer();

    this.setState(STATES.PAUSED);

    return this.currentSession;
  }

  /**
   * Resume the paused session
   */
  async resume() {
    if (this.state !== STATES.PAUSED) {
      throw new Error(`Cannot resume: state is ${this.state}, expected PAUSED`);
    }

    // Restart cars on CU
    if (this.trackSync?.controlUnit?.isConnected()) {
      await this.trackSync.startRace(); // Toggle back to racing
    }

    // Restart timer
    this.startTime = Date.now();
    this.startTimer();

    this.setState(STATES.RUNNING);

    return this.currentSession;
  }

  /**
   * Finish the current session
   */
  async finish() {
    if (this.state !== STATES.RUNNING && this.state !== STATES.PAUSED) {
      throw new Error(`Cannot finish: state is ${this.state}, expected RUNNING or PAUSED`);
    }

    // Stop cars on CU - press START to go to lights mode (LED 1)
    if (this.trackSync?.controlUnit?.isConnected()) {
      await this.trackSync.startRace(); // Toggle to lights mode
    }

    this.stopTimer();

    // Update session
    this.currentSession = await this.prisma.session.update({
      where: { id: this.currentSession.id },
      data: {
        status: 'finished',
        finishedAt: new Date()
      },
      include: {
        track: true,
        championship: true,
        drivers: { include: { driver: true, car: true } }
      }
    });

    // Clear TrackSync session
    if (this.trackSync) {
      this.trackSync.activeSessionId = null;
      this.trackSync.mapDriverByController.clear();
    }

    // Calculate final positions
    await this.calculateResults();

    this.setState(STATES.RESULTS);

    return this.getResults();
  }

  /**
   * Stop/Cancel the current session (return to IDLE)
   */
  async stop(keepLaps = false) {
    if (this.state === STATES.IDLE) {
      return { state: STATES.IDLE };
    }

    // Stop CU - press START to go to lights mode (LED 1)
    if (this.trackSync?.controlUnit?.isConnected()) {
      await this.trackSync.startRace(); // Toggle to lights mode
    }

    this.stopTimer();

    // Clear TrackSync session
    if (this.trackSync) {
      this.trackSync.activeSessionId = null;
      this.trackSync.mapDriverByController.clear();
    }

    if (this.currentSession) {
      if (keepLaps) {
        // Convert session laps to free practice (remove sessionId)
        await this.prisma.lap.updateMany({
          where: { sessionId: this.currentSession.id },
          data: { sessionId: null }
        });
      }

      // Delete session
      await this.prisma.session.delete({
        where: { id: this.currentSession.id }
      });
    }

    this.currentSession = null;
    this.sessionLaps.clear();
    this.setState(STATES.IDLE);

    return { state: STATES.IDLE };
  }

  /**
   * Dismiss results and return to IDLE
   */
  dismiss() {
    if (this.state !== STATES.RESULTS) {
      throw new Error(`Cannot dismiss: state is ${this.state}, expected RESULTS`);
    }

    this.currentSession = null;
    this.sessionLaps.clear();
    this.setState(STATES.IDLE);

    return { state: STATES.IDLE };
  }

  /**
   * Calculate final results for the session
   */
  async calculateResults() {
    if (!this.currentSession) return;

    const leaderboard = await this.leaderboardService.getSessionLeaderboard(this.currentSession.id);

    // Update final positions
    for (const entry of leaderboard) {
      await this.prisma.sessionDriver.updateMany({
        where: {
          sessionId: this.currentSession.id,
          driverId: entry.driver.id
        },
        data: {
          finalPos: entry.position
        }
      });
    }

    // Update driver stats if this is a race
    if (this.currentSession.type === 'race') {
      for (const entry of leaderboard) {
        const updates = {
          totalRaces: { increment: 1 }
        };

        if (entry.position === 1) updates.wins = { increment: 1 };
        if (entry.position <= 3) updates.podiums = { increment: 1 };

        // Update best lap if this is better
        const driver = await this.prisma.driver.findUnique({
          where: { id: entry.driver.id }
        });

        if (entry.bestLap && (!driver.bestLap || entry.bestLap < driver.bestLap)) {
          updates.bestLap = entry.bestLap;
        }

        await this.prisma.driver.update({
          where: { id: entry.driver.id },
          data: updates
        });
      }
    }
  }

  /**
   * Get session results
   */
  async getResults() {
    if (!this.currentSession) return null;

    const leaderboard = await this.leaderboardService.getSessionLeaderboard(this.currentSession.id);

    return {
      session: this.currentSession,
      leaderboard,
      winner: leaderboard[0] || null,
      fastestLap: leaderboard.reduce((fastest, entry) => {
        if (!fastest || (entry.bestLap && entry.bestLap < fastest.bestLap)) {
          return entry;
        }
        return fastest;
      }, null),
      elapsed: this.getElapsedTime()
    };
  }

  /**
   * Set state and emit event
   */
  setState(newState) {
    const oldState = this.state;
    this.state = newState;

    this.emit('state:changed', { from: oldState, to: newState });

    // Emit full state
    this.getState().then(state => {
      this.io?.emit('race:state', state);
    });

    console.log(`🏁 Race state: ${oldState} → ${newState}`);
  }

  /**
   * Timer management
   */
  startTimer() {
    this.timerInterval = setInterval(() => {
      this.checkAutoFinish();
      this.io?.emit('race:timer', {
        elapsed: this.getElapsedTime(),
        remaining: this.getRemainingTime()
      });
    }, 1000);
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  getElapsedTime() {
    if (!this.startTime) return this.pausedTime;
    if (this.state === STATES.PAUSED) return this.pausedTime;
    return this.pausedTime + (Date.now() - this.startTime);
  }

  getRemainingTime() {
    if (!this.currentSession?.duration) return null;
    const remaining = this.currentSession.duration - this.getElapsedTime();
    return Math.max(0, remaining);
  }

  async checkAutoFinish() {
    // Check time limit
    if (this.currentSession?.duration) {
      const remaining = this.getRemainingTime();
      if (remaining <= 0) {
        console.log('⏱️ Time limit reached, finishing session');
        await this.finish();
      }
    }
  }
}

export { STATES };
