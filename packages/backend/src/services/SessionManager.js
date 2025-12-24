import { PrismaClient } from '@prisma/client';

/**
 * SessionManager - Wrapper for session operations and CU/Simulator control
 */
export class SessionManager {
  constructor(io) {
    this.prisma = new PrismaClient();
    this.io = io;
    this.syncService = null;
    this.simulator = null;
  }

  setSyncService(syncService) {
    this.syncService = syncService;
  }

  setSimulator(simulator) {
    this.simulator = simulator;
  }

  isCuConnected() {
    return this.syncService?.source?.isConnected?.() || false;
  }

  /**
   * Configure active session on SyncService
   */
  configureActiveSession(session) {
    if (this.syncService) {
      this.syncService.activeSessionId = session.id;
      this.syncService.activeTrackId = session.trackId;
      this.syncService.currentPhase = session.type === 'qualif' ? 'qualif' : 'race';
      this.syncService.sessionDrivers = session.drivers.map(sd => ({
        sessionDriverId: sd.id,
        driverId: sd.driverId,
        carId: sd.carId,
        controller: sd.controller,
        driver: sd.driver,
        car: sd.car,
        totalLaps: 0,
        lastLapTime: null,
        bestLapTime: null,
        position: sd.gridPos || 0
      }));
    }
  }

  startRace() {
    if (this.syncService?.source?.start) {
      console.log('🏁 Starting race');
      this.syncService.source.start();
    } else if (this.simulator) {
      console.log('🏎️ Starting simulator');
      this.simulator.start();
    }
  }

  stopRace() {
    if (this.syncService?.source?.start) {
      console.log('🛑 Stopping race');
      this.syncService.source.start(); // Toggle
    } else if (this.simulator) {
      console.log('🛑 Stopping simulator');
      this.simulator.stop();
    }
  }

  clearActiveSession() {
    if (this.syncService) {
      this.syncService.activeSessionId = null;
      this.syncService.activeTrackId = null;
      this.syncService.sessionDrivers = [];
      this.syncService.currentPhase = 'practice';
    }
  }

  async resetForNewSession() {
    if (this.syncService?.resetForNewSession) {
      await this.syncService.resetForNewSession();
    }
  }

  async getActiveSession() {
    return await this.prisma.session.findFirst({
      where: { status: 'active' },
      include: {
        track: true,
        championship: true,
        drivers: { include: { driver: true, car: true } }
      },
      orderBy: { startedAt: 'desc' }
    });
  }

  async close() {
    await this.prisma.$disconnect();
  }
}

export default SessionManager;
