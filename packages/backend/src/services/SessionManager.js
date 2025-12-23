import { PrismaClient } from '@prisma/client';

/**
 * Service pour gérer les sessions de course
 * Responsabilités:
 * - CRUD des sessions
 * - Synchronisation avec CU/Simulateur
 * - Gestion des phases
 * - Transitions d'état
 */
export class SessionManager {
  constructor(io) {
    this.prisma = new PrismaClient();
    this.io = io;
    this.trackSync = null; // Set via setTrackSync
    this.simulatorSync = null; // Set via setSimulatorSync
  }

  /**
   * Connecter le TrackSyncService pour le contrôle CU
   */
  setTrackSync(trackSync) {
    this.trackSync = trackSync;
  }

  /**
   * Connecter le SimulatorSyncService pour le simulateur
   */
  setSimulatorSync(simulatorSync) {
    this.simulatorSync = simulatorSync;
  }

  /**
   * Connecter le Simulateur
   */
  setSimulator(simulator) {
    this.simulator = simulator;
  }

  /**
   * Vérifier si le CU est connecté
   */
  isCuConnected() {
    return this.trackSync?.controlUnit?.isConnected() || false;
  }

  /**
   * Get the active sync service (trackSync or simulatorSync)
   */
  getActiveSync() {
    return this.trackSync || this.simulatorSync;
  }

  /**
   * Configure active session on CU or Simulator
   */
  configureActiveSession(session) {
    const phase = session.type === 'qualif' ? 'qualif' : 'race';

    if (this.trackSync) {
      this.trackSync.activeSessionId = session.id;
      this.trackSync.activeTrackId = session.trackId;
      this.trackSync.mapDriverByController.clear();
      this.trackSync.currentPhase = phase;
      for (const sd of session.drivers) {
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
    }

    if (this.simulatorSync) {
      this.simulatorSync.activeSessionId = session.id;
      this.simulatorSync.activeTrackId = session.trackId;
      this.simulatorSync.mapDriverByController.clear();
      this.simulatorSync.currentPhase = phase;
      for (const sd of session.drivers) {
        // controller is now 0-indexed int, use directly as map key
        this.simulatorSync.mapDriverByController.set(sd.controller, {
          sessionDriverId: sd.id,
          driverId: sd.driverId,
          carId: sd.carId,
          controller: sd.controller,
          driver: sd.driver,
          car: sd.car,
          lapCount: 0,
          lastLapTime: null,
          bestLapTime: null
        });
      }
    }
  }

  /**
   * Start race on CU or Simulator
   */
  startRace() {
    if (this.trackSync?.controlUnit?.isConnected()) {
      console.log('🏁 Starting race on CU');
      this.trackSync.controlUnit.start();
    }
    if (this.simulator) {
      console.log('🏎️ Starting simulator');
      this.simulator.start();
    }
  }

  /**
   * Stop race on CU or Simulator
   */
  stopRace() {
    if (this.trackSync?.controlUnit?.isConnected()) {
      console.log('🛑 Stopping race on CU');
      this.trackSync.controlUnit.start(); // Toggle to lights mode
    }
    if (this.simulator) {
      console.log('🛑 Stopping simulator');
      this.simulator.stop();
    }
  }

  /**
   * Clear active session from sync services
   */
  clearActiveSession() {
    if (this.trackSync) {
      this.trackSync.activeSessionId = null;
      this.trackSync.activeTrackId = null;
      this.trackSync.mapDriverByController.clear();
      this.trackSync.currentPhase = 'free';
    }
    if (this.simulatorSync) {
      this.simulatorSync.activeSessionId = null;
      this.simulatorSync.activeTrackId = null;
      this.simulatorSync.mapDriverByController.clear();
      this.simulatorSync.currentPhase = 'free';
    }
  }

  /**
   * Reset sync services for new session
   */
  async resetForNewSession() {
    if (this.trackSync?.resetForNewSession) {
      await this.trackSync.resetForNewSession();
    }
    if (this.simulatorSync?.resetForNewSession) {
      await this.simulatorSync.resetForNewSession();
    }
  }

  /**
   * Créer une nouvelle session avec ses phases
   */
  async createSession({ name, type, trackId, championshipId, fuelMode, drivers, phases, duration, maxLaps }) {
    const session = await this.prisma.session.create({
      data: {
        name,
        type,
        trackId,
        championshipId: championshipId || null,
        fuelMode: fuelMode || 'OFF',
        duration: duration || null,
        maxLaps: maxLaps || null,
        status: 'draft', // Commence en draft, passe à ready après sync
        drivers: {
          create: drivers?.map(d => ({
            driverId: d.driverId,
            carId: d.carId,
            controller: d.controller,
            gridPos: d.gridPos
          })) || []
        },
        phases: {
          create: phases?.map(p => ({
            phase: p.phase,
            duration: p.duration,
            maxLaps: p.maxLaps,
            status: 'waiting'
          })) || []
        }
      },
      include: {
        track: true,
        championship: true,
        drivers: {
          include: {
            driver: true,
            car: true
          }
        },
        phases: true
      }
    });

    return session;
  }

  /**
   * Synchroniser la session avec le CU/Simulateur
   */
  async syncSession(sessionId, deviceInfo) {
    const session = await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        status: 'ready', // Prête à démarrer
        syncedAt: new Date(),
        cuVersion: deviceInfo.version,
        cuFuelMode: deviceInfo.fuelMode,
        cuRealMode: deviceInfo.realMode,
        cuPitLane: deviceInfo.pitLane,
        cuLapCounter: deviceInfo.lapCounter,
        cuNumCars: deviceInfo.numCars
      },
      include: {
        track: true,
        drivers: {
          include: { driver: true, car: true }
        },
        phases: true
      }
    });

    this.io?.emit('session:synced', { sessionId });
    return session;
  }

  /**
   * Obtenir la session active en cours
   */
  async getActiveSession() {
    return await this.prisma.session.findFirst({
      where: { status: 'active' },
      include: {
        track: true,
        championship: true,
        drivers: {
          include: { driver: true, car: true }
        },
        phases: true
      },
      orderBy: { startedAt: 'desc' }
    });
  }

  /**
   * Obtenir une phase spécifique
   */
  async getPhase(sessionId, phaseName) {
    return await this.prisma.sessionPhase.findUnique({
      where: {
        sessionId_phase: {
          sessionId,
          phase: phaseName
        }
      }
    });
  }

  /**
   * Démarrer une phase
   */
  async startPhase(sessionId, phaseName) {
    // Mettre la session en active si elle ne l'est pas déjà
    const session = await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        status: 'active',
        currentPhase: phaseName,
        startedAt: { set: new Date() }
      },
      include: {
        drivers: {
          include: { driver: true, car: true }
        }
      }
    });

    // Configurer le TrackSync avec la session active
    if (this.trackSync) {
      this.trackSync.activeSessionId = sessionId;
      this.trackSync.mapDriverByController.clear();
      for (const sd of session.drivers) {
        this.trackSync.mapDriverByController.set(sd.controller, {
          sessionDriverId: sd.id,
          driverId: sd.driverId,
          carId: sd.carId,
          driver: sd.driver,
          car: sd.car,
          lapCount: 0,
          lastLapTime: null,
          position: sd.position || 0,
        });
      }
      this.trackSync.raceStartTime = new Date();
      this.trackSync.lastTimestamps.clear();

      // Démarrer la course sur le CU si connecté
      if (this.trackSync.controlUnit?.isConnected()) {
        console.log('🏁 Démarrage course sur CU');
        await this.trackSync.controlUnit.start();
      }
    }

    // Démarrer la phase
    const phase = await this.prisma.sessionPhase.update({
      where: {
        sessionId_phase: {
          sessionId,
          phase: phaseName
        }
      },
      data: {
        status: 'running',
        startedAt: new Date()
      }
    });

    this.io?.emit('phase:started', { sessionId, phase: phaseName });
    return phase;
  }

  /**
   * Mettre en pause une phase
   */
  async pausePhase(sessionId, phaseName) {
    // Arrêter les voitures sur le CU (toggle vers mode lights)
    if (this.trackSync?.controlUnit?.isConnected()) {
      console.log('⏸️ Pause phase - arrêt des voitures sur CU');
      await this.trackSync.controlUnit.start(); // Toggle to lights mode
    }

    const phase = await this.prisma.sessionPhase.update({
      where: {
        sessionId_phase: { sessionId, phase: phaseName }
      },
      data: {
        status: 'paused',
        pausedAt: new Date()
      }
    });

    this.io?.emit('phase:paused', { sessionId, phase: phaseName });
    return phase;
  }

  /**
   * Reprendre une phase depuis la pause
   */
  async resumePhase(sessionId, phaseName) {
    // Relancer les voitures sur le CU (toggle vers mode course)
    if (this.trackSync?.controlUnit?.isConnected()) {
      console.log('▶️ Resume phase - relance des voitures sur CU');
      await this.trackSync.controlUnit.start(); // Toggle to race mode
    }

    const phase = await this.prisma.sessionPhase.update({
      where: {
        sessionId_phase: { sessionId, phase: phaseName }
      },
      data: {
        status: 'running',
        pausedAt: null
      }
    });

    this.io?.emit('phase:resumed', { sessionId, phase: phaseName });
    return phase;
  }

  /**
   * Terminer une phase
   */
  async finishPhase(sessionId, phaseName) {
    // Arrêter les voitures sur le CU
    if (this.trackSync?.controlUnit?.isConnected()) {
      console.log('🏁 Fin de phase - arrêt des voitures sur CU');
      await this.trackSync.controlUnit.start(); // Toggle to lights mode
    }

    const phase = await this.prisma.sessionPhase.update({
      where: {
        sessionId_phase: { sessionId, phase: phaseName }
      },
      data: {
        status: 'finished',
        finishedAt: new Date()
      }
    });

    // Enregistrer les stats si c'est une phase de course
    if (phaseName === 'race') {
      await this.updateDriverStats(sessionId, phaseName);
    }

    this.io?.emit('phase:finished', { sessionId, phase: phaseName });
    return phase;
  }

  /**
   * Terminer toute la session
   */
  async finishSession(sessionId) {
    // Nettoyer le TrackSync
    if (this.trackSync) {
      this.trackSync.activeSessionId = null;
      this.trackSync.mapDriverByController.clear();
      this.trackSync.lastTimestamps.clear();
      this.trackSync.raceStartTime = null;
    }

    const session = await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        status: 'finished',
        finishedAt: new Date()
      }
    });

    this.io?.emit('session:finished', { sessionId });
    return session;
  }

  /**
   * Enregistrer un tour
   */
  async recordLap(sessionId, phaseName, { driverId, carId, controller, lapTime, lapNumber }) {
    const lap = await this.prisma.lap.create({
      data: {
        sessionId,
        phase: phaseName,
        driverId,
        carId,
        controller,
        lapTime,
        lapNumber
      },
      include: {
        driver: true,
        car: true
      }
    });

    this.io?.emit('lap:completed', { sessionId, phase: phaseName, lap });
    return lap;
  }

  /**
   * Mettre à jour les stats des pilotes après une phase de course
   */
  async updateDriverStats(sessionId, phaseName) {
    const laps = await this.prisma.lap.findMany({
      where: { sessionId, phase: phaseName },
      include: { driver: true }
    });

    // Calculer les positions
    const driverStats = {};
    for (const lap of laps) {
      if (!driverStats[lap.driverId]) {
        driverStats[lap.driverId] = {
          lapCount: 0,
          bestLap: Infinity,
          totalTime: 0
        };
      }
      driverStats[lap.driverId].lapCount++;
      driverStats[lap.driverId].totalTime += lap.lapTime;
      driverStats[lap.driverId].bestLap = Math.min(
        driverStats[lap.driverId].bestLap,
        lap.lapTime
      );
    }

    // Trier par nombre de tours puis par temps total
    const rankings = Object.entries(driverStats)
      .map(([driverId, stats]) => ({ driverId, ...stats }))
      .sort((a, b) => {
        if (b.lapCount !== a.lapCount) return b.lapCount - a.lapCount;
        return a.totalTime - b.totalTime;
      });

    // Mettre à jour les stats des pilotes
    for (let i = 0; i < rankings.length; i++) {
      const { driverId, bestLap } = rankings[i];
      const position = i + 1;

      const driver = await this.prisma.driver.findUnique({ where: { id: driverId } });
      if (!driver) continue;

      const updates = { totalRaces: { increment: 1 } };
      if (position === 1) updates.wins = { increment: 1 };
      if (position <= 3) updates.podiums = { increment: 1 };
      if (!driver.bestLap || bestLap < driver.bestLap) {
        updates.bestLap = bestLap;
      }

      await this.prisma.driver.update({
        where: { id: driverId },
        data: updates
      });

      // Mettre à jour position finale dans SessionDriver
      await this.prisma.sessionDriver.update({
        where: {
          sessionId_driverId: { sessionId, driverId }
        },
        data: { finalPos: position }
      });
    }

    console.log(`📊 Stats mises à jour pour ${rankings.length} pilotes`);
  }

  /**
   * Fermer les connexions
   */
  async close() {
    await this.prisma.$disconnect();
  }
}

export default SessionManager;
