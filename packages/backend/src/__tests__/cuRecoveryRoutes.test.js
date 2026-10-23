import { jest } from '@jest/globals';
import EventEmitter from 'events';
import express from 'express';
import bluetooth, { setControlUnit, setSimulator, setSyncService, setCuRecovery } from '../routes/bluetooth.js';
import { CuRecovery } from '../services/CuRecovery.js';
import { SyncService } from '../services/SyncService.js';

// These route tests use only fake devices and a disposable test.db.
describe('CU recovery API integration', () => {
  let server, url, cu, simulator, sync, recovery;
  const post = (path, body = {}) => fetch(url + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  beforeEach(async () => {
    cu = new EventEmitter(); cu.ble = { connecting: false }; cu.connected = false;
    cu.isConnected = () => cu.connected;
    cu.connect = jest.fn(async address => { cu.address = address; cu.connected = true; cu.emit('connected'); });
    cu.disconnect = jest.fn(async () => { cu.connected = false; cu.emit('disconnected'); });
    cu.poll = jest.fn().mockResolvedValue();
    cu.start = jest.fn(); cu.stop = jest.fn(); cu.reset = jest.fn();
    simulator = new EventEmitter(); simulator.isSimulator = true;
    simulator.connect = jest.fn().mockResolvedValue(); simulator.disconnect = jest.fn().mockResolvedValue();
    simulator.isConnected = () => true;
    sync = new SyncService({ emit: jest.fn() });
    recovery = new CuRecovery(cu, sync, null);
    setControlUnit(cu); setSimulator(simulator); setSyncService(sync); setCuRecovery(recovery);
    const app = express(); app.use(express.json()); app.use('/api/bluetooth', bluetooth);
    server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    url = `http://127.0.0.1:${server.address().port}/api/bluetooth`;
  });
  afterEach(async () => {
    recovery.close(); sync.close();
    await new Promise(resolve => server.close(resolve));
    setCuRecovery(null); setSyncService(null); setControlUnit(null); setSimulator(null);
  });
  test('manual connect starts one polling loop and exposes recovery state without caching', async () => {
    expect((await post('/connect', { address: 'CU-API' })).status).toBe(200);
    expect(sync.source).toBe(cu); expect(sync.polling).toBe(true);
    const response = await fetch(url + '/status');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toMatchObject({ connected: true, recovery: { code: 'awaiting_data' } });
    await post('/disconnect');
    expect(recovery.enabled).toBe(false); expect(sync.source).toBeNull();
    expect(cu.start).not.toHaveBeenCalled(); expect(cu.stop).not.toHaveBeenCalled(); expect(cu.reset).not.toHaveBeenCalled();
  });
  test('a failed manual connection stays eligible for automatic retry', async () => {
    cu.connect.mockRejectedValueOnce(new Error('offline'));
    expect((await post('/connect', { address: 'CU-API' })).status).toBe(500);
    expect(recovery.enabled).toBe(true);
    expect(recovery.snapshot().code).toBe('retry_wait');
    recovery.now = () => recovery.nextRetryAt;
    await recovery.check();
    expect(sync.source).toBe(cu); expect(sync.polling).toBe(true);
  });
  test('switching to simulator cancels a pending connection without a late CU takeover', async () => {
    let finish, entered;
    const started = new Promise(resolve => { entered = resolve; });
    cu.connect.mockImplementation(() => { entered(); return new Promise(resolve => { finish = resolve; }); });
    const connecting = post('/connect', { address: 'CU-API' });
    await started;
    expect((await post('/connect', { address: 'SIMULATOR' })).status).toBe(200);
    finish(); expect((await connecting).status).toBe(500);
    expect(sync.source).toBe(simulator); expect(sync.polling).toBe(false);
    expect(recovery.enabled).toBe(false);
  });
  test('disconnect invalidates an initial pending connection before it has become the source', async () => {
    let finish, entered;
    const started = new Promise(resolve => { entered = resolve; });
    cu.connect.mockImplementation(() => { entered(); return new Promise(resolve => { finish = resolve; }); });
    const connecting = post('/connect', { address: 'CU-API' });
    await started;
    expect((await post('/disconnect')).status).toBe(200);
    finish(); expect((await connecting).status).toBe(500);
    expect(sync.source).toBeNull(); expect(sync.polling).toBe(false);
  });
});
