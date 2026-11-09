import { jest } from '@jest/globals';
import { prisma } from './setup.js';
import { apiFor } from './helpers/entityFixtures.js';

// The router shares the test client
jest.unstable_mockModule('../lib/prisma.js', () => ({ createPrismaClient: () => prisma }));
const {
  default: bluetoothRouter,
  setControlUnit,
  setSimulator,
  setSyncService,
} = await import('../routes/bluetooth.js');

const api = apiFor('/api/bluetooth', bluetoothRouter);

/** A device double: connected or not, with the CU commands as mocks. */
function device(extra = {}) {
  const self = {
    connected: false,
    isConnected: jest.fn(() => self.connected),
    connect: jest.fn(async () => {
      self.connected = true;
    }),
    disconnect: jest.fn(async () => {
      self.connected = false;
    }),
    version: jest.fn(async () => '5337'),
    clearPosition: jest.fn(),
    setSpeed: jest.fn(),
    setBrake: jest.fn(),
    setFuel: jest.fn(),
    ...extra,
  };
  return self;
}

let simulator, controlUnit, sync;

beforeEach(async () => {
  await prisma.device.deleteMany();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  simulator = device({
    cuState: 9,
    raceActive: false,
    emitCuStatus: jest.fn(),
    cars: [{ id: 0 }],
    completeLap: jest.fn(),
    reset: jest.fn(),
    getState: jest.fn(() => ({ cars: 6 })),
  });
  controlUnit = device({
    ble: { peripheral: { address: 'AA:BB' }, getPeripheralInfo: () => ({ rssi: -50 }) },
    scan: jest.fn(async () => 'AA:BB'),
  });
  sync = {
    device: null,
    getDevice: () => sync.device,
    setDevice: jest.fn((d) => {
      sync.device = d;
    }),
    isConnected: () => Boolean(sync.device?.isConnected()),
    getCuStatus: () => ({ state: 9 }),
    startPolling: jest.fn(),
    startRace: jest.fn(),
    stopRace: jest.fn(),
    reset: jest.fn(),
    pressButton: jest.fn(),
  };
  setSimulator(simulator);
  setControlUnit(controlUnit);
  setSyncService(sync);
});
afterEach(() => jest.restoreAllMocks());

describe('status and devices', () => {
  test('the status names the current device', async () => {
    expect((await api.get('/api/bluetooth/status')).body).toEqual({
      available: true,
      connected: false,
      deviceType: null,
      deviceAddress: null,
      lastStatus: { state: 9 },
    });
    sync.device = simulator;
    simulator.connected = true;
    expect((await api.get('/api/bluetooth/status')).body).toMatchObject({
      connected: true,
      deviceType: 'simulator',
      deviceAddress: 'SIMULATOR',
    });
    sync.device = { ...controlUnit, address: 'AA:BB' };
    expect((await api.get('/api/bluetooth/status')).body).toMatchObject({
      deviceType: 'controlUnit',
      deviceAddress: 'AA:BB',
    });
  });

  test('without a sync service, nothing is connected', async () => {
    setSyncService(null);
    expect((await api.get('/api/bluetooth/status')).body).toEqual({
      available: true,
      connected: false,
      deviceType: null,
      deviceAddress: null,
    });
  });

  test('the simulator is always listed, the control unit when there is one', async () => {
    simulator.connected = true;
    expect((await api.get('/api/bluetooth/devices')).body.devices).toEqual([
      { address: 'SIMULATOR', name: 'Simulateur (Virtual)', type: 'simulator', connected: true },
      { address: 'AA:BB', name: 'Control Unit', type: 'controlUnit', connected: false },
    ]);
    controlUnit.ble = null;
    expect((await api.get('/api/bluetooth/devices')).body.devices[1].address).toBe('CONTROL_UNIT');
    setControlUnit(null);
    setSimulator(null);
    expect((await api.get('/api/bluetooth/devices')).body).toEqual({
      success: true,
      devices: [{ address: 'SIMULATOR', name: 'Simulateur (Virtual)', type: 'simulator', connected: false }],
    });
  });

  test('a scan lists the simulator and the control unit found, if any', async () => {
    let res = await api.post('/api/bluetooth/scan').send({ timeout: 500 });
    expect(controlUnit.scan).toHaveBeenCalledWith(500);
    expect(res.body.devices).toEqual([
      { address: 'SIMULATOR', name: 'Simulateur (Virtual)', type: 'simulator' },
      { address: 'AA:BB', name: 'Control Unit', type: 'controlUnit' },
    ]);
    await api.post('/api/bluetooth/scan').send({});
    expect(controlUnit.scan).toHaveBeenLastCalledWith(10000);

    controlUnit.scan.mockRejectedValueOnce(new Error('No CU'));
    res = await api.post('/api/bluetooth/scan').send({});
    expect(res.body.devices).toHaveLength(1);
    setControlUnit(null);
    expect((await api.post('/api/bluetooth/scan').send({})).body.devices).toHaveLength(1);
  });
});

describe('POST /api/bluetooth/connect', () => {
  test('the simulator: connected, handed to the sync service and remembered', async () => {
    const res = await api.post('/api/bluetooth/connect').send({ address: 'SIMULATOR' });
    expect(res.body).toMatchObject({
      success: true,
      message: 'Connected to simulator',
      deviceType: 'simulator',
      address: 'SIMULATOR',
      device: { address: 'SIMULATOR', name: 'Simulateur', type: 'simulator' },
    });
    expect(sync.setDevice).toHaveBeenCalledWith(simulator);
    expect(sync.startPolling).not.toHaveBeenCalled();
  });

  test('the control unit: connected at its address, polled, remembered once', async () => {
    await api.post('/api/bluetooth/connect').send({ address: 'AA:BB' });
    const res = await api.post('/api/bluetooth/connect').send({ address: 'AA:BB' });
    expect(controlUnit.connect).toHaveBeenCalledWith('AA:BB');
    expect(sync.startPolling).toHaveBeenCalled();
    expect(res.body).toMatchObject({ deviceType: 'controlUnit', device: { name: 'Control Unit', type: 'cu' } });
    expect(await prisma.device.count()).toBe(1);
  });

  test('refused without an address or a device; already connecting is fine; a failure answers 500', async () => {
    expect((await api.post('/api/bluetooth/connect').send({})).body.error).toBe('Address is required');

    controlUnit.connect.mockRejectedValueOnce(new Error('Already connected'));
    expect((await api.post('/api/bluetooth/connect').send({ address: 'AA:BB' })).body).toEqual({
      success: true,
      message: 'Already connected',
    });
    controlUnit.connect.mockRejectedValueOnce(new Error('Connection already in progress'));
    expect((await api.post('/api/bluetooth/connect').send({ address: 'AA:BB' })).body.success).toBe(true);
    controlUnit.connect.mockRejectedValueOnce(new Error('Out of range'));
    const res = await api.post('/api/bluetooth/connect').send({ address: 'AA:BB' });
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Out of range');

    setSimulator(null);
    setControlUnit(null);
    let refused = await api.post('/api/bluetooth/connect').send({ address: 'SIMULATOR' });
    expect(refused.status).toBe(400);
    expect(refused.body.error).toBe('Simulator not available');
    refused = await api.post('/api/bluetooth/connect').send({ address: 'AA:BB' });
    expect(refused.body.error).toBe('Control Unit not available');
  });
});

describe('disconnect, version, info', () => {
  test('disconnecting drops the current device, if any', async () => {
    expect((await api.post('/api/bluetooth/disconnect')).body).toEqual({ success: true, message: 'Disconnected' });
    sync.device = simulator;
    await api.post('/api/bluetooth/disconnect');
    expect(simulator.disconnect).toHaveBeenCalled();
    expect(sync.setDevice).toHaveBeenCalledWith(null);

    sync.device = simulator;
    simulator.disconnect.mockRejectedValueOnce(new Error('stuck'));
    const res = await api.post('/api/bluetooth/disconnect');
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('stuck');
  });

  test('the version needs a connected device', async () => {
    expect((await api.get('/api/bluetooth/version')).status).toBe(400);
    sync.device = simulator;
    expect((await api.get('/api/bluetooth/version')).body.error).toBe('No device connected');
    simulator.connected = true;
    expect((await api.get('/api/bluetooth/version')).body).toEqual({ success: true, version: '5337' });
    simulator.version.mockRejectedValueOnce(new Error('timeout'));
    expect((await api.get('/api/bluetooth/version')).status).toBe(500);
  });

  test('the info gives version, BLE details and connection', async () => {
    expect((await api.get('/api/bluetooth/info')).body.error).toBe('No device connected');
    sync.device = controlUnit;
    expect((await api.get('/api/bluetooth/info')).body.data).toEqual({
      version: null,
      ble: { rssi: -50 },
      connected: false,
    });
    controlUnit.connected = true;
    expect((await api.get('/api/bluetooth/info')).body.data).toMatchObject({ version: '5337', connected: true });
    controlUnit.version.mockRejectedValueOnce(new Error('timeout'));
    expect((await api.get('/api/bluetooth/info')).body.data.version).toBeNull();

    sync.device = simulator;
    expect((await api.get('/api/bluetooth/info')).body.data.ble).toBeNull();
    sync.device = { ble: { getPeripheralInfo: () => ({}) } };
    expect((await api.get('/api/bluetooth/info')).body.data).toEqual({ version: null, ble: {}, connected: false });
    sync.device = {
      ble: {
        getPeripheralInfo: () => {
          throw new Error('gone');
        },
      },
    };
    expect((await api.get('/api/bluetooth/info')).status).toBe(500);
  });
});

describe('race controls', () => {
  test.each([
    ['start-race', 'startRace', 'Race started'],
    ['esc', 'stopRace', 'ESC pressed'],
    ['reset-timer', 'reset', 'Timer reset'],
  ])('%s', async (path, method, message) => {
    expect((await api.post(`/api/bluetooth/${path}`)).body).toEqual({ success: true, message });
    expect(sync[method]).toHaveBeenCalled();
    sync[method].mockRejectedValueOnce(new Error('busy'));
    const res = await api.post(`/api/bluetooth/${path}`);
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('busy');
    setSyncService(null);
    expect((await api.post(`/api/bluetooth/${path}`)).body.success).toBe(true);
  });

  test('clearing the position when the device can', async () => {
    expect((await api.post('/api/bluetooth/clear-position')).body.message).toBe('Position cleared');
    sync.device = simulator;
    await api.post('/api/bluetooth/clear-position');
    expect(simulator.clearPosition).toHaveBeenCalled();
    simulator.clearPosition.mockRejectedValueOnce(new Error('busy'));
    expect((await api.post('/api/bluetooth/clear-position')).status).toBe(500);
  });

  test('pressing a button 1 to 8', async () => {
    expect((await api.post('/api/bluetooth/button/3')).body).toEqual({ success: true, message: 'Button 3 pressed' });
    expect(sync.pressButton).toHaveBeenCalledWith(3);
    for (const id of ['0', '9', 'x']) {
      const res = await api.post(`/api/bluetooth/button/${id}`);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid button ID (1-8)');
    }
    sync.pressButton.mockRejectedValueOnce(new Error('busy'));
    expect((await api.post('/api/bluetooth/button/1')).status).toBe(500);
  });

  test.each([
    ['set-speed', 'setSpeed', 'Speed'],
    ['set-brake', 'setBrake', 'Brake'],
    ['set-fuel', 'setFuel', 'Fuel'],
  ])('%s for one controller, when the device supports it', async (path, method, label) => {
    let res = await api.post(`/api/bluetooth/${path}`).send({ address: 2, value: 7 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(`Device does not support ${method}`);

    sync.device = simulator;
    res = await api.post(`/api/bluetooth/${path}`).send({ address: 2, value: 7 });
    expect(res.body).toEqual({ success: true, message: `${label} set for controller 2` });
    expect(simulator[method]).toHaveBeenCalledWith(2, 7);
    simulator[method].mockRejectedValueOnce(new Error('busy'));
    expect((await api.post(`/api/bluetooth/${path}`).send({ address: 2, value: 7 })).status).toBe(500);
  });
});

describe('simulator', () => {
  test('its state, set by hand once connected', async () => {
    let res = await api.post('/api/bluetooth/simulator/state').send({ state: 0 });
    expect(res.body.error).toBe('Simulator not connected');
    simulator.connected = true;
    for (const state of [-1, 10, '1']) {
      expect((await api.post('/api/bluetooth/simulator/state').send({ state })).body.error).toBe('Invalid state (0-9)');
    }
    res = await api.post('/api/bluetooth/simulator/state').send({ state: 0 });
    expect(res.body).toEqual({ success: true, state: 0 });
    expect(simulator).toMatchObject({ cuState: 0, raceActive: true });
    await api.post('/api/bluetooth/simulator/state').send({ state: 3 });
    expect(simulator.raceActive).toBe(false);
    expect(simulator.emitCuStatus).toHaveBeenCalledTimes(2);
    simulator.emitCuStatus.mockImplementationOnce(() => {
      throw new Error('broken');
    });
    expect((await api.post('/api/bluetooth/simulator/state').send({ state: 1 })).status).toBe(500);
  });

  test('a lap triggered by hand', async () => {
    let res = await api.post('/api/bluetooth/simulator/lap').send({ controller: 0 });
    expect(res.body.error).toBe('Simulator not connected');
    simulator.connected = true;
    for (const controller of [-1, 6, '0']) {
      const refused = await api.post('/api/bluetooth/simulator/lap').send({ controller });
      expect(refused.body.error).toBe('Invalid controller (0-5)');
    }
    res = await api.post('/api/bluetooth/simulator/lap').send({ controller: 0 });
    expect(res.body.message).toBe('Lap triggered for controller 0');
    expect(simulator.completeLap).toHaveBeenCalledWith({ id: 0 });
    res = await api.post('/api/bluetooth/simulator/lap').send({ controller: 1 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Car not found');
    simulator.completeLap.mockImplementationOnce(() => {
      throw new Error('broken');
    });
    expect((await api.post('/api/bluetooth/simulator/lap').send({ controller: 0 })).status).toBe(500);
  });

  test('reset and full state, refused without a simulator', async () => {
    expect((await api.post('/api/bluetooth/simulator/reset')).body).toEqual({
      success: true,
      message: 'Simulator reset',
    });
    expect((await api.get('/api/bluetooth/simulator/state')).body).toEqual({ success: true, data: { cars: 6 } });
    simulator.reset.mockImplementationOnce(() => {
      throw new Error('broken');
    });
    expect((await api.post('/api/bluetooth/simulator/reset')).status).toBe(500);

    setSimulator(null);
    expect((await api.post('/api/bluetooth/simulator/reset')).body.error).toBe('Simulator not available');
    expect((await api.get('/api/bluetooth/simulator/state')).body.error).toBe('Simulator not available');
    expect((await api.post('/api/bluetooth/simulator/lap').send({ controller: 0 })).status).toBe(400);
  });
});
