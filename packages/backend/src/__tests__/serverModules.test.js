import { jest } from '@jest/globals';
import express from 'express';
import fs from 'fs';
import os from 'os';
import path from 'path';
import request from 'supertest';
import { EventEmitter } from 'events';
import { prisma } from './setup.js';
import { autoConnect } from '../server/autoConnect.js';
import { addCoreRoutes } from '../server/coreRoutes.js';
import { createSimulatorRouter, createSyncRouter } from '../server/deviceRoutes.js';
import { handleSockets } from '../server/sockets.js';

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

const appWith = (mount) => {
  const app = express();
  app.use(express.json());
  mount(app);
  return request(app);
};

describe('/api/sync', () => {
  const syncService = {
    getState: () => ({ connected: true }),
    startRace: jest.fn(),
    stopRace: jest.fn(),
    pressButton: jest.fn(),
    getCuStatus: jest.fn(() => ({ start: 9 })),
  };
  const sessionService = {
    getState: () => ({ sessionId: 's1' }),
    getLeaderboard: () => [{ position: 1 }],
    loadSession: jest.fn(async (id) => ({ id, type: 'race', extra: true })),
    resetForNewSession: jest.fn(),
  };
  const api = appWith((app) => app.use('/api/sync', createSyncRouter({ syncService, sessionService })));

  test('state, leaderboard and CU status', async () => {
    expect((await api.get('/api/sync/state')).body).toEqual({ connected: true, session: { sessionId: 's1' } });
    expect((await api.get('/api/sync/leaderboard')).body).toEqual([{ position: 1 }]);
    expect((await api.get('/api/sync/cu-status')).body).toEqual({ start: 9 });
    syncService.getCuStatus.mockReturnValueOnce(null);
    expect((await api.get('/api/sync/cu-status')).body).toEqual({ error: 'No status yet' });
  });

  test('loading a session, 400 with the reason when it fails', async () => {
    expect((await api.post('/api/sync/load-session/s1')).body).toEqual({
      success: true,
      session: { id: 's1', type: 'race' },
    });
    sessionService.loadSession.mockRejectedValueOnce(new Error('Session not found'));
    const res = await api.post('/api/sync/load-session/nope');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Session not found' });
  });

  test('reset, start, stop and buttons', async () => {
    for (const path of ['reset', 'start', 'stop']) {
      expect((await api.post(`/api/sync/${path}`)).body).toEqual({ success: true });
    }
    expect(sessionService.resetForNewSession).toHaveBeenCalled();
    expect(syncService.startRace).toHaveBeenCalled();
    expect(syncService.stopRace).toHaveBeenCalled();
    expect((await api.post('/api/sync/button/2')).body).toEqual({ success: true, button: 2 });
    expect(syncService.pressButton).toHaveBeenCalledWith(2);
  });
});

describe('/api/simulator', () => {
  const simulator = {
    connected: false,
    isConnected: () => simulator.connected,
    getState: () => ({ running: false }),
    start: jest.fn(),
    stop: jest.fn(),
    togglePause: jest.fn(),
  };
  const syncService = { device: null, getDevice: () => syncService.device };
  const api = appWith((app) => app.use('/api/simulator', createSimulatorRouter({ simulator, syncService })));

  test('its state says whether it is the current device', async () => {
    expect((await api.get('/api/simulator')).body).toEqual({ running: false, isConnected: false });
    syncService.device = simulator;
    expect((await api.get('/api/simulator')).body.isConnected).toBe(true);
  });

  test.each([
    ['start', 'start', 'started'],
    ['stop', 'stop', 'stopped'],
    ['pause', 'togglePause', 'toggled'],
  ])('%s, once connected', async (action, command, status) => {
    simulator.connected = false;
    const refused = await api.post(`/api/simulator/${action}`);
    expect(refused.status).toBe(400);
    expect(refused.body).toEqual({ error: 'Simulator not connected' });
    expect(simulator[command]).not.toHaveBeenCalled();

    simulator.connected = true;
    expect((await api.post(`/api/simulator/${action}`)).body).toEqual({ status });
    expect(simulator[command]).toHaveBeenCalled();
  });
});

describe('sockets', () => {
  let io, simulator, controlUnit, syncService;

  beforeEach(() => {
    io = new EventEmitter();
    simulator = {
      connected: true,
      isConnected: () => simulator.connected,
      isRunning: true,
      raceActive: false,
      raceTime: 1200,
      cars: [{}, {}],
      getState: () => ({ running: true }),
      start: jest.fn(),
      stop: jest.fn(),
      togglePause: jest.fn(),
      setCarSpeed: jest.fn(),
    };
    controlUnit = { connected: true, isConnected: () => controlUnit.connected };
    syncService = { device: null, getDevice: () => syncService.device, startRace: jest.fn(), stopRace: jest.fn() };
    handleSockets(io, { syncService, simulator, controlUnit });
  });

  /** A browser connecting: what it was sent, and a way to send events back. */
  const connect = () => {
    const socket = new EventEmitter();
    socket.id = 'browser';
    socket.sent = [];
    socket.emit = (event, data) => {
      socket.sent.push(data === undefined ? [event] : [event, data]);
      return true;
    };
    socket.send = (event, data) => EventEmitter.prototype.emit.call(socket, event, data);
    io.emit('connection', socket);
    return socket;
  };

  test('a browser learns which device is connected', () => {
    expect(connect().sent).toEqual([['cu:status', { connected: false, deviceType: null }]]);

    syncService.device = simulator;
    expect(connect().sent).toEqual([
      ['cu:connected'],
      ['race:status', { running: true, active: false, raceTime: 1200, carCount: 2, deviceType: 'simulator' }],
    ]);
    simulator.connected = false;
    expect(connect().sent).toEqual([['cu:status', { connected: false, deviceType: null }]]);

    syncService.device = controlUnit;
    expect(connect().sent).toEqual([['cu:connected'], ['cu:status', { connected: true, deviceType: 'controlUnit' }]]);
    controlUnit.connected = false;
    expect(connect().sent).toEqual([['cu:status', { connected: false, deviceType: null }]]);
  });

  test('race start and stop go through the sync service, whatever the device', async () => {
    const socket = connect();
    socket.send('race:start', { sessionId: 's1' });
    socket.send('race:stop');
    socket.send('disconnect');
    expect(syncService.startRace).toHaveBeenCalled();
    expect(syncService.stopRace).toHaveBeenCalled();
  });

  test('simulator commands run only while it is connected', () => {
    const socket = connect();
    socket.send('race:pause');
    socket.send('simulator:start');
    socket.send('simulator:stop');
    socket.send('simulator:pause');
    socket.send('car:setSpeed', { carId: 1, speed: 9 });
    expect(simulator.togglePause).toHaveBeenCalledTimes(2);
    expect(simulator.start).toHaveBeenCalledTimes(1);
    expect(simulator.stop).toHaveBeenCalledTimes(1);
    expect(simulator.setCarSpeed).toHaveBeenCalledWith(1, 9);

    simulator.connected = false;
    for (const event of ['race:pause', 'simulator:start', 'simulator:stop', 'simulator:pause']) socket.send(event);
    socket.send('car:setSpeed', { carId: 1, speed: 9 });
    expect(simulator.togglePause).toHaveBeenCalledTimes(2);
    expect(simulator.setCarSpeed).toHaveBeenCalledTimes(1);
  });

  test("a browser asking for the device's state", () => {
    const socket = connect();
    socket.sent.length = 0;
    socket.send('simulator:getState');
    syncService.device = simulator;
    socket.send('simulator:getState');
    syncService.device = controlUnit;
    socket.send('simulator:getState');
    expect(socket.sent).toEqual([
      ['cu:state', { connected: false }],
      ['simulator:state', { running: true }],
      ['cu:state', { connected: true }],
    ]);
  });
});

describe('auto-connect', () => {
  let syncService, controlUnit;

  beforeEach(async () => {
    await prisma.preference.deleteMany({ where: { key: 'autoConnect' } });
    await prisma.device.deleteMany();
    syncService = { setDevice: jest.fn(), startPolling: jest.fn() };
    controlUnit = { connect: jest.fn() };
  });

  const prefer = (value) => prisma.preference.create({ data: { key: 'autoConnect', value: JSON.stringify(value) } });
  const device = (address, type, lastConnected) =>
    prisma.device.create({ data: { address, name: address, type, lastConnected: new Date(lastConnected) } });

  test('reconnects the control unit used last, when asked to', async () => {
    await prefer(true);
    await device('OLD', 'cu', '2026-01-01');
    await device('NEW', 'cu', '2026-02-01');
    await device('SIMULATOR', 'simulator', '2026-03-01');

    await autoConnect({ prisma, syncService, controlUnit });
    expect(syncService.setDevice).toHaveBeenCalledWith(controlUnit);
    expect(controlUnit.connect).toHaveBeenCalledWith('NEW');
    expect(syncService.startPolling).toHaveBeenCalled();
  });

  test('does nothing without the preference, when it is off, or with no control unit known', async () => {
    await autoConnect({ prisma, syncService, controlUnit });
    await prefer(false);
    await autoConnect({ prisma, syncService, controlUnit });
    await prisma.preference.update({ where: { key: 'autoConnect' }, data: { value: 'true' } });
    await autoConnect({ prisma, syncService, controlUnit });
    expect(controlUnit.connect).not.toHaveBeenCalled();
  });

  test('a failure is only logged', async () => {
    await prefer(true);
    await device('CU', 'cu', '2026-01-01');
    controlUnit.connect.mockRejectedValueOnce(new Error('Out of range'));
    await autoConnect({ prisma, syncService, controlUnit });
    expect(syncService.startPolling).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith('⚠️  Auto-connect failed:', 'Out of range');

    const broken = { preference: { findUnique: jest.fn().mockRejectedValue(new Error('db down')) } };
    await autoConnect({ prisma: broken, syncService, controlUnit });
    expect(console.warn).toHaveBeenCalledWith('⚠️  Auto-connect check failed:', 'db down');
  });
});

describe('core routes', () => {
  let uploadsDir, api;

  beforeAll(() => {
    uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'racehubos-uploads-'));
    fs.mkdirSync(path.join(uploadsDir, 'drivers'));
    fs.writeFileSync(path.join(uploadsDir, 'drivers', 'ana.png'), 'png');
    api = appWith((app) => addCoreRoutes(app, { version: '9.9.9', uploadsDir }));
  });
  afterAll(() => fs.rmSync(uploadsDir, { recursive: true, force: true }));

  test('an uploaded image by type, 404 when missing, 400 for an unknown type', async () => {
    const res = await api.get('/api/img/drivers/ana.png');
    expect(res.status).toBe(200);
    expect(res.body.toString()).toBe('png');
    expect((await api.get('/api/img/drivers/nope.png')).body).toEqual({ error: 'Image not found' });
    expect((await api.get('/api/img/secrets/ana.png')).status).toBe(400);
  });

  test('health check and API listing carry the version', async () => {
    expect((await api.get('/health')).body).toMatchObject({ status: 'ok', version: '9.9.9' });
    const { body } = await api.get('/api');
    expect(body).toMatchObject({ name: 'RaceHubOS API', version: '9.9.9' });
    expect(body.endpoints.sessions).toBe('/api/sessions');
  });
});
