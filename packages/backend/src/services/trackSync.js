import EventEmitter from 'events';
import { PrismaClient } from '@prisma/client';
import { ControlUnit } from './controlUnit.js';

/**
 * Service de synchronisation entre le Control Unit et la base de données
 * Gère les événements en temps réel et les enregistre dans la BDD
 */
export class TrackSyncService extends EventEmitter {
  constructor(io) {
    super();
    this.io = io;
    this.prisma = new PrismaClient();
    this.controlUnit = new ControlUnit();

    this.activeSessionId = null;
    this.activeTrackId = null;
    this.sessionDrivers = new Map(); // controller -> { driverId, carId, lapCount, lastLapTime, bestLapTime }
    this.lastStatus = null;
    this.raceFinishTime = null; // For 30s grace period in races
    this.raceStartTime = null;
    this.positions = new Map(); // controller -> position
    this.lastTimestamps = new Map(); // controller -> last timestamp
    this.currentPhase = 'free'; // 'free', 'qualif', 'race'

    // Écouter les événements du Control Unit
    this.setupControlUnitListeners();
  }

  /**
   * Configurer les listeners du Control Unit
   */
  setupControlUnitListeners() {
    this.controlUnit.on('connected', () => {
      this.emit('cu-connected');
      this.io?.emit('cu:connected');
    });

    this.controlUnit.on('disconnected', () => {
      this.emit('cu-disconnected');
      this.io?.emit('cu:disconnected');
    });

    this.controlUnit.on('reconnect-failed', () => {
      this.emit('cu-reconnect-failed');
      this.io?.emit('cu:reconnect-failed');
    });

    this.controlUnit.on('timer', (timerEvent) => {
      this.handleTimerEvent(timerEvent);
    });

    this.controlUnit.on('status', (status) => {
      this.handleStatus(status);
    });

    this.controlUnit.on('error', (error) => {
      this.emit('error', error);
    });
  }

  /**
   * Scanner pour trouver le Control Unit
   */
  async scan(timeout = 10000) {
    return this.controlUnit.scan(timeout);
  }

  /**
   * Se connecter au Control Unit
   */
  async connect(address = null) {
    await this.controlUnit.connect(address);
  }

  /**
   * Se déconnecter du Control Unit
   */
  async disconnect() {
    await this.controlUnit.disconnect();
  }

  /**
   * Récupérer la version du Control Unit
   */
  async getVersion() {
    return this.controlUnit.version();
  }

  /**
   * Réinitialiser pour une nouvelle session
   * - Reset le timer du CU
   * - Efface la Position Tower
   * - Reset les compteurs internes
   */
  async resetForNewSession() {
    // Reset internal state
    this.sessionDrivers.clear();
    this.positions.clear();
    this.lastTimestamps.clear();
    this.raceStartTime = null;
    this.raceFinishTime = null;

    // Reset CU if connected
    if (this.controlUnit?.isConnected()) {
      try {
        await this.controlUnit.reset();
        await this.controlUnit.clearPosition();
        console.log('🔄 CU reset for new session');
      } catch (e) {
        console.warn('Could not reset CU:', e.message);
      }
    }

    this.emit('session-reset');
  }

  /**
   * Démarrer la course sur le Control Unit (bouton START)
   */
  async startRace() {
    return this.controlUnit.start();
  }

  /**
   * Appuyer sur ESC/Pace Car (arrêter la course)
   */
  async pressEsc() {
    return this.controlUnit.press(1); // PACE_CAR_ESC_BUTTON_ID
  }

  /**
   * Appuyer sur un bouton du Control Unit
   */
  async pressButton(buttonId) {
    return this.controlUnit.press(buttonId);
  }

  /**
   * Réinitialiser le timer du Control Unit
   */
  async resetTimer() {
    return this.controlUnit.reset();
  }

  /**
   * Effacer l'affichage de la Position Tower
   */
  async clearPosition() {
    return this.controlUnit.clearPosition();
  }

  /**
   * Définir la vitesse d'un controller
   */
  async setSpeed(address, value) {
    return this.controlUnit.setSpeed(address, value);
  }

  /**
   * Définir le frein d'un controller
   */
  async setBrake(address, value) {
    return this.controlUnit.setBrake(address, value);
  }

  /**
   * Définir le fuel d'un controller
   */
  async setFuel(address, value) {
    return this.controlUnit.setFuel(address, value);
  }

  /**
   * Arrêter les voitures (passe en mode lights 1/5)
   */
  async powerOff() {
    // Appuyer sur START pour passer en mode décompte (lights 1/5)
    await this.controlUnit.press(2); // START_ENTER_BUTTON_ID = 2
  }

  /**
   * Relancer les voitures (lance le décompte complet)
   */
  async powerOn() {
    // Appuyer sur START pour lancer le décompte
    await this.controlUnit.press(2);
  }

  /**
   * Charger la session active
   */
  async loadActiveSession() {
    const session = await this.prisma.session.findFirst({
      where: {
        status: 'running',
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
      this.raceStartTime = session.startedAt;
      this.currentPhase = session.type === 'qualifying' ? 'qualif' : 'race';

      // Charger les pilotes dans la map
      this.sessionDrivers.clear();
      this.activeTrackId = session.trackId;
      for (const sd of session.drivers) {
        this.sessionDrivers.set(sd.controller, {
          sessionDriverId: sd.id,
          driverId: sd.driverId,
          carId: sd.carId,
          driver: sd.driver,
          car: sd.car,
          lapCount: 0,
          lastLapTime: null,
          bestLapTime: null,
          position: sd.position || 0,
        });
      }

      // Compter les tours déjà enregistrés
      for (const [controller, driverData] of this.sessionDrivers) {
        const lapCount = await this.prisma.lap.count({
          where: {
            sessionId: this.activeSessionId,
            controller,
          },
        });
        driverData.lapCount = lapCount;
      }

    }

    return session;
  }

  /**
   * Démarrer une session
   */
  async startSession(sessionId) {
    // Récupérer les infos du Control Unit
    let cuInfo = null;
    if (this.controlUnit.isConnected()) {
      try {
        cuInfo = await this.controlUnit.getInfo();
      } catch {
        // CU info not available
      }
    }

    // Mettre à jour la session en BDD avec les infos CU
    await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        status: 'running',
        startedAt: new Date(),
        ...(cuInfo && {
          cuVersion: cuInfo.version,
          cuFuelMode: cuInfo.fuelMode,
          cuRealMode: cuInfo.realMode,
          cuPitLane: cuInfo.pitLane,
          cuLapCounter: cuInfo.lapCounter,
          cuNumCars: cuInfo.numCars,
        }),
      },
    });

    // Charger la session
    await this.loadActiveSession();

    // Démarrer la course sur le Control Unit
    if (this.controlUnit.isConnected()) {
      await this.controlUnit.start();
    }

    this.emit('session-started', sessionId);
    this.io?.emit('session:started', { sessionId });
  }

  /**
   * Arrêter la session active
   */
  async stopSession() {
    if (!this.activeSessionId) {
      return;
    }

    // Mettre à jour la session en BDD
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
    this.raceStartTime = null;
    this.currentPhase = 'free';

    this.emit('session-stopped', sessionId);
    this.io?.emit('session:stopped', { sessionId });
  }

  /**
   * Gérer un événement timer (passage sur la ligne)
   */
  async handleTimerEvent(timerEvent) {
    const { address, timestamp, sector } = timerEvent;

    // Trouver le pilote correspondant
    const controller = (address + 1).toString(); // Les addresses commencent à 0, les controllers à 1

    // Calculer le temps du tour
    const lastTimestamp = this.lastTimestamps.get(controller) || 0;
    const lapTime = lastTimestamp > 0 ? timestamp - lastTimestamp : 0;
    this.lastTimestamps.set(controller, timestamp);

    // Émettre l'événement pour le frontend
    this.io?.emit('cu:timer', {
      controller,
      address,
      timestamp,
      lapTime,
      sector,
      raw: true
    });

    const driverData = this.sessionDrivers.get(controller);

    if (!driverData) {
      return;
    }

    // Enregistrer le tour en BDD
    if (this.activeSessionId && this.activeTrackId && sector === 1) {
      // Sector 1 = ligne de départ/arrivée
      try {
        const lap = await this.prisma.lap.create({
          data: {
            sessionId: this.activeSessionId,
            trackId: this.activeTrackId,
            driverId: driverData.driverId,
            carId: driverData.carId,
            controller,
            phase: this.currentPhase || 'race',
            lapNumber: driverData.lapCount + 1,
            lapTime: lapTime,
            fuelBefore: this.lastStatus?.fuel?.[address],
            fuelAfter: this.lastStatus?.fuel?.[address],
          },
        });

        driverData.lapCount++;
        driverData.lastLapTime = lapTime;
        // Update best lap time
        if (lapTime > 0 && (driverData.bestLapTime === null || lapTime < driverData.bestLapTime)) {
          driverData.bestLapTime = lapTime;
        }

        // Calculer les positions
        await this.updatePositions();

        // Émettre l'événement
        const lapData = {
          ...lap,
          driver: driverData.driver,
          car: driverData.car,
        };

        this.emit('lap-completed', lapData);
        this.io?.emit('lap:completed', lapData);

        // Créer un événement de course
        await this.prisma.raceEvent.create({
          data: {
            sessionId: this.activeSessionId,
            type: 'lap',
            data: JSON.stringify({
              driverId: driverData.driverId,
              controller,
              lapNumber: driverData.lapCount,
              lapTime,
            }),
          },
        });

        // Vérifier si la session doit s'arrêter
        await this.checkSessionComplete();
      } catch (error) {
        this.emit('error', error);
      }
    }
  }

  /**
   * Gérer un événement status
   */
  handleStatus(status) {
    this.lastStatus = status;

    // Émettre le status aux clients
    this.io?.emit('cu:status', status);

    // Vérifier le mode de départ
    if (status.start > 0 && !this.raceStartTime) {
      this.emit('race-starting', status.start);
      this.io?.emit('race:starting', { countdown: status.start });
    }
  }

  /**
   * Mettre à jour les positions des pilotes
   */
  async updatePositions() {
    if (!this.activeSessionId) return;

    // Récupérer tous les tours pour calculer les positions
    const drivers = Array.from(this.sessionDrivers.entries()).map(
      ([controller, data]) => ({
        controller,
        ...data,
      })
    );

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
      driver.position = i + 1;
      this.sessionDrivers.get(driver.controller).position = i + 1;

      // Mettre à jour en BDD
      await this.prisma.sessionDriver.update({
        where: { id: driver.sessionDriverId },
        data: { position: i + 1 },
      });
    }

    // Émettre les positions mises à jour
    const positions = drivers.map((d) => ({
      controller: d.controller,
      position: d.position,
      driverId: d.driverId,
      driver: d.driver,
      lapCount: d.lapCount,
      lastLapTime: d.lastLapTime,
      bestLapTime: d.bestLapTime,
    }));

    this.emit('positions-updated', positions);
    this.io?.emit('positions:updated', positions);
  }

  /**
   * Vérifier si la session doit s'arrêter automatiquement
   */
  async checkSessionComplete() {
    if (!this.activeSessionId) return;

    try {
      const session = await this.prisma.session.findUnique({
        where: { id: this.activeSessionId },
        include: { drivers: true, championship: true },
      });

      if (!session) return;
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

      // Vérifier le temps écoulé
      if (session.duration && session.startedAt) {
        const elapsed = Date.now() - new Date(session.startedAt).getTime();
        const durationMs = session.duration * 60 * 1000;

        if (elapsed >= durationMs) {
          shouldStop = true;
          reason = `Temps écoulé (${session.duration}min)`;
        }
      }

      // Vérifier le nombre de tours max
      if (session.maxLaps && !shouldStop) {
        const maxLapsReached = lapCounts.filter(l => l._count.id >= session.maxLaps);

        if (session.type === 'qualifying') {
          // QUALIF: Leader atteint X tours → autres peuvent finir leurs X tours
          if (maxLapsReached.length > 0 && session.status !== 'finishing') {
            shouldStartFinishing = true;
            reason = `Leader a terminé ${session.maxLaps} tours`;
          }

          if (session.status === 'finishing') {
            const driversWithLaps = session.drivers.filter(d => lapCountMap.has(d.controller));
            const allFinished = driversWithLaps.every(d => (lapCountMap.get(d.controller) || 0) >= session.maxLaps);

            if (allFinished && driversWithLaps.length > 0) {
              shouldStop = true;
              reason = `Tous les pilotes ont terminé ${session.maxLaps} tours`;
            }
          }
        } else {
          // COURSE: Leader atteint X tours → 30s pour finir tour actuel
          if (maxLapsReached.length > 0) {
            if (session.status !== 'finishing') {
              shouldStartFinishing = true;
              reason = `Leader a terminé ${session.maxLaps} tours`;
              this.raceFinishTime = Date.now();
            } else {
              const gracePeriod = 30000;
              if (this.raceFinishTime && Date.now() - this.raceFinishTime >= gracePeriod) {
                shouldStop = true;
                reason = `Délai de grâce écoulé (30s)`;
              }
            }
          }
        }
      }

      // Passer en mode "finishing"
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

      // Arrêter la session
      if (shouldStop) {
        await this.prisma.session.update({
          where: { id: this.activeSessionId },
          data: {
            status: 'finished',
            finishedAt: new Date(),
          },
        });

        // Arrêter le CU (passer en mode lights)
        if (this.controlUnit.isConnected()) {
          await this.controlUnit.start(); // Toggle to lights mode
        }

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
      console.error('Erreur vérification fin de session:', error);
    }
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
      connected: this.controlUnit.isConnected(),
      activeSessionId: this.activeSessionId,
      drivers: Array.from(this.sessionDrivers.entries()).map(
        ([controller, data]) => ({
          controller,
          ...data,
          driver: data.driver,
          car: data.car,
        })
      ),
      lastStatus: this.lastStatus,
    };
  }

  /**
   * Polling continu pour récupérer les événements
   */
  startPolling(interval = 100) {
    if (this.pollingTimer) {
      return;
    }

    this.pollingTimer = setInterval(async () => {
      if (this.controlUnit.isConnected()) {
        try {
          await this.controlUnit.poll();
        } catch {
          // Ignore polling errors
        }
      }
    }, interval);

  }

  /**
   * Arrêter le polling
   */
  stopPolling() {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  }

  /**
   * Fermer les connexions
   */
  async close() {
    this.stopPolling();
    await this.disconnect();
    await this.prisma.$disconnect();
  }
}

export default TrackSyncService;
