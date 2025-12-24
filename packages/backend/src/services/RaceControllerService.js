import { PrismaClient } from '@prisma/client';
import { EventEmitter } from 'events';

const STATES = {
  IDLE: 'IDLE',
  PENDING: 'PENDING',
  RUNNING: 'RUNNING',
  PAUSED: 'PAUSED',
  RESULTS: 'RESULTS'
};

export class RaceControllerService extends EventEmitter {
  constructor(io, leaderboardService) {
    super();
    this.prisma = new PrismaClient();
    this.io = io;
    this.leaderboardService = leaderboardService;
    this.syncService = null;

    this.state = STATES.IDLE;
    this.currentSession = null;
    this.activeTrackId = null;
    this.startTime = null;
    this.pausedTime = 0;
    this.timerInterval = null;
    this.sessionLaps = new Map();
  }

  setSyncService(syncService) {
    this.syncService = syncService;
    console.log('🔗 RaceControllerService connected to SyncService');
  }

  async handleLapCompleted(lapData) {
    if (this.state !== STATES.RUNNING) return;
    const { controller, lapTime, lapNumber } = lapData;

    const current = this.sessionLaps.get(controller) || { laps: 0, bestLap: null, lastLap: null };
    current.laps = lapNumber;
    current.lastLap = lapTime;
    if (!current.bestLap || lapTime < current.bestLap) current.bestLap = lapTime;
    this.sessionLaps.set(controller, current);

    if (this.currentSession?.maxLaps) {
      const maxLapsReached = Array.from(this.sessionLaps.values()).some(
        data => data.laps >= this.currentSession.maxLaps
      );
      if (maxLapsReached) {
        console.log('🏁 Lap limit reached, finishing session');
        await this.finish();
      }
    }

    const leaderboard = await this.leaderboardService.getSessionLeaderboard(this.currentSession.id);
    this.io?.emit('race:leaderboard', leaderboard);
  }

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
      cuConnected: this.syncService?.source?.isConnected?.() || false,
      leaderboard
    };
  }

  setActiveTrack(trackId) {
    this.activeTrackId = trackId;
    this.io?.emit('race:trackChanged', { trackId });
  }

  async startQualifying(params) {
    if (this.state !== STATES.IDLE) throw new Error(`Cannot start qualif: state is ${this.state}`);

    let { name, trackId, championshipId, duration, maxLaps, order } = params;
    if (championshipId && !trackId) {
      const championship = await this.prisma.championship.findUnique({ where: { id: championshipId } });
      if (!championship?.trackId) throw new Error('Championship has no track assigned');
      trackId = championship.trackId;
    }
    if (!trackId) throw new Error('trackId is required');

    const session = await this.prisma.session.create({
      data: { name: name || 'Qualifying', type: 'qualif', status: 'draft', trackId, championshipId, duration, maxLaps, order: order ?? 0 },
      include: { track: true }
    });

    const configs = await this.prisma.controllerConfig.findMany({
      where: { trackId, isActive: true },
      include: { driver: true, car: true }
    });

    for (const config of configs) {
      if (config.driverId && config.carId) {
        await this.prisma.sessionDriver.create({
          data: { sessionId: session.id, driverId: config.driverId, carId: config.carId, controller: config.controller }
        });
      }
    }

    this.currentSession = await this.prisma.session.findUnique({
      where: { id: session.id },
      include: { track: true, championship: true, drivers: { include: { driver: true, car: true }, orderBy: { controller: 'asc' } } }
    });

    this.activeTrackId = trackId;
    this.sessionLaps.clear();
    if (this.syncService?.resetForNewSession) await this.syncService.resetForNewSession();
    this.setState(STATES.PENDING);
    return this.currentSession;
  }

  async startRace(params) {
    if (this.state !== STATES.IDLE) throw new Error(`Cannot start race: state is ${this.state}`);

    let { name, trackId, championshipId, duration, maxLaps, fuelMode, gridFromQualifying, order } = params;
    if (championshipId && !trackId) {
      const championship = await this.prisma.championship.findUnique({ where: { id: championshipId } });
      if (!championship?.trackId) throw new Error('Championship has no track assigned');
      trackId = championship.trackId;
    }
    if (!trackId) throw new Error('trackId is required');

    const session = await this.prisma.session.create({
      data: { name: name || 'Race', type: 'race', status: 'draft', trackId, championshipId, duration, maxLaps, fuelMode: fuelMode || 'OFF', order: order ?? 0 },
      include: { track: true }
    });

    const configs = await this.prisma.controllerConfig.findMany({
      where: { trackId, isActive: true },
      include: { driver: true, car: true }
    });

    let gridOrder = null;
    if (gridFromQualifying) {
      const lastQualifying = await this.prisma.session.findFirst({
        where: { trackId, type: 'qualif', status: 'finished' },
        orderBy: { finishedAt: 'desc' },
        include: { drivers: { orderBy: { finalPos: 'asc' } } }
      });
      if (lastQualifying) gridOrder = lastQualifying.drivers.map(d => d.driverId);
    }

    for (let i = 0; i < configs.length; i++) {
      const config = configs[i];
      if (config.driverId && config.carId) {
        const gridPos = gridOrder ? gridOrder.indexOf(config.driverId) + 1 || configs.length : i + 1;
        await this.prisma.sessionDriver.create({
          data: { sessionId: session.id, driverId: config.driverId, carId: config.carId, controller: config.controller, gridPos }
        });
      }
    }

    this.currentSession = await this.prisma.session.findUnique({
      where: { id: session.id },
      include: { track: true, championship: true, drivers: { include: { driver: true, car: true }, orderBy: { gridPos: 'asc' } } }
    });

    this.activeTrackId = trackId;
    this.sessionLaps.clear();
    if (this.syncService?.resetForNewSession) await this.syncService.resetForNewSession();
    this.setState(STATES.PENDING);
    return this.currentSession;
  }

  async start() {
    if (this.state !== STATES.PENDING) throw new Error(`Cannot start: state is ${this.state}`);

    this.currentSession = await this.prisma.session.update({
      where: { id: this.currentSession.id },
      data: { status: 'active', startedAt: new Date() },
      include: { track: true, championship: true, drivers: { include: { driver: true, car: true } } }
    });

    if (this.syncService) {
      await this.syncService.loadSession(this.currentSession.id);
      this.syncService.source?.start?.();
    }

    this.startTime = Date.now();
    this.pausedTime = 0;
    this.startTimer();
    this.setState(STATES.RUNNING);
    return this.currentSession;
  }

  async pause() {
    if (this.state !== STATES.RUNNING) throw new Error(`Cannot pause: state is ${this.state}`);
    this.syncService?.source?.start?.();
    this.pausedTime += Date.now() - this.startTime;
    this.stopTimer();
    this.setState(STATES.PAUSED);
    return this.currentSession;
  }

  async resume() {
    if (this.state !== STATES.PAUSED) throw new Error(`Cannot resume: state is ${this.state}`);
    this.syncService?.source?.start?.();
    this.startTime = Date.now();
    this.startTimer();
    this.setState(STATES.RUNNING);
    return this.currentSession;
  }

  async finish() {
    if (this.state !== STATES.RUNNING && this.state !== STATES.PAUSED) throw new Error(`Cannot finish: state is ${this.state}`);
    this.syncService?.source?.start?.();
    this.stopTimer();

    this.currentSession = await this.prisma.session.update({
      where: { id: this.currentSession.id },
      data: { status: 'finished', finishedAt: new Date() },
      include: { track: true, championship: true, drivers: { include: { driver: true, car: true } } }
    });

    if (this.syncService) {
      this.syncService.activeSessionId = null;
      this.syncService.sessionDrivers = [];
    }

    await this.calculateResults();
    this.setState(STATES.RESULTS);
    return this.getResults();
  }

  async stop(keepLaps = false) {
    if (this.state === STATES.IDLE) return { state: STATES.IDLE };
    this.syncService?.source?.start?.();
    this.stopTimer();

    if (this.syncService) {
      this.syncService.activeSessionId = null;
      this.syncService.sessionDrivers = [];
    }

    if (this.currentSession) {
      if (keepLaps) {
        await this.prisma.lap.updateMany({ where: { sessionId: this.currentSession.id }, data: { sessionId: null } });
      }
      await this.prisma.session.delete({ where: { id: this.currentSession.id } });
    }

    this.currentSession = null;
    this.sessionLaps.clear();
    this.setState(STATES.IDLE);
    return { state: STATES.IDLE };
  }

  dismiss() {
    if (this.state !== STATES.RESULTS) throw new Error(`Cannot dismiss: state is ${this.state}`);
    this.currentSession = null;
    this.sessionLaps.clear();
    this.setState(STATES.IDLE);
    return { state: STATES.IDLE };
  }

  async calculateResults() {
    if (!this.currentSession) return;
    const leaderboard = await this.leaderboardService.getSessionLeaderboard(this.currentSession.id);

    for (const entry of leaderboard) {
      await this.prisma.sessionDriver.updateMany({
        where: { sessionId: this.currentSession.id, driverId: entry.driver.id },
        data: { finalPos: entry.position }
      });
    }

    if (this.currentSession.type === 'race') {
      for (const entry of leaderboard) {
        const updates = { totalRaces: { increment: 1 } };
        if (entry.position === 1) updates.wins = { increment: 1 };
        if (entry.position <= 3) updates.podiums = { increment: 1 };
        const driver = await this.prisma.driver.findUnique({ where: { id: entry.driver.id } });
        if (entry.bestLap && (!driver.bestLap || entry.bestLap < driver.bestLap)) updates.bestLap = entry.bestLap;
        await this.prisma.driver.update({ where: { id: entry.driver.id }, data: updates });
      }
    }
  }

  async getResults() {
    if (!this.currentSession) return null;
    const leaderboard = await this.leaderboardService.getSessionLeaderboard(this.currentSession.id);
    return {
      session: this.currentSession,
      leaderboard,
      winner: leaderboard[0] || null,
      fastestLap: leaderboard.reduce((f, e) => (!f || (e.bestLap && e.bestLap < f.bestLap)) ? e : f, null),
      elapsed: this.getElapsedTime()
    };
  }

  setState(newState) {
    const oldState = this.state;
    this.state = newState;
    this.emit('state:changed', { from: oldState, to: newState });
    this.getState().then(state => this.io?.emit('race:state', state));
    console.log(`🏁 Race state: ${oldState} → ${newState}`);
  }

  startTimer() {
    this.timerInterval = setInterval(() => {
      this.checkAutoFinish();
      this.io?.emit('race:timer', { elapsed: this.getElapsedTime(), remaining: this.getRemainingTime() });
    }, 1000);
  }

  stopTimer() {
    if (this.timerInterval) { clearInterval(this.timerInterval); this.timerInterval = null; }
  }

  getElapsedTime() {
    if (!this.startTime) return this.pausedTime;
    if (this.state === STATES.PAUSED) return this.pausedTime;
    return this.pausedTime + (Date.now() - this.startTime);
  }

  getRemainingTime() {
    if (!this.currentSession?.duration) return null;
    return Math.max(0, this.currentSession.duration - this.getElapsedTime());
  }

  async checkAutoFinish() {
    if (this.currentSession?.duration && this.getRemainingTime() <= 0) {
      console.log('⏱️ Time limit reached, finishing session');
      await this.finish();
    }
  }
}

export { STATES };
