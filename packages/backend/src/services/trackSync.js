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
    this.sessionDrivers = new Map(); // controller -> { driverId, carId, lapCount, lastLapTime }
    this.lastStatus = null;
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
      for (const sd of session.drivers) {
        this.sessionDrivers.set(sd.controller, {
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
    if (this.activeSessionId && sector === 1) {
      // Sector 1 = ligne de départ/arrivée
      try {
        const lap = await this.prisma.lap.create({
          data: {
            sessionId: this.activeSessionId,
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
    }));

    this.emit('positions-updated', positions);
    this.io?.emit('positions:updated', positions);
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
