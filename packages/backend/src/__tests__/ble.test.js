import { jest } from '@jest/globals';
import { EventEmitter } from 'events';

const OUTPUT = '39df8888b1b4b90b57f17144ae4e4a6a';
const NOTIFY = '39df9999-b1b4-b90b-57f1-7144ae4e4a6a'; // matched without dashes

/** The Bluetooth adapter: discovery is driven by the test through `found()`. */
const noble = new EventEmitter();
Object.assign(noble, {
  state: 'poweredOn',
  scanError: null,
  startScanning: jest.fn((uuids, duplicates, callback) => callback?.(noble.scanError)),
  stopScanning: jest.fn(),
  found: (peripheral) => noble.emit('discover', peripheral),
});
jest.unstable_mockModule('@abandonware/noble', () => ({ default: noble }));
const { BLEService } = await import('../services/ble.js');

class Characteristic extends EventEmitter {
  constructor(uuid) {
    super();
    this.uuid = uuid;
    this.written = [];
    this.writeError = null;
  }
  subscribe(callback) {
    callback(this.subscribeError);
  }
  write(data, withoutResponse, callback) {
    this.written.push([data.toString('ascii'), withoutResponse]);
    callback(this.writeError);
  }
}

class Peripheral extends EventEmitter {
  constructor(name, address, { characteristics = [OUTPUT, NOTIFY] } = {}) {
    super();
    this.address = address;
    this.advertisement = { localName: name, serviceUuids: ['abc'], manufacturerData: Buffer.from([1, 2]) };
    this.rssi = -60;
    this.characteristics = characteristics.map((uuid) => new Characteristic(uuid));
    this.connectError = null;
  }
  connect(callback) {
    callback(this.connectError);
  }
  discoverAllServicesAndCharacteristics(callback) {
    callback(null, [{ uuid: 'service' }], this.characteristics);
  }
  disconnect(callback) {
    callback();
    this.emit('disconnect');
  }
  characteristic(uuid) {
    return this.characteristics.find((c) => c.uuid === uuid);
  }
}

let ble, events;

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  noble.removeAllListeners();
  noble.state = 'poweredOn';
  noble.scanError = null;
  noble.startScanning.mockClear();
  noble.stopScanning.mockClear();
  ble = new BLEService();
  events = [];
  for (const event of ['discovered', 'connecting', 'connected', 'ready', 'disconnect', 'reconnect-failed', 'error']) {
    ble.on(event, (arg) => events.push(arg instanceof Error ? [event, arg.message] : arg ? [event, arg] : [event]));
  }
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

/** Lets a pending scan register its listener, then shows it the peripherals. */
const discover = async (...peripherals) => {
  await Promise.resolve();
  peripherals.forEach(noble.found);
};

describe('scanning', () => {
  test('stops at the Control Unit, past the other devices', async () => {
    const cu = new Peripheral('Control_Unit', 'AA');
    const scan = ble.scan();
    await discover(new Peripheral(undefined, 'PHONE'), cu);
    expect(await scan).toBe(cu);
    expect(noble.startScanning).toHaveBeenCalledWith([], false, expect.any(Function));
    expect(noble.stopScanning).toHaveBeenCalled();
    expect(noble.listenerCount('discover')).toBe(0);
    expect(events).toEqual([['discovered', 'AA']]);
  });

  test('waits for the adapter to power on', async () => {
    noble.state = 'unknown';
    const scan = ble.scan();
    expect(noble.startScanning).not.toHaveBeenCalled();
    noble.emit('stateChange', 'poweredOn');
    await discover(new Peripheral('Control_Unit', 'AA'));
    await expect(scan).resolves.toBeDefined();
  });

  test('fails when the adapter is not usable', async () => {
    noble.state = 'unknown';
    const scan = ble.scan();
    noble.emit('stateChange', 'unauthorized');
    await expect(scan).rejects.toThrow('Bluetooth adapter not ready: unauthorized');
  });

  test('gives up after the timeout, or when scanning fails', async () => {
    jest.useFakeTimers();
    const scan = ble.scan(1000);
    jest.advanceTimersByTime(1000);
    await expect(scan).rejects.toThrow('Timeout: Control Unit not found');
    expect(noble.stopScanning).toHaveBeenCalled();

    noble.scanError = new Error('busy');
    await expect(ble.scan(1000)).rejects.toThrow('busy');
  });
});

describe('connecting', () => {
  test('scans, subscribes to the notifications, then is ready', async () => {
    const cu = new Peripheral('Control_Unit', 'AA');
    const connect = ble.connect();
    await discover(cu);
    await connect;
    expect(events.map(([e]) => e)).toEqual(['connecting', 'discovered', 'connected', 'ready']);
    expect(ble.isConnected()).toBe(true);
    expect(ble.peripheral).toBe(cu);
    expect(ble.getPeripheralInfo()).toEqual({
      name: 'Control_Unit',
      address: 'AA',
      uuid: null,
      rssi: -60,
      serviceUuids: ['abc'],
      manufacturerData: '0102',
      services: ['service'],
    });
  });

  test('reuses the peripheral found by a scan', async () => {
    const scan = ble.scan();
    await discover(new Peripheral('Control_Unit', 'AA'));
    await scan;
    noble.startScanning.mockClear();
    await ble.connect('AA');
    expect(noble.startScanning).not.toHaveBeenCalled();
  });

  test('looks for a given address, or any Control Unit', async () => {
    let connect = ble.connect('BB');
    await discover(new Peripheral('Phone', 'AA'), new Peripheral('Lamp', 'BB'));
    await connect;
    expect(ble.peripheral.address).toBe('BB');

    const other = new BLEService();
    connect = other.connect('ZZ');
    await discover(new Peripheral('Control_Unit', 'CC'));
    await connect;
    expect(other.peripheral.address).toBe('CC');
  });

  test('gives up when the address never shows', async () => {
    jest.useFakeTimers();
    const connect = ble.connect('ZZ');
    jest.advanceTimersByTime(10000);
    await expect(connect).rejects.toThrow('Timeout waiting for peripheral');
    expect(events).toContainEqual(['error', 'Timeout waiting for peripheral']);
    expect(ble.connecting).toBe(false);
  });

  test('one connection at a time', async () => {
    const pending = ble.connect();
    await expect(ble.connect()).rejects.toThrow('Connection already in progress');
    await discover(new Peripheral('Control_Unit', 'AA'));
    await pending;
    await expect(ble.connect()).rejects.toThrow('Already connected');
  });

  test.each([
    ['the link fails', (p) => (p.connectError = new Error('link lost')), 'link lost'],
    ['a characteristic is missing', (p) => p.characteristics.pop(), 'Required characteristics not found'],
    ['the subscription fails', (p) => (p.characteristics[1].subscribeError = new Error('denied')), 'denied'],
  ])('fails when %s', async (_, breakIt, message) => {
    const cu = new Peripheral('Control_Unit', 'AA');
    breakIt(cu);
    const connect = ble.connect();
    await discover(cu);
    await expect(connect).rejects.toThrow(message);
    expect(events).toContainEqual(['error', message]);
    expect([ble.connected, ble.connecting]).toEqual([false, false]);
  });
});

describe('once connected', () => {
  let cu;

  beforeEach(async () => {
    cu = new Peripheral('Control_Unit', 'AA');
    const connect = ble.connect();
    await discover(cu);
    await connect;
    events.length = 0;
  });

  test('notifications get back the letter the BLE frame drops', () => {
    const data = [];
    ble.on('data', (d) => data.push(d.toString('ascii')));
    const notify = cu.characteristic(NOTIFY);
    notify.emit('data', Buffer.from('53371$'));
    notify.emit('data', Buffer.from('2214365871$'));
    notify.emit('data', Buffer.from('T'));
    expect(data).toEqual(['053371', '?2214365871', 'T']);
  });

  test('a listener failing on a notification is reported, not thrown', () => {
    ble.on('data', () => {
      throw new Error('listener broke');
    });
    cu.characteristic(NOTIFY).emit('data', Buffer.from('T'));
    expect(events).toEqual([['error', 'listener broke']]);
  });

  test('sends without response, and reports a failed write', async () => {
    const output = cu.characteristic(OUTPUT);
    await ble.send(Buffer.from('?'));
    expect(output.written).toEqual([['?', true]]);
    output.writeError = new Error('gatt');
    await expect(ble.send(Buffer.from('?'))).rejects.toThrow('gatt');
    expect(events).toEqual([['error', 'gatt']]);
  });

  test('a lost link reconnects, up to ten times', async () => {
    jest.useFakeTimers();
    cu.connectError = new Error('out of range');
    cu.emit('disconnect');
    expect(ble.isConnected()).toBe(false);
    expect(ble.peripheral).toBeNull();
    await expect(ble.send(Buffer.from('?'))).rejects.toThrow('Not connected');

    for (let attempt = 1; attempt <= 10; attempt++) {
      expect(ble.reconnectAttempts).toBe(attempt);
      await jest.advanceTimersByTimeAsync(3000);
    }
    expect(events.filter(([e]) => e === 'disconnect')).toHaveLength(11);
    expect(events.at(-1)).toEqual(['reconnect-failed']);
    expect(ble.reconnectAttempts).toBe(0);
  });

  test('a reconnection succeeds once the unit is back', async () => {
    jest.useFakeTimers();
    cu.emit('disconnect');
    await jest.advanceTimersByTimeAsync(3000);
    expect(ble.isConnected()).toBe(true);
    expect(ble.reconnectAttempts).toBe(0);
  });

  test('a requested disconnection still schedules a reconnection (as before), a second one cancels it', async () => {
    jest.useFakeTimers();
    await ble.disconnect();
    expect(ble.isConnected()).toBe(false);
    expect(ble.reconnectTimer).not.toBeNull();
    await ble.disconnect();
    expect(ble.reconnectTimer).toBeNull();
    await jest.advanceTimersByTimeAsync(3000);
    expect(events.map(([e]) => e)).toEqual(['disconnect']);
  });
});

test('no peripheral, no info', () => {
  expect(ble.getPeripheralInfo()).toBeNull();
});
