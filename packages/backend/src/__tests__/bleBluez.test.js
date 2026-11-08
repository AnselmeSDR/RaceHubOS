import { jest } from '@jest/globals';
import { EventEmitter } from 'node:events';
import { BluezBLEService, notificationPacket } from '../services/bleBluez.js';

function setup() {
  const notify = new EventEmitter();
  notify.startNotifications = jest.fn(async () => {});
  const output = { writeValueWithoutResponse: jest.fn(async () => {}) };
  const service = { getCharacteristic: jest.fn(async (uuid) => (uuid.includes('8888') ? output : notify)) };
  const device = new EventEmitter();
  device.getName = jest.fn(async () => 'Control_Unit');
  device.connect = jest.fn(async () => {});
  device.disconnect = jest.fn(async () => {});
  device.gatt = jest.fn(async () => ({ getPrimaryService: jest.fn(async () => service) }));
  const adapter = {
    isDiscovering: jest.fn(async () => false),
    startDiscovery: jest.fn(async () => {}),
    stopDiscovery: jest.fn(async () => {}),
    devices: jest.fn(async () => ['AA:BB:CC:DD:EE:FF']),
    getDevice: jest.fn(async () => device),
  };
  const bus = new EventEmitter();
  const destroy = jest.fn();
  const createSession = jest.fn(() => ({ bluetooth: { defaultAdapter: async () => adapter, dbus: bus }, destroy }));
  const ble = new BluezBLEService({ createSession, operationTimeout: 100 });
  ble.on('error', () => {});
  return { ble, device, adapter, notify, output, destroy, createSession, bus };
}

describe('Node BlueZ transport', () => {
  let s;
  beforeEach(() => {
    s = setup();
  });
  afterEach(async () => {
    await s.ble.disconnect();
    jest.useRealTimers();
  });
  test('resolves GATT and subscribes before ready; writes without response and preserves framing', async () => {
    const ready = jest.fn();
    s.ble.on('ready', ready);
    expect(ready).not.toHaveBeenCalled();
    await s.ble.connect('aa:bb:cc:dd:ee:ff');
    expect(s.notify.startNotifications).toHaveBeenCalledTimes(1);
    expect(ready).toHaveBeenCalledTimes(1);
    const data = jest.fn();
    s.ble.on('data', data);
    s.notify.emit('valuechanged', Buffer.from(':123456$'));
    expect(data).toHaveBeenCalledWith(Buffer.from('?:123456'));
    expect(notificationPacket(Buffer.from('12345$'))).toEqual(Buffer.from('012345'));
    expect(notificationPacket(Buffer.from('?raw'))).toEqual(Buffer.from('?raw'));
    await s.ble.send(Buffer.from('abc'));
    expect(s.output.writeValueWithoutResponse).toHaveBeenCalledWith(Buffer.from('abc'));
    expect(s.adapter.stopDiscovery).toHaveBeenCalledTimes(1);
  });
  test('an exact address never falls back to another CU', async () => {
    jest.useFakeTimers();
    const failed = expect(s.ble.connect('11:22:33:44:55:66')).rejects.toThrow('not found');
    await jest.advanceTimersByTimeAsync(15100);
    await failed;
    expect(s.device.connect).not.toHaveBeenCalled();
    expect(s.destroy).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });
  test('does not stop discovery owned by another client', async () => {
    s.adapter.isDiscovering.mockResolvedValue(true);
    await s.ble.scan();
    expect(s.adapter.startDiscovery).not.toHaveBeenCalled();
    expect(s.adapter.stopDiscovery).not.toHaveBeenCalled();
    expect(s.destroy).toHaveBeenCalledTimes(1);
  });
  test('failed scan cleanup preserves successful discovery', async () => {
    s.adapter.stopDiscovery.mockRejectedValue(new Error('scan already stopped'));
    await expect(s.ble.scan()).resolves.toMatchObject({ address: 'aa:bb:cc:dd:ee:ff' });
  });
  test.each(['connect', 'gatt'])('bounds stalled %s and releases the private bus', async (phase) => {
    jest.useFakeTimers();
    s.device[phase].mockImplementation(() => new Promise(() => {}));
    const failed = expect(s.ble.connect()).rejects.toThrow('timed out');
    await jest.advanceTimersByTimeAsync(35100);
    await failed;
    expect(s.ble.isConnected()).toBe(false);
    expect(s.ble.session).toBeNull();
    expect(s.destroy).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });
  test('cancelled connection cannot publish ready after a late reply', async () => {
    let complete;
    s.device.connect.mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        })
    );
    const ready = jest.fn();
    s.ble.on('ready', ready);
    const failed = expect(s.ble.connect()).rejects.toThrow('cancelled');
    while (!complete) await Promise.resolve();
    await s.ble.disconnect();
    complete();
    await failed;
    expect(ready).not.toHaveBeenCalled();
    expect(s.destroy).toHaveBeenCalledTimes(1);
    expect(s.device.listenerCount('disconnect')).toBe(0);
  });
  test('disconnect removes listeners and ignores old notifications after reconnect', async () => {
    const data = jest.fn();
    s.ble.on('data', data);
    await s.ble.connect();
    await s.ble.disconnect();
    s.notify.emit('valuechanged', Buffer.from('old$'));
    expect(data).not.toHaveBeenCalled();
    await s.ble.connect();
    expect(s.notify.listenerCount('valuechanged')).toBe(1);
    expect(s.device.listenerCount('disconnect')).toBe(1);
  });
  test('unexpected link loss clears state and notifies recovery once', async () => {
    await s.ble.connect();
    const lost = jest.fn();
    s.ble.on('disconnect', lost);
    s.device.emit('disconnect');
    s.device.emit('disconnect');
    expect(lost).toHaveBeenCalledTimes(1);
    expect(s.ble.connected).toBe(false);
    await expect(s.ble.send(Buffer.from('x'))).rejects.toThrow('Not connected');
  });
  test('D-Bus loss clears connection without an unhandled bus error', async () => {
    await s.ble.connect();
    const lost = jest.fn();
    s.ble.on('disconnect', lost);
    s.bus.emit('error', new Error('system bus lost'));
    expect(lost).toHaveBeenCalledTimes(1);
    expect(s.destroy).toHaveBeenCalledTimes(1);
  });
  test('a failed write releases the connection', async () => {
    await s.ble.connect();
    s.output.writeValueWithoutResponse.mockRejectedValue(new Error('write failed'));
    await expect(s.ble.send(Buffer.from('x'))).rejects.toThrow('write failed');
    expect(s.ble.connected).toBe(false);
    expect(s.destroy).toHaveBeenCalledTimes(1);
  });
  test('stalled manual cleanup is bounded and cannot overlap a new connection', async () => {
    jest.useFakeTimers();
    await s.ble.connect();
    s.device.disconnect.mockImplementation(() => new Promise(() => {}));
    const disconnected = s.ble.disconnect();
    await expect(s.ble.connect()).rejects.toThrow('in progress');
    await jest.advanceTimersByTimeAsync(8000);
    await disconnected;
    expect(s.destroy).toHaveBeenCalledTimes(1);
    expect(s.ble.cleaning).toBe(0);
    expect(jest.getTimerCount()).toBe(0);
  });
  test('a stalled subscription never marks the connection ready', async () => {
    jest.useFakeTimers();
    s.notify.startNotifications.mockImplementation(() => new Promise(() => {}));
    const ready = jest.fn();
    s.ble.on('ready', ready);
    const failed = expect(s.ble.connect()).rejects.toThrow('timed out');
    await jest.advanceTimersByTimeAsync(100);
    await failed;
    expect(ready).not.toHaveBeenCalled();
    expect(s.notify.listenerCount('valuechanged')).toBe(0);
    expect(jest.getTimerCount()).toBe(0);
  });
});
