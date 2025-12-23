import { PrismaClient } from '@prisma/client';

/**
 * Service de synchronisation entre le Simulateur et la base de données
 * Unifié avec TrackSyncService - écoute les mêmes événements 'timer' que le CU
 */
export class SimulatorSyncService {
  constructor(simulator, io) {
    this.simulator = simulator;
    this.io = io;
    this.prisma = new PrismaClient();
    this.activeSessionId = null;
    this.activeTrackId = null;
    this.mapDriverByController = new Map(); // controller -> { driverId, carId, lapCount, lastLapTime, bestLapTime }
    this.lastTimestamps = new Map(); // controller -> last timestamp (like trackSync)
    this.currentPhase = 'free'; // 'free', 'qualif', 'race'
    this.raceFinishTime = null; // For 30s grace period in races

    // Écouter les événements du simulateur (même format que CU)
    this.setupListeners();
  }

  setupListeners() {
    // Listen to 'timer' events from simulator (same format as CU)
    this.simulator.on('timer', (timerEvent) => {
      this.handleTimerEvent(timerEvent);
    });
  }

  /**
   * Handle timer event (same format as CU)
   * Format: { controller: 0-5, timestamp: ms, sector: 1-3 }
   */
  async handleTimerEvent(timerEvent) {
    const { controller, timestamp, sector } = timerEvent;

    // Calculate lap time from timestamps
    const lastTimestamp = this.lastTimestamps.get(controller) || 0;
    const lapTime = lastTimestamp > 0 ? timestamp - lastTimestamp : 0;
    this.lastTimestamps.set(controller, timestamp);

    // Emit to frontend (like trackSync)
    this.io?.emit('cu:timer', {
      controller,
      timestamp,
      lapTime,
      sector,
    });

    // Only process sector 1 (finish line) for lap recording
    // Ignorer le premier passage (lapTime === 0) - ce n'est pas un vrai tour
    if (sector === 1 && this.activeSessionId && lapTime > 0) {
      await this.recordLapFromTimer(controller, lapTime);
    }
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
    this.mapDriverByController.clear();
    this.lastTimestamps.clear();
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
      this.currentPhase = session.type === 'qualif' ? 'qualif' : 'race';

      // Mapper les SessionDriver par controller (0-indexed)
      this.mapDriverByController.clear();
      for (const sd of session.drivers) {
        this.mapDriverByController.set(sd.controller, {
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
    this.mapDriverByController.clear();

    // Arrêter le simulateur
    this.simulator.stop();

    this.io?.emit('session:stopped', { sessionId });
  }

  /**
   * Enregistrer un tour depuis un événement timer
   * Appelé par handleTimerEvent (même pattern que trackSync)
   */
  async recordLapFromTimer(controller, lapTime) {
    if (!this.activeSessionId) {
      return;
    }

    // Map is keyed by controller (0-indexed int)
    const driverData = this.mapDriverByController.get(controller);

    if (!driverData) {
      console.warn(`⚠️  Controller ${controller} non mappé à un pilote. Keys: ${[...this.mapDriverByController.keys()].join(', ')}`);
      return;
    }

    // Increment lap count
    const lapNumber = driverData.lapCount + 1;

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

      // Update driver data BEFORE updatePositions so it has latest stats
      driverData.lapCount = lapNumber;
      driverData.lastLapTime = lapTime;
      if (lapTime > 0 && (driverData.bestLapTime == null || lapTime < driverData.bestLapTime)) {
        driverData.bestLapTime = lapTime;
      }

      // Calculer les positions (uses updated driverData)
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
        if (elapsed >= session.duration) {
          shouldStop = true;
          reason = `Temps écoulé (${Math.round(session.duration / 60000)}min)`;
        }
      }

      // Vérifier le nombre de tours max (logique différente pour qualif vs course)
      if (session.maxLaps && !shouldStop) {
        const maxLapsReached = lapCounts.filter(l => l._count.id >= session.maxLaps);

        if (session.type === 'qualif') {
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

        // Emit session_finished (for frontend to update)
        this.io?.emit('session_finished', {
          sessionId: this.activeSessionId,
          championshipId: session.championshipId,
          type: session.type,
          reason,
        });

        // Also emit session_status_changed for status update
        this.io?.emit('session_status_changed', {
          sessionId: this.activeSessionId,
          status: 'finished',
          previousStatus: 'active',
        });

        console.log(`🏁 Session finished: ${reason}`);

        // Notify frontend to refetch standings
        if (session.championshipId) {
          this.io?.emit('standings_changed', {
            event: 'standings_changed',
            data: {
              championshipId: session.championshipId,
              types: [session.type === 'qualif' ? 'qualif' : session.type]
            }
          });
        }

        // Clear state
        this.activeSessionId = null;
        this.activeTrackId = null;
        this.mapDriverByController.clear();
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
    for (const [carId, driverData] of this.mapDriverByController) {
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

    // Trier selon le type de session
    if (this.currentPhase === 'qualif') {
      // Qualif: tri par meilleur temps (ascending)
      drivers.sort((a, b) => {
        const bestA = a.bestLapTime || Infinity;
        const bestB = b.bestLapTime || Infinity;
        return bestA - bestB;
      });
    } else {
      // Race: tri par tours (desc) puis meilleur temps (asc)
      drivers.sort((a, b) => {
        if (b.lapCount !== a.lapCount) {
          return b.lapCount - a.lapCount;
        }
        const bestA = a.bestLapTime || Infinity;
        const bestB = b.bestLapTime || Infinity;
        return bestA - bestB;
      });
    }

    // Calculer les gaps
    const leader = drivers[0];
    const leaderBestLap = leader?.bestLapTime;
    const leaderLaps = leader?.lapCount || 0;

    // Mettre à jour les positions et stats
    for (let i = 0; i < drivers.length; i++) {
      const driver = drivers[i];
      await this.prisma.sessionDriver.update({
        where: { id: driver.sessionDriverId },
        data: {
          position: i + 1,
          totalLaps: driver.lapCount,
          bestLapTime: driver.bestLapTime,
          lastLapTime: driver.lastLapTime,
        },
      });
    }

    const positions = drivers.map((d, i) => {
      let gap = null;

      if (i === 0) {
        gap = null; // Leader
      } else if (this.currentPhase === 'qualif') {
        // Qualif: écart en temps
        if (leaderBestLap && d.bestLapTime) {
          gap = d.bestLapTime - leaderBestLap;
        }
      } else {
        // Race: écart en tours ou en temps
        const lapDiff = leaderLaps - d.lapCount;
        if (lapDiff > 0) {
          gap = `+${lapDiff} tour${lapDiff > 1 ? 's' : ''}`;
        } else if (leaderBestLap && d.bestLapTime) {
          gap = d.bestLapTime - leaderBestLap;
        }
      }

      return {
        controller: d.controller,
        position: i + 1,
        driverId: d.driverId,
        driver: d.driver,
        lapCount: d.lapCount,
        lastLapTime: d.lastLapTime,
        bestLapTime: d.bestLapTime,
        gap,
      };
    });

    this.io?.emit('positions:updated', positions);
  }

  /**
   * Obtenir l'état actuel
   */
  getState() {
    return {
      activeSessionId: this.activeSessionId,
      drivers: Array.from(this.mapDriverByController.entries()).map(
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
