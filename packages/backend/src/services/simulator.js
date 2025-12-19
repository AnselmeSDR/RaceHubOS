/**
 * Carrera Control Unit Simulator
 * Simulates the AppConnect 30369 Bluetooth device for development
 */

export class CarreraSimulator {
  constructor(io) {
    this.io = io;
    this.isRunning = false;
    this.raceActive = false;
    this.cars = [];
    this.raceTime = 0;
    this.interval = null;
    this.tickRate = 100; // Update every 100ms
    this.onLapComplete = null; // Callback pour enregistrer les tours
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

    console.log(`Simulator initialized with ${carCount} cars`);
  }

  /**
   * Start the simulator
   */
  start() {
    if (this.isRunning) {
      console.log('Simulator already running');
      return;
    }

    this.isRunning = true;
    this.raceActive = true;
    this.raceTime = 0;

    console.log('Simulator started');

    this.interval = setInterval(() => {
      this.tick();
    }, this.tickRate);

    this.emitRaceStatus();
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

    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    console.log('Simulator stopped');
    this.emitRaceStatus();
  }

  /**
   * Pause/resume the race
   */
  togglePause() {
    this.raceActive = !this.raceActive;
    this.emitRaceStatus();
    console.log(`Race ${this.raceActive ? 'resumed' : 'paused'}`);
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
      // Skip if in pit
      if (car.inPit) {
        this.handlePitStop(car);
        return;
      }

      // Simulate speed variation (realistic racing)
      const baseSpeed = 8 + Math.random() * 4; // 8-12 speed units
      car.speed = Math.max(0, Math.min(15, baseSpeed - (15 - car.fuel) * 0.2));

      // Consume fuel
      if (car.fuel > 0) {
        car.fuel = Math.max(0, car.fuel - 0.003 * car.speed);
      }

      // Check if fuel is low and need pit stop
      if (car.fuel < 2 && !car.inPit && Math.random() > 0.95) {
        car.inPit = true;
        console.log(`Car ${car.id} entering pit stop`);
      }

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

    this.io.emit('race:lap', {
      carId: car.id,
      lapNumber: car.totalLaps,
      lapTime: lapTime,
      bestLap: car.bestLapTime,
      timestamp: Date.now(),
    });

    console.log(`Car ${car.id} completed lap ${car.totalLaps} in ${(lapTime / 1000).toFixed(2)}s`);

    // Appeler le callback pour enregistrer le tour en base de données
    if (this.onLapComplete) {
      this.onLapComplete(car);
    }

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

      console.log(`Car ${car.id} left pit stop (fuel: ${car.fuel.toFixed(1)})`);
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
    });
  }

  /**
   * Set car speed manually (for testing)
   */
  setCarSpeed(carId, speed) {
    const car = this.cars.find((c) => c.id === carId);
    if (car) {
      car.speed = Math.max(0, Math.min(15, speed));
      console.log(`Car ${carId} speed set to ${car.speed}`);
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
    };
  }
}
