import { jest } from '@jest/globals';
import { EventEmitter } from 'node:events';
import { PassThrough, Writable } from 'node:stream';
import { BluezBLEService } from '../services/bleBluez.js';

(process.platform === 'linux' && process.env.RACEHUBOS_BLE_TRANSPORT !== 'noble' ? test : test.skip)(
  'default Linux transport does not load Noble or open a raw HCI socket', async () => {
    jest.unstable_mockModule('@abandonware/noble', () => { throw new Error('Noble must not load on Linux'); });
    const { BLEService } = await import('../services/ble.js');
    const ble = new BLEService();
    expect(ble).toBeInstanceOf(BluezBLEService);
    expect(ble.child).toBeNull();
  });

test('a timed-out helper request is rejected and terminates its owning helper', async () => {
  jest.useFakeTimers();
  const child = new EventEmitter();
  child.stdout = new PassThrough(); child.stderr = new PassThrough();
  child.stdin = new Writable({ write(data, encoding, done) { done(); } });
  child.kill = jest.fn(() => child.emit('exit', 1));
  const ble = new BluezBLEService({ spawnBridge: () => child });
  try {
    const assertion = expect(ble.request('connect', {}, 100)).rejects.toThrow('timed out');
    await jest.advanceTimersByTimeAsync(100); await assertion;
    expect(child.kill).toHaveBeenCalledTimes(1);
    expect(ble.pending.size).toBe(0); expect(ble.child).toBeNull();
  } finally { jest.useRealTimers(); }
});
