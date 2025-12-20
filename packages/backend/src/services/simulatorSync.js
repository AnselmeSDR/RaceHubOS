import { PrismaClient } from '@prisma/client';

/**
 * Service de synchronisation entre le Simulateur et la base de données
 * Similaire à TrackSyncService mais pour le simulateur
 */
export class SimulatorSyncService {
  constructor(simulator, io) {
    this.simulator = simulator;
    this.io = io;
    this.prisma = new PrismaClient();
    this.activeSessionId = null;
    this.activeTrackId = null;
    this.sessionDrivers = new Map(); // carId -> { driverId, carId, controller }
    this.currentPhase = 'free'; // 'free', 'qualif', 'race'

    // Écouter les événements du simulateur
    this.setupListeners();
  }

  setupListeners() {
    // Utiliser l'EventEmitter interne du simulateur serait mieux,
    // mais pour l'instant on va écouter via le socket.io
    // On va plutôt ajouter des callbacks dans le simulateur

    // Pour l'instant, on va modifier le simulateur pour appeler des callbacks
    // Mais je vais d'abord créer les méthodes nécessaires
  }

  /**
   * Charger la session active
   */
  async loadActiveSession() {
    const session = await this.prisma.session.findFirst({
      where: {
        status: { in: ['running', 'active'] },
      },
      include: {
        drivers: {
          include: {
            driver: true,
            car: true,
          },
        },
        track: true,
      },
    });

    if (session) {
      this.activeSessionId = session.id;
      this.activeTrackId = session.trackId;
      this.currentPhase = session.type === 'qualifying' ? 'qualif' : 'race';

      // Mapper les SessionDriver aux voitures du simulateur
      this.sessionDrivers.clear();
      for (const sd of session.drivers) {
        // Le controller correspond à l'ID de la voiture dans le simulateur
        const carId = parseInt(sd.controller);
        this.sessionDrivers.set(carId, {
          sessionDriverId: sd.id,
          driverId: sd.driverId,
          carId: sd.carId,
          controller: sd.controller,
          driver: sd.driver,
          car: sd.car,
        });
      }

    }

    return session;
  }

  /**
   * Démarrer une session
   */
  async startSession(sessionId) {
    // Récupérer les infos du simulateur
    const simulatorInfo = {
      version: 'SIMULATOR-v1.0',
      fuelMode: true, // Le simulateur simule toujours le fuel
      realMode: false,
      pitLane: true, // Le simulateur simule les pit stops
      lapCounter: true,
      numCars: this.simulator.cars.length,
    };

    await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        status: 'running',
        startedAt: new Date(),
        cuVersion: simulatorInfo.version,
        cuFuelMode: simulatorInfo.fuelMode,
        cuRealMode: simulatorInfo.realMode,
        cuPitLane: simulatorInfo.pitLane,
        cuLapCounter: simulatorInfo.lapCounter,
        cuNumCars: simulatorInfo.numCars,
      },
    });

    await this.loadActiveSession();

    // Démarrer le simulateur
    this.simulator.start();


    this.io?.emit('session:started', { sessionId });
  }

  /**
   * Arrêter la session active
   */
  async stopSession() {
    if (!this.activeSessionId) {
      return;
    }

    await this.prisma.session.update({
      where: { id: this.activeSessionId },
      data: {
        status: 'finished',
        finishedAt: new Date(),
      },
    });

    const sessionId = this.activeSessionId;
    this.activeSessionId = null;
    this.sessionDrivers.clear();

    // Arrêter le simulateur
    this.simulator.stop();

    this.io?.emit('session:stopped', { sessionId });
  }

  /**
   * Enregistrer un tour
   * Appelé par le simulateur via callback
   */
  async recordLap(carId, lapTime, lapNumber) {
    if (!this.activeSessionId) {
      return;
    }

    const driverData = this.sessionDrivers.get(carId);
    if (!driverData) {
      console.warn(`⚠️  Voiture ${carId} non mappée à un pilote`);
      return;
    }

    try {
      const lap = await this.prisma.lap.create({
        data: {
          sessionId: this.activeSessionId,
          trackId: this.activeTrackId,
          driverId: driverData.driverId,
          carId: driverData.carId,
          controller: driverData.controller,
          phase: this.currentPhase || 'race',
          lapNumber,
          lapTime,
        },
      });

      // Calculer les positions
      await this.updatePositions();

      const lapData = {
        ...lap,
        driver: driverData.driver,
        car: driverData.car,
      };

      this.io?.emit('lap:completed', lapData);
      this.io?.emit('lap_completed', { ...lapData, sessionId: this.activeSessionId });

      // Créer un événement de course
      await this.prisma.raceEvent.create({
        data: {
          sessionId: this.activeSessionId,
          type: 'lap',
          data: JSON.stringify({
            driverId: driverData.driverId,
            controller: driverData.controller,
            lapNumber,
            lapTime,
          }),
        },
      });

      // Vérifier si la phase doit s'arrêter automatiquement
      await this.checkPhaseComplete();
    } catch (error) {
      console.error('Erreur enregistrement tour:', error);
    }
  }

  /**
   * Vérifier si la phase actuelle doit s'arrêter automatiquement
   */
  async checkPhaseComplete() {
    if (!this.activeSessionId) return;

    try {
      const session = await this.prisma.session.findUnique({
        where: { id: this.activeSessionId },
      });

      if (!session || session.phaseStatus !== 'running') return;

      let shouldStop = false;
      let reason = '';

      // Vérifier le temps écoulé
      if (session.duration && session.phaseStartedAt) {
        const elapsed = Date.now() - new Date(session.phaseStartedAt).getTime();
        const durationMs = session.duration * 60 * 1000;

        if (elapsed >= durationMs) {
          shouldStop = true;
          reason = `Temps écoulé (${session.duration}min)`;
        }
      }

      // Vérifier le nombre de tours max
      if (session.maxLaps && !shouldStop) {
        const maxLapsInPhase = await this.prisma.lap.findFirst({
          where: {
            sessionId: this.activeSessionId,
            phase: session.currentPhase,
          },
          orderBy: { lapNumber: 'desc' },
        });

        if (maxLapsInPhase && maxLapsInPhase.lapNumber >= session.maxLaps) {
          shouldStop = true;
          reason = `${session.maxLaps} tours atteints`;
        }
      }

      // Arrêter la phase si nécessaire
      if (shouldStop) {
        await this.prisma.session.update({
          where: { id: this.activeSessionId },
          data: {
            phaseStatus: 'finished',
            phaseFinishedAt: new Date(),
          },
        });

        // Arrêter le simulateur
        this.simulator.stop();

        this.io?.emit('phase:auto-stopped', {
          sessionId: this.activeSessionId,
          phase: session.currentPhase,
          reason,
        });
      }
    } catch (error) {
      console.error('Erreur vérification fin de phase:', error);
    }
  }

  /**
   * Mettre à jour les positions des pilotes
   */
  async updatePositions() {
    if (!this.activeSessionId) return;

    // Récupérer les statistiques de chaque pilote
    const drivers = [];
    for (const [carId, driverData] of this.sessionDrivers) {
      const lapCount = await this.prisma.lap.count({
        where: {
          sessionId: this.activeSessionId,
          controller: driverData.controller,
        },
      });

      const lastLap = await this.prisma.lap.findFirst({
        where: {
          sessionId: this.activeSessionId,
          controller: driverData.controller,
        },
        orderBy: { timestamp: 'desc' },
      });

      drivers.push({
        ...driverData,
        lapCount,
        lastLapTime: lastLap?.lapTime || null,
      });
    }

    // Trier par nombre de tours puis par temps du dernier tour
    drivers.sort((a, b) => {
      if (b.lapCount !== a.lapCount) {
        return b.lapCount - a.lapCount;
      }
      return (a.lastLapTime || Infinity) - (b.lastLapTime || Infinity);
    });

    // Mettre à jour les positions
    for (let i = 0; i < drivers.length; i++) {
      const driver = drivers[i];
      await this.prisma.sessionDriver.update({
        where: { id: driver.sessionDriverId },
        data: { position: i + 1 },
      });
    }

    const positions = drivers.map((d, i) => ({
      controller: d.controller,
      position: i + 1,
      driverId: d.driverId,
      driver: d.driver,
      lapCount: d.lapCount,
      lastLapTime: d.lastLapTime,
    }));

    this.io?.emit('positions:updated', positions);
  }

  /**
   * Obtenir l'état actuel
   */
  getState() {
    return {
      activeSessionId: this.activeSessionId,
      drivers: Array.from(this.sessionDrivers.entries()).map(
        ([carId, data]) => ({
          carId,
          ...data,
        })
      ),
    };
  }

  /**
   * Fermer les connexions
   */
  async close() {
    await this.prisma.$disconnect();
  }
}

export default SimulatorSyncService;
