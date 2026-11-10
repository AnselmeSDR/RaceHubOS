import { jest } from '@jest/globals';
import { EventEmitter } from 'events';
import { SyncService } from '../services/SyncService.js';

/** A device as the CU or the simulator: events out, commands in. */
class Device extends EventEmitter {
  constructor() {
    super();
    this.connected = true;
    this.isConnected = jest.fn(() => this.connected);
    this.poll = jest.fn(async () => {});
    this.start = jest.fn(async () => {});
    this.stopCars = jest.fn(async () => {});
    this.pressEsc = jest.fn(async () => {});
    this.pressButton = jest.fn(async () => {});
    this.reset = jest.fn(async () => {});
    this.clearPosition = jest.fn(async () => {});
    this.getInfo = jest.fn(() => ({ version: '5337' }));
  }
}

let sync, io, device, session;

const sent = (name) => io.emit.mock.calls.filter(([event]) => event === name).map(([, data]) => data);

beforeEach(() => {
  io = { emit: jest.fn() };
  device = new Device();
  session = { isActive: jest.fn(() => true), handleLap: jest.fn(async () => {}), onRaceStart: jest.fn() };
  sync = new SyncService(io);
  sync.setSessionService(session);
  sync.setDevice(device);
});
afterEach(() => {
  sync.close();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('the device', () => {
  test('its connection is told to the clients', () => {
    expect(sync.getDevice()).toBe(device);
    device.emit('connected');
    device.emit('disconnected');
    expect(io.emit.mock.calls.map(([event]) => event)).toEqual(['cu:connected', 'cu:disconnected']);
  });

  test('swapping it leaves the old one unheard and clears what was known of it', () => {
    device.emit('timer', { controller: 0, timestamp: 1000, sector: 1 });
    device.emit('status', { start: 9 });
    const next = new Device();
    sync.setDevice(next);

    expect(sync.getCuStatus()).toBeNull();
    for (const event of ['timer', 'status', 'connected', 'disconnected']) expect(device.listenerCount(event)).toBe(0);
    next.emit('timer', { controller: 0, timestamp: 9000, sector: 1 });
    // A first crossing on the new device: no lap time from the old one's
    expect(sent('cu:timer').at(-1)).toMatchObject({ timestamp: 9000, lapTime: 0 });

    sync.setDevice(null);
    expect(sync.getDevice()).toBeNull();
    expect(sync.isConnected()).toBe(false);
    sync.setupListeners();
  });
});

describe('crossings', () => {
  const crossing = (controller, timestamp, sector = 1) => sync.handleTimerEvent({ controller, timestamp, sector });

  test('a lap time from one finish-line crossing to the next, per controller', async () => {
    await crossing(0, 1000);
    await crossing(1, 1500);
    await crossing(0, 10000);
    await crossing(0, 18500);
    expect(sent('cu:timer').map(({ controller, lapTime }) => [controller, lapTime])).toEqual([
      [0, 0],
      [1, 0],
      [0, 9000],
      [0, 8500],
    ]);
    expect(session.handleLap.mock.calls.map(([lap]) => lap)).toEqual([
      { controller: 0, timestamp: 1000, lapTime: 0, sector: 1 },
      { controller: 1, timestamp: 1500, lapTime: 0, sector: 1 },
      { controller: 0, timestamp: 10000, lapTime: 9000, sector: 1 },
      { controller: 0, timestamp: 18500, lapTime: 8500, sector: 1 },
    ]);
  });

  test('a crossing with a clock gone backwards gets no lap time, the one before stays the reference', async () => {
    await crossing(0, 5000);
    await crossing(0, 3000);
    await crossing(0, 12000);
    expect(sent('cu:timer').map((t) => t.lapTime)).toEqual([0, 0, 7000]);
  });

  test('sectors are shown, not timed nor counted; no session, nothing counted', async () => {
    await crossing(0, 1000, 2);
    expect(sent('cu:timer')).toEqual([{ controller: 0, timestamp: 1000, lapTime: 0, sector: 2, isFinishLine: false }]);
    session.isActive.mockReturnValue(false);
    await crossing(0, 2000);
    await crossing(0, 0);
    expect(session.handleLap).not.toHaveBeenCalled();
  });

  test('events from the device go the same way', async () => {
    device.emit('timer', { controller: 2, timestamp: 4000, sector: 1 });
    await Promise.resolve();
    expect(session.handleLap).toHaveBeenCalledWith({ controller: 2, timestamp: 4000, lapTime: 0, sector: 1 });
  });
});

describe('the start lights', () => {
  test('the first light wipes the CU; GO! after the lights starts the clock; polling is faster meanwhile', () => {
    jest.useFakeTimers();
    sync.startPolling();
    device.emit('status', { start: 9 });
    expect(sync.getState()).toEqual({ connected: true, cuStatus: { start: 9 }, pollInterval: 500 });

    device.emit('status', { start: 1 });
    expect(sent('cu:reset')).toHaveLength(1);
    expect(device.reset).toHaveBeenCalled();
    expect(sync.pollInterval).toBe(100);

    // Still in the lights: no second wipe
    device.emit('status', { start: 3 });
    device.emit('status', { start: 1 });
    expect(device.reset).toHaveBeenCalledTimes(1);
    expect(session.onRaceStart).not.toHaveBeenCalled();

    device.emit('status', { start: 0 });
    expect(session.onRaceStart).toHaveBeenCalledTimes(1);
    expect(sync.pollInterval).toBe(500);
    // Racing already: no new start
    device.emit('status', { start: 0 });
    expect(session.onRaceStart).toHaveBeenCalledTimes(1);
    expect(sent('cu:status')).toHaveLength(6);
  });

  test('racing without lights before is not a start', () => {
    device.emit('status', { start: 0 });
    expect(session.onRaceStart).not.toHaveBeenCalled();
  });
});

describe('polling', () => {
  beforeEach(() => jest.useFakeTimers());

  test('asks the device its status every interval while connected', async () => {
    sync.startPolling();
    sync.startPolling();
    expect(device.poll).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(500);
    expect(device.poll).toHaveBeenCalledTimes(2);

    device.connected = false;
    await jest.advanceTimersByTimeAsync(500);
    expect(device.poll).toHaveBeenCalledTimes(2);

    sync.stopPolling();
    device.connected = true;
    await jest.advanceTimersByTimeAsync(2000);
    expect(device.poll).toHaveBeenCalledTimes(2);
  });

  test('a failed poll is reported and polling goes on', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    device.poll.mockRejectedValueOnce(new Error('timeout'));
    sync.startPolling();
    await jest.advanceTimersByTimeAsync(500);
    expect(console.warn).toHaveBeenCalledWith('[SyncService] Poll error:', 'timeout');
    expect(device.poll).toHaveBeenCalledTimes(2);
  });

  test('a new interval applies at once; none without a device', async () => {
    sync.setPollInterval(500);
    sync.setPollInterval(100);
    expect(device.poll).not.toHaveBeenCalled();
    sync.startPolling();
    sync.setPollInterval(1000);
    await jest.advanceTimersByTimeAsync(999);
    expect(device.poll).toHaveBeenCalledTimes(2);

    sync.stopPolling();
    sync.setDevice(null);
    sync.startPolling();
    expect(sync.pollTimer).toBeNull();
  });
});

describe('commands', () => {
  test('preparing a race pauses polling around START, so its answer is not mixed with a status', async () => {
    jest.useFakeTimers();
    sync.startPolling();
    const prepared = sync.prepareRace();
    expect(sync.pollTimer).toBeNull();
    await jest.advanceTimersByTimeAsync(1000);
    expect(device.start).toHaveBeenCalled();
    expect(sync.pollTimer).toBeNull();
    await jest.advanceTimersByTimeAsync(1000);
    await prepared;
    expect(sync.pollTimer).not.toBeNull();
  });

  test('START, ESC, the buttons and a reset go to the device', async () => {
    await sync.startRace();
    await sync.stopRace();
    await sync.pressButton(3);
    await sync.reset();
    expect(device.start).toHaveBeenCalled();
    expect(device.stopCars).toHaveBeenCalled();
    expect(device.pressEsc).toHaveBeenCalled();
    expect(device.pressButton).toHaveBeenCalledWith(3);
    expect(device.clearPosition).toHaveBeenCalled();
  });

  test('a device without ESC is stopped; one without a command is left alone', async () => {
    const plain = new EventEmitter();
    plain.stop = jest.fn(async () => {});
    sync.setDevice(plain);
    await sync.stopRace();
    expect(plain.stop).toHaveBeenCalled();
    await sync.prepareRace();
    await sync.startRace();
    await sync.pressButton(1);
    await sync.reset();
    expect(sync.isConnected()).toBe(false);

    sync.setDevice(new EventEmitter());
    await sync.stopRace();
    sync.setDevice(null);
    await Promise.all([sync.prepareRace(), sync.startRace(), sync.stopRace(), sync.pressButton(1), sync.reset()]);
  });

  test("the device's info, or a placeholder when none", () => {
    expect(sync.getInfo()).toEqual({ version: '5337' });
    sync.setDevice(null);
    expect(sync.getInfo()).toEqual({
      version: 'NOT CONNECTED',
      fuelMode: false,
      realMode: false,
      pitLane: false,
      lapCounter: false,
      numCars: 0,
    });
  });
});
