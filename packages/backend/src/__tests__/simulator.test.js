import { jest } from '@jest/globals';
import { CU_STATE, CarreraSimulator, MODE_FLAGS, SIMULATOR_ADDRESS } from '../services/simulator.js';

let io, sim, timers, statuses;

beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(Math, 'random').mockReturnValue(0.5);
  io = { emit: jest.fn() };
  sim = new CarreraSimulator(io);
  timers = [];
  statuses = [];
  sim.on('timer', (event) => timers.push(event));
  sim.on('status', (status) => statuses.push(status.start));
});
afterEach(async () => {
  await sim.disconnect();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

const ioEvents = (name) => io.emit.mock.calls.filter(([event]) => event === name).map(([, data]) => data);

describe('connection', () => {
  test('connecting builds six cars and polls the CU status every 200 ms', async () => {
    const events = [];
    sim.on('connected', () => events.push('connected'));
    expect(await sim.connect()).toEqual({ success: true, message: 'Connected to Simulator' });
    expect(sim.isConnected()).toBe(true);
    expect(sim.cars.map((c) => c.id)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(sim.cars[1]).toMatchObject({
      position: 2,
      fuel: 15,
      performance: 1,
      startDistance: 305,
      firstCrossing: true,
    });

    jest.advanceTimersByTime(600);
    expect(statuses).toEqual([CU_STATE.STOPPED, CU_STATE.STOPPED, CU_STATE.STOPPED]);
    expect(events.length).toBeGreaterThan(0);
    expect(await sim.connect()).toEqual({ success: true, message: 'Already connected' });

    // Polling again replaces the running poll rather than doubling it
    statuses.length = 0;
    sim.startStatusPolling(500);
    jest.advanceTimersByTime(1000);
    expect(statuses).toHaveLength(2);
  });

  test('disconnecting stops the polling, once', async () => {
    const events = [];
    sim.on('disconnected', () => events.push('disconnected'));
    expect(await sim.disconnect()).toEqual({ success: true, message: 'Already disconnected' });
    await sim.connect();
    expect(await sim.disconnect()).toEqual({ success: true, message: 'Disconnected from Simulator' });
    expect(events).toContain('disconnected');
    jest.advanceTimersByTime(1000);
    expect(statuses).toEqual([]);
  });

  test('version, info and status', async () => {
    await sim.connect();
    expect(SIMULATOR_ADDRESS).toBe('SIMULATOR');
    expect(await sim.getInfo()).toEqual({
      version: 'SIMULATOR-1.0',
      fuelMode: false,
      realMode: false,
      pitLane: false,
      lapCounter: true,
      numCars: 6,
    });
    sim.cars[0].fuel = 7.6;
    expect(sim.getCuStatus()).toEqual({
      start: CU_STATE.STOPPED,
      mode: MODE_FLAGS.LAP_COUNTER,
      display: 6,
      fuel: [8, 15, 15, 15, 15, 15],
    });
    expect(sim.getState()).toMatchObject({ running: false, active: false, raceTime: 0, connected: true });
  });
});

describe('start lights', () => {
  test('a first START lights the first light, a second counts down to the race', async () => {
    await sim.connect();
    await sim.startRace();
    expect(sim.cuState).toBe(CU_STATE.LIGHTS_1);

    statuses.length = 0;
    const counting = sim.startRace();
    await jest.advanceTimersByTimeAsync(4300);
    await counting;
    // The polling repeats the current state: only the changes matter
    const changes = statuses.filter((state, i) => state !== statuses[i - 1]);
    expect(changes).toEqual([2, 3, 4, 5, CU_STATE.GO, CU_STATE.RACING]);
    expect(sim).toMatchObject({ cuState: CU_STATE.RACING, raceActive: true });
    expect(timers).toEqual(sim.cars.map((c) => ({ controller: c.id - 1, timestamp: 0, sector: 1 })));
  });

  test('START during the race, or ESC, stops it; ESC does nothing otherwise', async () => {
    await sim.connect();
    sim.pressEsc();
    expect(sim.cuState).toBe(CU_STATE.STOPPED);

    Object.assign(sim, { cuState: CU_STATE.RACING, raceActive: true });
    await sim.startRace();
    expect(sim).toMatchObject({ cuState: CU_STATE.STOPPED, raceActive: false });

    Object.assign(sim, { cuState: CU_STATE.RACING, raceActive: true });
    sim.pressEsc();
    expect(sim).toMatchObject({ cuState: CU_STATE.STOPPED, raceActive: false });

    sim.cuState = 8;
    await sim.startRace();
    expect(sim.cuState).toBe(CU_STATE.LIGHTS_1);
    sim.cuState = CU_STATE.FALSE_START;
    await sim.startRace();
    expect(sim.cuState).toBe(CU_STATE.FALSE_START);
  });

  test('the CU buttons: ESC, START, FUEL toggles the fuel mode, the others change nothing', async () => {
    await sim.connect();
    await sim.pressButton(2);
    expect(sim.cuState).toBe(CU_STATE.LIGHTS_1);
    await sim.pressButton(7);
    expect(sim.cuMode).toBe(MODE_FLAGS.LAP_COUNTER | MODE_FLAGS.FUEL);
    await sim.pressButton(7);
    expect(sim.cuMode).toBe(MODE_FLAGS.LAP_COUNTER);
    for (const button of [5, 6, 8, 42]) await sim.pressButton(button);
    expect(sim).toMatchObject({ cuState: CU_STATE.LIGHTS_1, cuMode: MODE_FLAGS.LAP_COUNTER });
    sim.cuState = CU_STATE.RACING;
    await sim.pressButton(1);
    expect(sim.cuState).toBe(CU_STATE.STOPPED);
  });
});

describe('the race', () => {
  test('start() runs the tick loop and presses START; stop() ends both', async () => {
    await sim.connect();
    await sim.start();
    expect(sim).toMatchObject({ isRunning: true, cuState: CU_STATE.LIGHTS_1 });
    const countdown = sim.start();
    await jest.advanceTimersByTimeAsync(4300);
    await countdown;
    expect(sim.cuState).toBe(CU_STATE.RACING);

    sim.stop();
    expect(sim).toMatchObject({ isRunning: false, raceActive: false, cuState: CU_STATE.STOPPED });
    expect(ioEvents('race:status').at(-1)).toEqual(
      expect.objectContaining({ running: false, active: false, carCount: 6, isMockDevice: true })
    );
    io.emit.mockClear();
    sim.stop();
    expect(io.emit).not.toHaveBeenCalled();
  });

  test('cars cross the line once, then lap sector by sector, reported each second', async () => {
    await sim.connect();
    sim.raceActive = true;
    sim.isRunning = true;
    sim.interval = setInterval(() => sim.tick(), sim.tickRate);

    // First crossing: car 1 starts 225 ms before the line
    jest.advanceTimersByTime(300);
    expect(timers[0]).toEqual({ controller: 0, timestamp: 225, sector: 1 });

    // A sector lasts 3 s (2 s + 0.5 × 2 s, performance 1): a lap ends after three of them
    jest.advanceTimersByTime(9_700);
    const lapOne = timers.filter((t) => t.controller === 0);
    expect(lapOne).toHaveLength(2);
    expect(lapOne[1].timestamp).toBe(225 + sim.cars[0].lastLapTime);
    expect(sim.cars[0]).toMatchObject({ totalLaps: 1, currentLap: 1, bestLapTime: sim.cars[0].lastLapTime });
    expect(ioEvents('race:sector')[0]).toMatchObject({ carId: 1, sector: 1, time: 3000 });

    const carData = ioEvents('race:carData').at(-1);
    expect(carData[0]).toMatchObject({ id: 1, totalLaps: 1, fuel: 15, speed: 10, inPit: false });
    const leaderboard = ioEvents('race:leaderboard').at(-1);
    expect(leaderboard[0]).toMatchObject({ position: 1, carId: 1, laps: 1, gap: null });
    expect(leaderboard.slice(1).every((row) => row.gap >= 0)).toBe(true);
  });

  test('nothing moves while the race is paused', async () => {
    await sim.connect();
    sim.tick();
    expect(sim.raceTime).toBe(0);
    sim.togglePause();
    expect(sim.raceActive).toBe(true);
    expect(ioEvents('race:status').at(-1).active).toBe(true);
    sim.tick();
    expect(sim.raceTime).toBe(100);
  });

  test('the leaderboard ranks laps first, then total time', async () => {
    await sim.connect();
    Object.assign(sim.cars[0], { totalLaps: 2, totalTime: 20_000 });
    Object.assign(sim.cars[1], { totalLaps: 3, totalTime: 30_000 });
    Object.assign(sim.cars[2], { totalLaps: 3, totalTime: 29_000 });
    sim.emitLeaderboard();
    expect(
      ioEvents('race:leaderboard')[0]
        .slice(0, 3)
        .map((r) => [r.carId, r.gap])
    ).toEqual([
      [3, null],
      [2, 1000],
      [1, -9000],
    ]);
    expect(sim.cars.map((c) => c.position).slice(0, 3)).toEqual([3, 2, 1]);
  });

  test('a lap by hand keeps the best lap', async () => {
    await sim.connect();
    const car = sim.cars[0];
    car.sectorTimes = [3000, 3000, 3000];
    sim.completeLap(car);
    car.sectorTimes = [4000, 3000, 3000];
    sim.completeLap(car);
    expect(car).toMatchObject({ totalLaps: 2, lastLapTime: 10_000, bestLapTime: 9000, totalTime: 19_000 });
    expect(timers.at(-1)).toEqual({ controller: 0, timestamp: 19_000, sector: 1 });
  });
});

describe('settings and resets', () => {
  test('speed and fuel are clamped to 0-15 for a known car only', async () => {
    await sim.connect();
    sim.setCarSpeed(1, 20);
    sim.setFuel(2, -3);
    sim.setCarSpeed(9, 5);
    sim.setFuel(9, 5);
    expect([sim.cars[0].speed, sim.cars[1].fuel]).toEqual([15, 0]);
  });

  test('a reset stops the loop and puts every car back on the grid', async () => {
    await sim.connect();
    await sim.start();
    Object.assign(sim.cars[2], { totalLaps: 4, bestLapTime: 9000, position: 1, firstCrossing: false });
    sim.raceTime = 5000;

    sim.reset();
    expect(sim).toMatchObject({ isRunning: false, interval: null, cuState: CU_STATE.STOPPED, raceTime: 0 });
    expect(sim.cars[2]).toMatchObject({ totalLaps: 0, bestLapTime: null, firstCrossing: true, startDistance: 385 });

    sim.clearPosition();
    expect(sim.cars.map((c) => c.position)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});
