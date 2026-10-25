import { jest } from '@jest/globals';
import EventEmitter from 'events';
jest.unstable_mockModule('@abandonware/noble', () => ({ default: {} }));
const { BLEService } = await import('../services/ble.js');

function setup() {
  const adapter = new EventEmitter();
  adapter.state = 'poweredOn';
  adapter.startScanning = jest.fn((_, __, done) => done?.());
  adapter.stopScanning = jest.fn(() => adapter.emit('scanStop'));
  const output = { uuid: '39df8888b1b4b90b57f17144ae4e4a6a' };
  const notify = new EventEmitter();
  notify.uuid = '39df9999b1b4b90b57f17144ae4e4a6a';
  notify.subscribe = jest.fn((done) => done());
  const peripheral = new EventEmitter();
  peripheral.address = 'CU-A';
  peripheral.advertisement = { localName: 'Control_Unit' };
  peripheral.connect = jest.fn((done) => done());
  peripheral.disconnect = jest.fn((done) => {
    peripheral.emit('disconnect');
    done?.();
  });
  peripheral.discoverSomeServicesAndCharacteristics = jest.fn((services, characteristics, done) =>
    done(null, [], [output, notify])
  );
  const ble = new BLEService({ adapter, operationTimeout: 100 });
  ble.lastFoundPeripheral = peripheral;
  ble.on('error', () => {});
  return { adapter, peripheral, notify, ble };
}

describe('BLE recovery boundaries', () => {
  let s;
  beforeEach(() => {
    jest.useFakeTimers();
    s = setup();
  });
  afterEach(async () => {
    await s.ble.disconnect();
    jest.useRealTimers();
  });
  test('connect waits for scan-stop acknowledgement before opening the link', async () => {
    s.ble.lastFoundPeripheral = null;
    s.adapter.stopScanning.mockImplementation(() => {});
    const job = s.ble.connect('CU-A');
    s.adapter.emit('discover', s.peripheral);
    await Promise.resolve();
    await Promise.resolve();
    expect(s.peripheral.connect).not.toHaveBeenCalled();
    s.adapter.emit('scanStop');
    await job;
    expect(s.peripheral.connect).toHaveBeenCalledTimes(1);
    expect(s.peripheral.discoverSomeServicesAndCharacteristics).toHaveBeenCalledWith(
      ['39df7777b1b4b90b57f17144ae4e4a6a'],
      ['39df8888b1b4b90b57f17144ae4e4a6a', '39df9999b1b4b90b57f17144ae4e4a6a'],
      expect.any(Function)
    );
  });
  test('missing scanStop cannot discard a discovered CU', async () => {
    s.ble.lastFoundPeripheral = null;
    s.adapter.stopScanning.mockImplementation(() => {});
    const job = s.ble.connect('CU-A');
    s.adapter.emit('discover', s.peripheral);
    await jest.advanceTimersByTimeAsync(100);
    await job;
    expect(s.ble.connected).toBe(true);
    expect(s.adapter.listenerCount('scanStop')).toBe(0);
  });
  test('missing scanStop preserves the original discovery error', async () => {
    s.adapter.stopScanning.mockImplementation(() => {});
    s.adapter.startScanning.mockImplementation((_, __, done) => done(new Error('watcher failed')));
    const assertion = expect(s.ble.discoverPeripheral()).rejects.toThrow('watcher failed');
    await jest.advanceTimersByTimeAsync(100);
    await assertion;
    expect(s.adapter.listenerCount('scanStop')).toBe(0);
    expect(s.adapter.listenerCount('discover')).toBe(0);
  });
  test('manual disconnect never schedules automatic reconnection', async () => {
    await s.ble.connect('CU-A');
    await s.ble.disconnect();
    expect(s.ble.connected).toBe(false);
    expect(s.ble.peripheral).toBeNull();
    expect(jest.getTimerCount()).toBe(0);
  });
  test('reusing a peripheral after recovery does not duplicate notifications', async () => {
    s.ble.externalRecovery = true;
    await s.ble.connect('CU-A');
    s.peripheral.emit('disconnect');
    await s.ble.connect('CU-A');
    const data = jest.fn();
    s.ble.on('data', data);
    s.notify.emit('data', Buffer.from('hello$'));
    expect(data).toHaveBeenCalledTimes(1);
    expect(s.notify.listenerCount('data')).toBe(1);
  });
  test('a deliberate disconnect event cannot start the legacy loop', () => {
    s.ble.manualDisconnect = true;
    s.ble.handleDisconnect();
    expect(jest.getTimerCount()).toBe(0);
  });
  test('late notifications from an old connection are ignored', async () => {
    await s.ble.connect('CU-A');
    const data = jest.fn();
    s.ble.on('data', data);
    await s.ble.disconnect();
    s.notify.emit('data', Buffer.from('hello$'));
    expect(data).not.toHaveBeenCalled();
  });
  test('a stalled manual disconnect reports disconnected immediately and still times out', async () => {
    await s.ble.connect('CU-A');
    const disconnected = jest.fn();
    s.ble.on('disconnect', disconnected);
    s.peripheral.disconnect.mockImplementation(() => {});
    const assertion = expect(s.ble.disconnect()).rejects.toThrow('timed out');
    expect(disconnected).toHaveBeenCalledTimes(1);
    expect(s.ble.connected).toBe(false);
    await jest.advanceTimersByTimeAsync(100);
    await assertion;
    expect(jest.getTimerCount()).toBe(0);
  });
  test('external recovery suppresses the legacy retry loop', async () => {
    s.ble.externalRecovery = true;
    await s.ble.connect('CU-A');
    s.peripheral.emit('disconnect');
    expect(jest.getTimerCount()).toBe(0);
  });
  test.each(['connect', 'discovery', 'subscribe'])(
    'a stalled %s callback times out and releases state',
    async (phase) => {
      if (phase === 'connect') s.peripheral.connect.mockImplementation(() => {});
      if (phase === 'discovery') s.peripheral.discoverSomeServicesAndCharacteristics.mockImplementation(() => {});
      if (phase === 'subscribe') s.notify.subscribe.mockImplementation(() => {});
      const assertion = expect(s.ble.connect('CU-A')).rejects.toThrow('timed out');
      await jest.advanceTimersByTimeAsync(100);
      await assertion;
      expect(s.ble.connecting).toBe(false);
      expect(s.ble.connected).toBe(false);
      expect(s.ble.peripheral).toBeNull();
      expect(s.ble.lastFoundPeripheral).toBeNull();
      expect(s.peripheral.disconnect).toHaveBeenCalled();
    }
  );
  test('cancelling discovery removes only this attempt’s listener', async () => {
    s.ble.lastFoundPeripheral = null;
    const other = jest.fn();
    s.adapter.on('discover', other);
    const assertion = expect(s.ble.connect('CU-A')).rejects.toThrow('cancelled');
    await s.ble.disconnect();
    await assertion;
    expect(s.adapter.listeners('discover')).toEqual([other]);
    expect(s.ble.peripheral).toBeNull();
  });
  test('a selected address cannot connect to another CU with the same name', async () => {
    s.ble.lastFoundPeripheral = null;
    const job = s.ble.connect('CU-A');
    s.adapter.emit('discover', { address: 'CU-B', advertisement: { localName: 'Control_Unit' } });
    expect(s.ble.peripheral).toBeNull();
    s.adapter.emit('discover', s.peripheral);
    await job;
    expect(s.ble.peripheral).toBe(s.peripheral);
  });
  test('a late callback after cancellation cannot mark the CU ready', async () => {
    let connected;
    s.peripheral.connect.mockImplementation((done) => {
      connected = done;
    });
    const ready = jest.fn();
    s.ble.on('ready', ready);
    const assertion = expect(s.ble.connect('CU-A')).rejects.toThrow('cancelled');
    await s.ble.disconnect();
    connected();
    await assertion;
    expect(ready).not.toHaveBeenCalled();
    expect(s.ble.connected).toBe(false);
  });
});
