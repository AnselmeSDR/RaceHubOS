import { jest } from '@jest/globals';
import EventEmitter from 'events';
import { CuRecovery } from '../services/CuRecovery.js';
import { SyncService } from '../services/SyncService.js';

function setup() {
  let now = 0;
  const cu = new EventEmitter();
  cu.ble = { connecting: false };
  cu.connected = false;
  cu.isConnected = () => cu.connected;
  cu.connect = jest.fn(async () => { cu.connected = true; cu.emit('connected'); });
  cu.disconnect = jest.fn(async () => { cu.connected = false; cu.emit('disconnected'); });
  const sync = {
    source: null, getDevice() { return this.source; },
    setDevice: jest.fn(function (device) { this.source = device; }),
    stopPolling: jest.fn(), startPolling: jest.fn(),
  };
  const recovery = new CuRecovery(cu, sync, { emit: jest.fn() }, { now: () => now });
  return { cu, sync, recovery, advance(ms) { now += ms; } };
}

describe('CU recovery', () => {
  let s;
  beforeEach(() => { jest.useFakeTimers(); s = setup(); });
  afterEach(() => { s.recovery.close(); jest.useRealTimers(); });

  test('a failed first connection retries the requested address and resumes polling', async () => {
    s.cu.connect.mockRejectedValueOnce(new Error('not found'));
    await expect(s.recovery.connect('CU-A')).rejects.toThrow('not found');
    expect(s.recovery.snapshot()).toMatchObject({ code: 'retry_wait', nextRetryAt: 5000 });
    s.advance(4999); await s.recovery.check();
    expect(s.cu.connect).toHaveBeenCalledTimes(1);
    s.advance(1); await s.recovery.check();
    expect(s.cu.connect).toHaveBeenLastCalledWith('CU-A');
    expect(s.sync.startPolling).toHaveBeenCalledTimes(1);
    expect(s.recovery.snapshot().code).toBe('awaiting_data');
    s.cu.emit('status', { start: 0 });
    expect(s.recovery.snapshot()).toMatchObject({ code: 'live', attempt: 0, nextRetryAt: null });
  });

  test('only one attempt runs, and a different requested CU is not silently accepted', async () => {
    let resolve;
    s.cu.connect.mockImplementation(() => new Promise(r => { resolve = r; }));
    const job = s.recovery.connect('CU-A');
    expect(s.recovery.connect('CU-A')).toBe(job);
    await expect(s.recovery.connect('CU-B')).rejects.toThrow('in progress');
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    resolve(); await job;
    expect(s.cu.connect).toHaveBeenCalledTimes(1);
  });

  test('manual stop cancels a late successful connection and cannot resume polling', async () => {
    let resolve;
    s.cu.connect.mockImplementation(() => new Promise(r => { resolve = r; }));
    const job = s.recovery.connect('CU-A');
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    s.recovery.stop(); resolve();
    await expect(job).rejects.toThrow('cancelled');
    s.advance(100000); await s.recovery.check();
    expect(s.sync.startPolling).not.toHaveBeenCalled();
    expect(s.cu.connect).toHaveBeenCalledTimes(1);
    expect(s.recovery.snapshot().code).toBe('manual');
  });

  test('disconnect retries, but a simulator or explicit stop prevents retries', async () => {
    await s.recovery.connect('CU-A');
    s.cu.connected = false; s.cu.emit('disconnected');
    s.advance(5000); await s.recovery.check();
    expect(s.cu.connect).toHaveBeenCalledTimes(2);
    s.cu.connected = false; s.cu.emit('disconnected');
    s.sync.source = { isSimulator: true };
    s.advance(60000); await s.recovery.check();
    expect(s.cu.connect).toHaveBeenCalledTimes(2);
    s.recovery.stop(); s.sync.source = null;
    await s.recovery.check();
    expect(s.cu.connect).toHaveBeenCalledTimes(2);
  });

  test('stale status triggers recovery, fresh status cancels the scheduled retry', async () => {
    await s.recovery.connect('CU-A');
    s.advance(12000); await s.recovery.check();
    expect(s.recovery.snapshot()).toMatchObject({ code: 'retry_wait', nextRetryAt: 17000 });
    s.cu.emit('status', {});
    s.advance(5000); await s.recovery.check();
    expect(s.cu.connect).toHaveBeenCalledTimes(1);
    s.advance(12000); await s.recovery.check();
    s.advance(5000); await s.recovery.check();
    expect(s.cu.connect).toHaveBeenCalledTimes(2);
  });

  test('repeated failures back off to 15s and 60s without resetting the attempt counter', async () => {
    s.cu.connect.mockRejectedValue(new Error('offline'));
    for (const [attempt, delay] of [[1, 5000], [2, 15000], [3, 15000], [4, 60000], [5, 60000]]) {
      await expect(s.recovery.connect('CU-A')).rejects.toThrow('offline');
      expect(s.recovery.snapshot()).toMatchObject({ attempt, nextRetryAt: delay });
    }
  });

  test('a failed CU switch leaves no disconnected simulator blocking retries', async () => {
    const simulator = { disconnect: jest.fn().mockResolvedValue() };
    s.sync.source = simulator;
    s.cu.connect.mockRejectedValueOnce(new Error('offline'));
    await expect(s.recovery.connect('CU-A')).rejects.toThrow('offline');
    expect(simulator.disconnect).toHaveBeenCalledTimes(1);
    expect(s.sync.source).toBeNull();
    s.advance(5000); await s.recovery.check();
    expect(s.sync.source).toBe(s.cu);
  });

  test('close removes its listeners and cancels the recovery timer', () => {
    s.recovery.close();
    expect(s.cu.listenerCount('status')).toBe(0);
    expect(s.cu.listenerCount('disconnected')).toBe(0);
    expect(jest.getTimerCount()).toBe(0);
  });
});

test('an in-flight poll cannot resurrect its old loop after a reconnect', async () => {
  jest.useFakeTimers();
  const sync = new SyncService(null);
  let finish;
  const source = new EventEmitter();
  source.isConnected = () => true;
  source.poll = jest.fn().mockImplementationOnce(() => new Promise(r => { finish = r; })).mockResolvedValue();
  try {
    sync.setDevice(source); sync.startPolling();
    sync.stopPolling(); sync.startPolling();
    finish(); await Promise.resolve(); await Promise.resolve();
    expect(jest.getTimerCount()).toBe(1);
    await jest.advanceTimersByTimeAsync(500);
    expect(source.poll).toHaveBeenCalledTimes(3);
  } finally { sync.stopPolling(); jest.useRealTimers(); }
});
