/**
 * SyncService - Synchronisation hardware CU/Simulator
 *
 * Responsabilite unique : formater les donnees hardware et les transmettre
 * - Ecoute CU/Simulator events
 * - Formate les donnees (calcul lapTime depuis timestamps)
 * - Emet cu:* events pour le frontend (logs/footer)
 * - Appelle SessionService pour la logique session
 */
export class SyncService {
  constructor(eventSource, io) {
    this.source = eventSource; // ControlUnit ou Simulator
    this.io = io;
    this.sessionService = null;

    // Timestamps pour calcul lapTime
    this.lastTimestamps = new Map(); // controller -> timestamp

    // CU status & polling
    this.cuStatus = null;
    this.pollInterval = 500;
    this.pollTimer = null;

    this.setupListeners();
  }

  setSessionService(sessionService) {
    this.sessionService = sessionService;
  }

  // ==================== Event Listeners ====================

  setupListeners() {
    this.source.on('timer', (event) => this.handleTimerEvent(event));
    this.source.on('status', (status) => this.handleStatus(status));

    if (this.source.on) {
      this.source.on('connected', () => {
        this.io?.emit('cu:connected');
      });
      this.source.on('disconnected', () => {
        this.io?.emit('cu:disconnected');
      });
    }
  }

  // ==================== Hardware Event Handlers ====================

  /**
   * Handle timer event from CU/Simulator
   * Format: { controller: 0-5, timestamp: ms, sector: 1-3 }
   */
  async handleTimerEvent(event) {
    const { controller, timestamp, sector } = event;

    // Calculate lap time from timestamps
    const lastTimestamp = this.lastTimestamps.get(controller) || 0;
    const lapTime = lastTimestamp > 0 ? timestamp - lastTimestamp : 0;
    this.lastTimestamps.set(controller, timestamp);

    // Emit raw timer (for frontend logs/footer)
    this.io?.emit('cu:timer', { controller, timestamp, lapTime, sector });

    // Forward formatted data to SessionService
    if (this.sessionService?.isActive()) {
      await this.sessionService.handleLap({ controller, timestamp, lapTime, sector });
    }
  }

  /**
   * Handle status event from CU
   */
  handleStatus(status) {
    const wasInLights = this.isInLightsSequence(this.cuStatus);
    const isInLights = this.isInLightsSequence(status);

    this.cuStatus = status;
    this.io?.emit('cu:status', status);

    // Adaptive polling: faster during lights sequence
    if (isInLights && !wasInLights) {
      this.setPollInterval(100);
    } else if (!isInLights && wasInLights) {
      this.setPollInterval(500);
    }
  }

  isInLightsSequence(status) {
    if (!status) return false;
    return status.start >= 1 && status.start <= 7;
  }

  // ==================== Polling ====================

  setPollInterval(ms) {
    if (this.pollInterval === ms) return;
    this.pollInterval = ms;

    if (this.pollTimer) {
      this.stopPolling();
      this.startPolling();
    }
  }

  startPolling() {
    if (this.pollTimer) return;

    const poll = async () => {
      try {
        if (this.source.poll && this.source.connected) {
          await this.source.poll();
        }
      } catch (error) {
        console.warn('[SyncService] Poll error:', error.message);
      }
      this.pollTimer = setTimeout(poll, this.pollInterval);
    };

    poll();
  }

  stopPolling() {
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
  }

  // ==================== CU Control ====================

  async startRace() {
    if (this.source.start) {
      await this.source.start();
    }
    if (this.source.startRace) {
      await this.source.startRace();
    }
  }

  async stopRace() {
    if (this.source.pressEsc) {
      await this.source.pressEsc();
    } else if (this.source.stop) {
      await this.source.stop();
    }
  }

  async pressButton(button) {
    if (this.source.pressButton) {
      await this.source.pressButton(button);
    }
  }

  async reset() {
    this.lastTimestamps.clear();
    if (this.source.reset) {
      await this.source.reset();
    }
    if (this.source.clearPosition) {
      await this.source.clearPosition();
    }
  }

  // ==================== Getters ====================

  getCuStatus() {
    return this.cuStatus;
  }

  isConnected() {
    return this.source.isConnected?.() || false;
  }

  getInfo() {
    return this.source.getInfo?.() || {
      version: 'UNKNOWN',
      fuelMode: false,
      realMode: false,
      pitLane: false,
      lapCounter: false,
      numCars: 0,
    };
  }

  getState() {
    return {
      connected: this.isConnected(),
      cuStatus: this.cuStatus,
      pollInterval: this.pollInterval,
    };
  }

  close() {
    this.stopPolling();
  }
}

export default SyncService;
