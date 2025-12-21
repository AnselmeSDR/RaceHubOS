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
    this.sessionDrivers = new Map(); // carId -> { driverId, carId, controller, lapCount, lastLapTime, bestLapTime }
    this.currentPhase = 'free'; // 'free', 'qualif', 'race'
    this.raceFinishTime = null; // For 30s grace period in races

    // Écouter les événements du simulateur
    this.setupListeners();
  }

  setupListeners() {
    // Le simulateur émet des événements via io, pas besoin de listeners ici
  }

  /**
   * Réinitialiser pour une nouvelle session
   * - Arrête le simulateur
   * - Reset le timer du simulateur (compteurs à 0)
   * - Efface les positions
   * - Reset les compteurs internes
   */
  async resetForNewSession() {
    console.log('🔄 SimulatorSync: resetForNewSession called');

    // Reset internal state
    this.sessionDrivers.clear();
    this.raceFinishTime = null;
    this.activeSessionId = null;

    // Stop and reset simulator
    if (this.simulator) {
      this.simulator.stop();
      this.simulator.resetTimer();
      this.simulator.clearPosition();
      console.log('🔄 Simulator stopped and reset for new session');
    }
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
          lapCount: 0,
          lastLapTime: null,
          bestLapTime: null,
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

    // Démarrer le simulateur et lancer la course
    this.simulator.start();
    await this.simulator.startRace();

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
      console.warn(`⚠️  Voiture ${carId} non mappée à un pilote. Keys: ${[...this.sessionDrivers.keys()].join(', ')}`);
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

      // Update driver data
      driverData.lapCount = lapNumber;
      driverData.lastLapTime = lapTime;
      if (lapTime > 0 && (driverData.bestLapTime === null || lapTime < driverData.bestLapTime)) {
        driverData.bestLapTime = lapTime;
      }

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
        include: {
          drivers: true,
          championship: true,
        },
      });

      if (!session) return;
      // Allow checking for both 'active' and 'finishing' status
      if (session.status !== 'active' && session.status !== 'finishing') return;

      let shouldStop = false;
      let shouldStartFinishing = false;
      let reason = '';

      // Get lap counts per driver
      const lapCounts = await this.prisma.lap.groupBy({
        by: ['controller'],
        where: { sessionId: this.activeSessionId },
        _count: { id: true },
      });

      const lapCountMap = new Map(lapCounts.map(l => [l.controller, l._count.id]));
      const activeDrivers = session.drivers.filter(d => lapCountMap.has(d.controller) || session.status === 'active');

      // Vérifier le temps écoulé (pour qualif/course avec durée)
      if (session.duration && session.startedAt) {
        const elapsed = Date.now() - new Date(session.startedAt).getTime();
        const durationMs = session.duration * 60 * 1000;

        if (elapsed >= durationMs) {
          shouldStop = true;
          reason = `Temps écoulé (${session.duration}min)`;
        }
      }

      // Vérifier le nombre de tours max (logique différente pour qualif vs course)
      if (session.maxLaps && !shouldStop) {
        const maxLapsReached = lapCounts.filter(l => l._count.id >= session.maxLaps);

        if (session.type === 'qualifying') {
          // QUALIF: Leader atteint X tours → autres peuvent finir leurs X tours
          if (maxLapsReached.length > 0 && session.status !== 'finishing') {
            // Au moins un pilote a atteint X tours, passer en mode "finishing"
            shouldStartFinishing = true;
            reason = `Leader a terminé ${session.maxLaps} tours`;
          }

          if (session.status === 'finishing') {
            // Vérifier si TOUS les pilotes actifs ont terminé X tours
            const driversWithLaps = session.drivers.filter(d => lapCountMap.has(d.controller));
            const allFinished = driversWithLaps.every(d => (lapCountMap.get(d.controller) || 0) >= session.maxLaps);

            if (allFinished && driversWithLaps.length > 0) {
              shouldStop = true;
              reason = `Tous les pilotes ont terminé ${session.maxLaps} tours`;
            }
          }
        } else {
          // COURSE: Leader atteint X tours → 30s pour les autres pour finir tour actuel
          if (maxLapsReached.length > 0) {
            if (session.status !== 'finishing') {
              shouldStartFinishing = true;
              reason = `Leader a terminé ${session.maxLaps} tours`;
              // Store finish time for 30s grace period
              this.raceFinishTime = Date.now();
            } else {
              // Check 30s grace period
              const gracePeriod = 30000; // 30 seconds
              if (this.raceFinishTime && Date.now() - this.raceFinishTime >= gracePeriod) {
                shouldStop = true;
                reason = `Délai de grâce écoulé (30s)`;
              }
            }
          }
        }
      }

      // Passer en mode "finishing" si nécessaire
      if (shouldStartFinishing && !shouldStop) {
        await this.prisma.session.update({
          where: { id: this.activeSessionId },
          data: { status: 'finishing' },
        });

        this.io?.emit('session:finishing', {
          sessionId: this.activeSessionId,
          type: session.type,
          reason,
        });

        console.log(`🏁 Session entering finishing state: ${reason}`);
      }

      // Arrêter la session si nécessaire
      if (shouldStop) {
        await this.prisma.session.update({
          where: { id: this.activeSessionId },
          data: {
            status: 'finished',
            finishedAt: new Date(),
          },
        });

        // Arrêter le simulateur (passe en mode lights)
        this.simulator.stop();

        this.io?.emit('session:auto-stopped', {
          sessionId: this.activeSessionId,
          type: session.type,
          reason,
        });

        console.log(`🛑 Session auto-stopped: ${reason}`);

        // Recalculate championship standings if session belongs to a championship
        if (session.championshipId) {
          await this.recalculateChampionshipStandings(session.championshipId);
          console.log(`📊 Championship standings recalculated for ${session.championshipId}`);
        }

        // Clear state
        this.activeSessionId = null;
        this.activeTrackId = null;
        this.sessionDrivers.clear();
        this.raceFinishTime = null;
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
      bestLapTime: d.bestLapTime,
    }));

    this.io?.emit('positions:updated', positions);
  }

  /**
   * Recalculate championship standings after a session finishes
   */
  async recalculateChampionshipStandings(championshipId) {
    const championship = await this.prisma.championship.findUnique({
      where: { id: championshipId },
      include: {
        sessions: {
          where: { status: 'finished' },
          include: {
            drivers: { include: { driver: true } },
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

    championship.sessions.forEach(session => {
      session.drivers.forEach(sd => {
        if (sd.finalPos !== null) {
          initDriver(sd.driverId);
          const points = pointsSystem[sd.finalPos] || 0;
          driverStats[sd.driverId].points += points;
          if (sd.finalPos === 1) driverStats[sd.driverId].wins++;
          if (sd.finalPos <= 3) driverStats[sd.driverId].podiums++;
        }
      });

      session.laps.forEach(lap => {
        initDriver(lap.driverId);
        const lapTimeMs = Math.round(lap.lapTime);

        if (lap.phase === 'qualif' || lap.phase === 'qualifying') {
          const current = driverStats[lap.driverId].qualifBestTime;
          if (current === null || lapTimeMs < current) {
            driverStats[lap.driverId].qualifBestTime = lapTimeMs;
          }
        }

        if (lap.phase === 'race') {
          driverStats[lap.driverId].raceTotalLaps++;
          driverStats[lap.driverId].raceTotalTime += lapTimeMs;
        }
      });
    });

    const sortedDrivers = Object.entries(driverStats)
      .sort((a, b) => {
        if (b[1].points !== a[1].points) return b[1].points - a[1].points;
        return b[1].wins - a[1].wins;
      })
      .map(([driverId, stats], index) => ({
        championshipId,
        driverId,
        position: index + 1,
        ...stats,
      }));

    await this.prisma.championshipStanding.deleteMany({ where: { championshipId } });
    if (sortedDrivers.length > 0) {
      await this.prisma.championshipStanding.createMany({ data: sortedDrivers });
    }
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
