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
  constructor(io) {
    this.source = null; // ControlUnit ou Simulator (set via setDevice)
    this.io = io;
    this.sessionService = null;

    // Timestamps pour calcul lapTime
    this.lastTimestamps = new Map(); // controller -> timestamp

    // CU status & polling
    this.cuStatus = null;
    this.pollInterval = 500;
    this.pollTimer = null;

    // Bound handlers for cleanup
    this._onTimer = (event) => this.handleTimerEvent(event);
    this._onStatus = (status) => this.handleStatus(status);
    this._onConnected = () => this.io?.emit('cu:connected');
    this._onDisconnected = () => this.io?.emit('cu:disconnected');
  }

  setSessionService(sessionService) {
    this.sessionService = sessionService;
  }

  // ==================== Device Management ====================

  /**
   * Set active device (hot-swap support)
   * @param {ControlUnit|CarreraSimulator} device
   */
  setDevice(device) {
    // Remove listeners from old device
    if (this.source) {
      this.stopPolling();
      this.source.off('timer', this._onTimer);
      this.source.off('status', this._onStatus);
      this.source.off('connected', this._onConnected);
      this.source.off('disconnected', this._onDisconnected);
    }

    // Clear state
    this.lastTimestamps.clear();
    this.cuStatus = null;

    // Set new device
    this.source = device;

    if (device) {
      this.setupListeners();
    }
  }

  /**
   * Get current device
   */
  getDevice() {
    return this.source;
  }

  // ==================== Event Listeners ====================

  setupListeners() {
    if (!this.source) return;

    this.source.on('timer', this._onTimer);
    this.source.on('status', this._onStatus);
    this.source.on('connected', this._onConnected);
    this.source.on('disconnected', this._onDisconnected);
  }

  // ==================== Hardware Event Handlers ====================

  /**
   * Handle timer event from CU/Simulator
   * Format: { controller: 0-5, timestamp: ms, sector: 1-3 }
   */
  async handleTimerEvent(event) {
    const { controller, timestamp, sector } = event;
    const isFinishLine = sector === 1;

    let lapTime = 0;
    if (isFinishLine && timestamp > 0) {
      const lastTimestamp = this.lastTimestamps.get(controller) || 0;
      lapTime = lastTimestamp > 0 ? timestamp - lastTimestamp : 0;
      if (lapTime >= 0) {
        this.lastTimestamps.set(controller, timestamp);
      } else {
        lapTime = 0; // CU glitch, treat as first pass
      }
    }

    // Emit raw timer (for frontend logs/footer)
    this.io?.emit('cu:timer', { controller, timestamp, lapTime, sector, isFinishLine });

    // Only forward finish line crossings to SessionService
    if (isFinishLine && this.sessionService?.isActive()) {
      await this.sessionService.handleLap({ controller, timestamp, lapTime, sector });
    }
  }

  /**
   * Handle status event from CU
   */
  handleStatus(status) {
    const wasInLights = this.isInLightsSequence(this.cuStatus);
    const isInLights = this.isInLightsSequence(status);
    const isNowRacing = status?.start === 0;
    const wasNotRacing = this.cuStatus?.start !== 0;

    const wasNotInLights = !wasInLights;
    const isFirstLight = status?.start === 1;

    this.cuStatus = status;
    this.io?.emit('cu:status', status);

    // Reset CU when entering 1/5 lights (clean slate before race)
    if (isFirstLight && wasNotInLights) {
      this.reset();
    }

    // Detect transition to racing (GO!) - start the timer
    if (isNowRacing && wasNotRacing && wasInLights) {
      this.sessionService?.onRaceStart();
    }

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
    if (this.pollTimer || !this.source) return;

    const poll = async () => {
      try {
        if (this.source?.poll && this.source?.isConnected?.()) {
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

  /**
   * Prepare race - puts CU in L1 state and waits
   */
  async prepareRace() {
    if (!this.source) return;
    if (this.source.start) {
      await this.source.start();
    }
  }

  /**
   * Start race - triggers START button (advances lights or starts countdown)
   */
  async startRace() {
    if (!this.source) return;
    if (this.source.start) {
      await this.source.start();
    }
  }

  async stopRace() {
    if (!this.source) return;
    if (this.source.pressEsc) {
      await this.source.pressEsc();
    } else if (this.source.stop) {
      await this.source.stop();
    }
  }

  async pressButton(button) {
    if (this.source?.pressButton) {
      await this.source.pressButton(button);
    }
  }

  async reset() {
    this.lastTimestamps.clear();
    this.io?.emit('cu:reset');
    if (this.source?.reset) {
      await this.source.reset();
    }
    if (this.source?.clearPosition) {
      await this.source.clearPosition();
    }
  }

  // ==================== Getters ====================

  getCuStatus() {
    return this.cuStatus;
  }

  isConnected() {
    return this.source?.isConnected?.() || false;
  }

  getInfo() {
    return this.source?.getInfo?.() || {
      version: 'NOT CONNECTED',
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
