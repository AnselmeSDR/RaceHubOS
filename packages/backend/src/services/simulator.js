import EventEmitter from 'events';

/**
 * Carrera Control Unit Simulator
 * Simulates the AppConnect 30369 Bluetooth device for development
 * Emits the same 'timer' events as the real Control Unit for unified handling.
 */

// CU State values (matching real CU protocol)
const CU_STATE = {
  RACING: 0,
  LIGHTS_1: 1,
  LIGHTS_2: 2,
  LIGHTS_3: 3,
  LIGHTS_4: 4,
  LIGHTS_5: 5,
  FALSE_START: 6,
  GO: 7,
  STOPPED: 9,
};

// Mode flags
const MODE_FLAGS = {
  FUEL: 1,
  REAL: 2,
  PIT_LANE: 4,
  LAP_COUNTER: 8,
};

// Virtual device address
export const SIMULATOR_ADDRESS = 'SIMULATOR';

export class CarreraSimulator extends EventEmitter {
  constructor(io) {
    super();
    this.io = io;
    this.connected = false; // Connection state
    this.isRunning = false;
    this.raceActive = false;
    this.cars = [];
    this.raceTime = 0;
    this.interval = null;
    this.tickRate = 100; // Update every 100ms

    // CU status (simulated)
    this.cuState = CU_STATE.STOPPED; // start field
    this.cuMode = MODE_FLAGS.LAP_COUNTER; // Default: Lap Counter only (no fuel)
    this.cuDisplay = 6; // Number of cars to display
    this.statusInterval = null;
  }

  // ==================== Device Interface (aligned with ControlUnit) ====================

  /**
   * Check if simulator is connected
   */
  isConnected() {
    return this.connected;
  }

  /**
   * Connect to simulator (virtual)
   */
  async connect() {
    if (this.connected) {
      return { success: true, message: 'Already connected' };
    }

    this.connected = true;
    this.init(6);
    this.startStatusPolling(200);
    this.emit('connected');

    return { success: true, message: 'Connected to Simulator' };
  }

  /**
   * Disconnect from simulator
   */
  async disconnect() {
    if (!this.connected) {
      return { success: true, message: 'Already disconnected' };
    }

    this.stop();
    this.stopStatusPolling();
    this.connected = false;
    this.emit('disconnected');

    return { success: true, message: 'Disconnected from Simulator' };
  }

  /**
   * Get simulator version
   */
  async version() {
    return 'SIMULATOR-1.0';
  }

  /**
   * Get device info (aligned with ControlUnit.getInfo)
   */
  async getInfo() {
    return {
      version: await this.version(),
      fuelMode: (this.cuMode & MODE_FLAGS.FUEL) !== 0,
      realMode: (this.cuMode & MODE_FLAGS.REAL) !== 0,
      pitLane: (this.cuMode & MODE_FLAGS.PIT_LANE) !== 0,
      lapCounter: (this.cuMode & MODE_FLAGS.LAP_COUNTER) !== 0,
      numCars: this.cuDisplay,
    };
  }

  /**
   * Initialize simulator with car configuration
   */
  init(carCount = 6) {
    this.cars = Array.from({ length: carCount }, (_, i) => ({
      id: i + 1,
      position: i + 1,
      currentLap: 0,
      totalLaps: 0,
      lastLapTime: 0,
      bestLapTime: null,
      fuel: 15, // 0-15 scale
      speed: 0,
      inPit: false,
      totalTime: 0,
      sectorTimes: [0, 0, 0],
      currentSector: 0,
    }));

  }

  /**
   * Start the simulator (prepare for race - Lights 1)
   */
  start() {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.raceActive = false; // Not racing yet, waiting for START
    this.raceTime = 0;
    this.cuState = CU_STATE.LIGHTS_1; // Ready, waiting for START

    this.interval = setInterval(() => {
      this.tick();
    }, this.tickRate);

    this.emitRaceStatus();
    this.emitCuStatus();
  }

  /**
   * Stop the simulator
   */
  stop() {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    this.raceActive = false;
    this.cuState = CU_STATE.STOPPED; // Set CU to stopped state

    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    this.emitRaceStatus();
    this.emitCuStatus();
  }

  /**
   * Pause/resume the race
   */
  togglePause() {
    this.raceActive = !this.raceActive;
    this.emitRaceStatus();
  }

  /**
   * Main simulation tick
   */
  tick() {
    if (!this.raceActive) {
      return;
    }

    this.raceTime += this.tickRate;

    this.cars.forEach((car) => {
      // Simulate speed variation (realistic racing)
      const baseSpeed = 8 + Math.random() * 4; // 8-12 speed units
      car.speed = Math.max(0, Math.min(15, baseSpeed));

      // Simulate sector progression
      this.simulateSectorProgress(car);
    });

    // Emit updates every second
    if (this.raceTime % 1000 === 0) {
      this.emitCarData();
      this.emitLeaderboard();
    }
  }

  /**
   * Simulate car progressing through track sectors
   */
  simulateSectorProgress(car) {
    const sectorDuration = 8000 + Math.random() * 4000; // 8-12 seconds per sector
    car.sectorTimes[car.currentSector] += this.tickRate;

    if (car.sectorTimes[car.currentSector] >= sectorDuration) {
      // Complete sector
      const sectorTime = car.sectorTimes[car.currentSector];

      this.io.emit('race:sector', {
        carId: car.id,
        sector: car.currentSector + 1,
        time: sectorTime,
        timestamp: Date.now(),
      });

      // Move to next sector
      car.currentSector++;

      if (car.currentSector >= 3) {
        // Completed a lap
        this.completeLap(car);
        car.currentSector = 0;
      }

      car.sectorTimes[car.currentSector] = 0;
    }
  }

  /**
   * Handle lap completion
   * Emits 'timer' event like the real CU for unified handling
   */
  completeLap(car) {
    const lapTime = car.sectorTimes.reduce((sum, time) => sum + time, 0);
    car.lastLapTime = lapTime;
    car.totalLaps++;
    car.currentLap++;
    car.totalTime += lapTime;

    if (!car.bestLapTime || lapTime < car.bestLapTime) {
      car.bestLapTime = lapTime;
    }

    // Emit 'timer' event like real CU for unified handling
    // Format: { controller: 0-5, timestamp: ms, sector: 1-3 }
    // sector 1 = finish line
    this.emit('timer', {
      controller: car.id - 1, // 0-indexed (car.id is 1-indexed)
      timestamp: car.totalTime, // Accumulated time as timestamp
      sector: 1, // Finish line = sector 1
    });

    // Also emit to WebSocket for frontend
    this.io.emit('race:lap', {
      carId: car.id,
      lapNumber: car.totalLaps,
      lapTime: lapTime,
      bestLap: car.bestLapTime,
      timestamp: Date.now(),
    });

    // Reset sector times
    car.sectorTimes = [0, 0, 0];
  }

  /**
   * Handle pit stop logic
   */
  handlePitStop(car) {
    if (!car.pitTimer) {
      car.pitTimer = 0;
    }

    car.pitTimer += this.tickRate;

    // Pit stop takes 3-5 seconds
    const pitDuration = 3000 + Math.random() * 2000;

    if (car.pitTimer >= pitDuration) {
      car.fuel = 15; // Refuel
      car.inPit = false;
      car.pitTimer = 0;

      this.io.emit('race:pitStop', {
        carId: car.id,
        duration: pitDuration,
        timestamp: Date.now(),
      });

    }
  }

  /**
   * Emit car data to connected clients
   */
  emitCarData() {
    const carData = this.cars.map((car) => ({
      id: car.id,
      position: car.position,
      currentLap: car.currentLap,
      totalLaps: car.totalLaps,
      lastLapTime: car.lastLapTime,
      bestLapTime: car.bestLapTime,
      fuel: Math.round(car.fuel),
      speed: Math.round(car.speed),
      inPit: car.inPit,
      totalTime: car.totalTime,
    }));

    this.io.emit('race:carData', carData);
  }

  /**
   * Emit leaderboard based on current positions
   */
  emitLeaderboard() {
    // Sort by laps completed, then by total time
    const sorted = [...this.cars].sort((a, b) => {
      if (b.totalLaps !== a.totalLaps) {
        return b.totalLaps - a.totalLaps;
      }
      return a.totalTime - b.totalTime;
    });

    // Update positions
    sorted.forEach((car, index) => {
      const originalCar = this.cars.find((c) => c.id === car.id);
      if (originalCar) {
        originalCar.position = index + 1;
      }
    });

    const leaderboard = sorted.map((car, index) => ({
      position: index + 1,
      carId: car.id,
      laps: car.totalLaps,
      lastLapTime: car.lastLapTime,
      bestLapTime: car.bestLapTime,
      gap: index === 0 ? null : car.totalTime - sorted[0].totalTime,
    }));

    this.io.emit('race:leaderboard', leaderboard);
  }

  /**
   * Emit race status
   */
  emitRaceStatus() {
    this.io.emit('race:status', {
      running: this.isRunning,
      active: this.raceActive,
      raceTime: this.raceTime,
      carCount: this.cars.length,
      isMockDevice: true
    });
  }

  /**
   * Set car speed manually (for testing)
   */
  setCarSpeed(carId, speed) {
    const car = this.cars.find((c) => c.id === carId);
    if (car) {
      car.speed = Math.max(0, Math.min(15, speed));
    }
  }

  /**
   * Get simulator state
   */
  getState() {
    return {
      running: this.isRunning,
      active: this.raceActive,
      raceTime: this.raceTime,
      cars: this.cars,
      connected: this.connected,
      lastStatus: this.getCuStatus(),
    };
  }

  /**
   * Get current CU status (matches real CU format)
   */
  getCuStatus() {
    return {
      start: this.cuState,
      mode: this.cuMode,
      display: this.cuDisplay,
      fuel: this.cars.map(c => Math.round(c.fuel)),
    };
  }

  /**
   * Emit CU status to clients
   */
  emitCuStatus() {
    const status = this.getCuStatus();
    this.io.emit('cu:status', status);
  }

  /**
   * Start CU status polling (like real CU)
   */
  startStatusPolling(interval = 200) {
    if (this.statusInterval) {
      clearInterval(this.statusInterval);
    }
    this.statusInterval = setInterval(() => {
      this.emitCuStatus();
    }, interval);
    this.io.emit('cu:connected');
  }

  /**
   * Stop CU status polling
   */
  stopStatusPolling() {
    if (this.statusInterval) {
      clearInterval(this.statusInterval);
      this.statusInterval = null;
    }
    this.io.emit('cu:disconnected');
  }

  /**
   * Start race (simulate START button press)
   * Cycles through: LIGHTS 1-5 -> GO -> RACING
   */
  async startRace() {
    if (this.cuState === CU_STATE.RACING) {
      // Already racing, pressing START stops the race (ESC behavior)
      this.cuState = CU_STATE.STOPPED;
      this.raceActive = false;
      this.emitCuStatus();
      return;
    }

    // Start or continue light sequence from current state
    const startLight = (this.cuState >= CU_STATE.LIGHTS_1 && this.cuState <= CU_STATE.LIGHTS_5)
      ? this.cuState
      : CU_STATE.LIGHTS_1;

    for (let light = startLight; light <= 5; light++) {
      this.cuState = light;
      this.emitCuStatus();
      await this.delay(500);
    }
    // GO!
    this.cuState = CU_STATE.GO;
    this.emitCuStatus();
    await this.delay(300);
    // Racing
    this.cuState = CU_STATE.RACING;
    this.raceActive = true;
    this.emitCuStatus();

    // Émettre un event timer pour chaque voiture (comme le CU au franchissement initial)
    // Ceci permet au sync de stocker le timestamp de départ
    for (const car of this.cars) {
      this.emit('timer', {
        controller: car.id - 1, // 0-indexed
        timestamp: this.raceTime, // ~0 au départ
        sector: 1,
      });
    }
  }

  /**
   * Press ESC (Pace Car / Stop)
   */
  pressEsc() {
    if (this.cuState === CU_STATE.RACING) {
      this.cuState = CU_STATE.STOPPED;
      this.raceActive = false;
      this.emitCuStatus();
    }
  }

  /**
   * Press a CU button (1=ESC, 2=START, 5=SPEED, 6=BRAKE, 7=FUEL, 8=CODE)
   */
  async pressButton(buttonId) {
    switch (buttonId) {
      case 1: // ESC
        this.pressEsc();
        break;
      case 2: // START
        await this.startRace();
        break;
      case 7: // FUEL - toggle fuel mode
        this.cuMode ^= MODE_FLAGS.FUEL;
        this.emitCuStatus();
        break;
      case 5: // SPEED - (placeholder)
      case 6: // BRAKE - (placeholder)
      case 8: // CODE - (placeholder)
        // These don't change visible state
        break;
      default:
        break;
    }
  }

  /**
   * Reset timer and lap counts
   */
  resetTimer() {
    this.raceTime = 0;
    this.cars.forEach(car => {
      car.currentLap = 0;
      car.totalLaps = 0;
      car.lastLapTime = 0;
      car.bestLapTime = null;
      car.totalTime = 0;
      car.sectorTimes = [0, 0, 0];
      car.currentSector = 0;
    });
    this.emitCuStatus();
  }

  /**
   * Clear position tower
   */
  clearPosition() {
    // Reset positions to default order
    this.cars.forEach((car, i) => {
      car.position = i + 1;
    });
  }

  /**
   * Toggle a mode flag
   */
  toggleMode(flag) {
    this.cuMode ^= flag;
    this.emitCuStatus();
  }

  /**
   * Set fuel for a controller
   */
  setFuel(controller, value) {
    const car = this.cars.find(c => c.id === controller);
    if (car) {
      car.fuel = Math.max(0, Math.min(15, value));
      this.emitCuStatus();
    }
  }

  /**
   * Helper delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export { CU_STATE, MODE_FLAGS };
