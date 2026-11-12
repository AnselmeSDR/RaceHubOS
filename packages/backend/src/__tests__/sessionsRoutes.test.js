import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { SessionStatus, SessionType } from '@racehubos/shared';
import { prisma } from './setup.js';
import sessionsRouter, { setSessionService } from '../routes/sessions.js';

const app = express();
app.use(express.json());
app.use('/api/sessions', sessionsRouter);
const api = request(app);

const setStatus = (status) => async () => {
  await prisma.session.updateMany({ where: { id: service.lastId }, data: { status } });
};
const service = {
  prisma,
  activeSessionId: null,
  lastId: null,
  getLeaderboard: jest.fn(() => [{ live: true }]),
  createSession: jest.fn(),
  deleteSession: jest.fn(async (id) => {
    await prisma.session.update({ where: { id }, data: { deletedAt: new Date() } });
  }),
  startSession: jest.fn(async (id) => {
    service.lastId = id;
    await setStatus(SessionStatus.ACTIVE)();
  }),
  pauseSession: jest.fn(() => setStatus(SessionStatus.PAUSED)()),
  resumeSession: jest.fn(() => setStatus(SessionStatus.ACTIVE)()),
  stopSession: jest.fn(() => setStatus(SessionStatus.FINISHED)()),
  resetSession: jest.fn(),
};
setSessionService(service);

async function wipe() {
  await prisma.trackRecord.deleteMany();
  await prisma.lap.deleteMany();
  await prisma.sessionDriver.deleteMany();
  await prisma.session.deleteMany();
  await prisma.championship.deleteMany();
  await prisma.driver.deleteMany();
  await prisma.car.deleteMany();
  await prisma.track.deleteMany();
  await prisma.division.deleteMany();
}

let ring, oval, cup, ana, ben, gt;
let lapNumber = 0;

beforeEach(async () => {
  await wipe();
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  service.activeSessionId = null;
  ring = await prisma.track.create({ data: { name: 'Ring' } });
  oval = await prisma.track.create({ data: { name: 'Oval' } });
  cup = await prisma.championship.create({ data: { name: 'Cup', season: '2026', trackId: ring.id } });
  ana = await prisma.driver.create({ data: { name: 'Ana' } });
  ben = await prisma.driver.create({ data: { name: 'Ben' } });
  gt = await prisma.car.create({ data: { brand: 'Ford', model: 'GT' } });
});
afterEach(() => jest.restoreAllMocks());

const newSession = (data = {}) =>
  prisma.session.create({ data: { type: SessionType.RACE, status: SessionStatus.DRAFT, trackId: ring.id, ...data } });

const lap = (session, driver, controller, lapTime, data = {}) =>
  prisma.lap.create({
    data: {
      sessionId: session.id,
      trackId: session.trackId,
      driverId: driver?.id ?? null,
      carId: gt.id,
      controller,
      phase: session.type,
      lapNumber: ++lapNumber,
      lapTime,
      ...data,
    },
  });

describe('GET /api/sessions', () => {
  const names = async (query = '') => {
    const res = await api.get(`/api/sessions?${query}`);
    expect(res.status).toBe(200);
    return res.body.data.map((s) => s.name);
  };

  test('filtered by status, track, type, championship (or none) and deletion', async () => {
    await newSession({ name: 'A', status: SessionStatus.FINISHED, championshipId: cup.id });
    await newSession({ name: 'B', type: SessionType.QUALIF, trackId: oval.id });
    await newSession({ name: 'C', deletedAt: new Date() });

    expect(await names('sortBy=name&sortOrder=asc')).toEqual(['A', 'B']);
    expect(await names('deleted=true')).toEqual(['C']);
    expect(await names(`status=${SessionStatus.FINISHED}`)).toEqual(['A']);
    expect(await names(`status=all&sortBy=name&sortOrder=asc`)).toEqual(['A', 'B']);
    expect(await names(`status=${SessionStatus.FINISHED},${SessionStatus.DRAFT}&sortBy=name&sortOrder=asc`)).toEqual([
      'A',
      'B',
    ]);
    expect(await names(`trackId=${oval.id}`)).toEqual(['B']);
    expect(await names(`trackId=${oval.id},${ring.id}`)).toHaveLength(2);
    expect(await names(`type=${SessionType.QUALIF}`)).toEqual(['B']);
    expect(await names(`type=${SessionType.QUALIF},${SessionType.RACE}`)).toHaveLength(2);
    expect(await names('has_championship=true')).toEqual(['A']);
    expect(await names(`championshipId=${cup.id}`)).toEqual(['A']);
    expect(await names(`championshipId=${cup.id},other`)).toEqual(['A']);
    expect(await names('championshipId=null')).toEqual(['B']);
    expect(await names(`championshipId=null,${cup.id}`)).toHaveLength(2);
  });

  test('paginated by the database, or after a computed sort', async () => {
    const a = await newSession({
      name: 'A',
      championshipId: cup.id,
      startedAt: new Date('2026-01-01T10:00:00Z'),
      finishedAt: new Date('2026-01-01T10:30:00Z'),
    });
    const b = await newSession({ name: 'B', trackId: oval.id });
    await newSession({
      name: 'C',
      startedAt: new Date('2026-01-01T10:00:00Z'),
      finishedAt: new Date('2026-01-01T10:05:00Z'),
    });
    await prisma.sessionDriver.create({ data: { sessionId: b.id, driverId: ana.id, controller: 0 } });
    await prisma.sessionDriver.create({ data: { sessionId: b.id, driverId: ben.id, controller: 1 } });
    await lap(a, ana, 0, 8000);
    await lap(a, ana, 0, 8100);
    await lap(a, ana, 0, 8200, { deletedAt: new Date() });

    const res = await api.get('/api/sessions?sortBy=name&sortOrder=asc&limit=2');
    expect(res.body.data.map((s) => s.name)).toEqual(['A', 'B']);
    expect(res.body).toMatchObject({ total: 3, hasMore: true });
    expect(res.body.data[0]._count.laps).toBe(2);

    expect(await names('sortBy=track&sortOrder=asc')).toEqual(['B', 'A', 'C']);
    expect(await names('sortBy=championship')).toEqual(['A', 'B', 'C']);
    expect(await names('sortBy=drivers')).toEqual(['B', 'A', 'C']);
    expect(await names('sortBy=laps')).toEqual(['A', 'B', 'C']);
    expect(await names('sortBy=duration&sortOrder=asc')).toEqual(['B', 'C', 'A']);
    expect(await names('sortBy=duration&limit=1&offset=1')).toEqual(['C']);
    expect(await names('sortBy=date&sortOrder=asc')).toEqual(['A', 'B', 'C']);
  });

  test('a bad sort answers 500 with the error', async () => {
    const res = await api.get('/api/sessions?sortBy=nope');
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

describe('GET /api/sessions/:id', () => {
  test('with its track, championship, entries by controller and laps not deleted in time order', async () => {
    const s = await newSession({ championshipId: cup.id });
    await prisma.sessionDriver.create({ data: { sessionId: s.id, driverId: ben.id, controller: 1 } });
    await prisma.sessionDriver.create({ data: { sessionId: s.id, driverId: ana.id, controller: 0 } });
    await lap(s, ana, 0, 8000, { timestamp: new Date('2026-01-01T10:02:00Z') });
    await lap(s, ana, 0, 8100, { timestamp: new Date('2026-01-01T10:01:00Z') });
    await lap(s, ana, 0, 7000, { deletedAt: new Date() });

    const res = await api.get(`/api/sessions/${s.id}`);
    expect(res.body.data.drivers.map((d) => d.driver.name)).toEqual(['Ana', 'Ben']);
    expect(res.body.data.laps.map((l) => l.lapTime)).toEqual([8100, 8000]);
    expect(res.body.data).toMatchObject({ track: { name: 'Ring' }, championship: { name: 'Cup' } });
    expect((await api.get('/api/sessions/nope')).status).toBe(404);
  });
});

describe('exports', () => {
  test('a workbook for one or several sessions, 404 for none', async () => {
    const s = await newSession({ status: SessionStatus.FINISHED });
    expect((await api.get(`/api/sessions/${s.id}/export`)).status).toBe(200);
    expect((await api.get(`/api/sessions/export?ids=${s.id}`)).status).toBe(200);
    expect((await api.get('/api/sessions/nope/export')).status).toBe(404);
    expect((await api.get('/api/sessions/export')).status).toBe(404);
  });
});

describe('POST /api/sessions', () => {
  test("the service's session as 201, its error as 400", async () => {
    service.createSession.mockResolvedValueOnce({ id: 's1' });
    expect((await api.post('/api/sessions').send({ type: SessionType.PRACTICE })).body).toEqual({
      success: true,
      data: { id: 's1' },
    });
    service.createSession.mockRejectedValueOnce(new Error('Track required'));
    const res = await api.post('/api/sessions').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Track required');
  });
});

describe('PUT /api/sessions/:id', () => {
  test('updates the fields given; empty limits and championship become null', async () => {
    const s = await newSession({ championshipId: cup.id, maxLaps: 10 });
    let res = await api.put(`/api/sessions/${s.id}`).send({
      name: 'Final',
      type: SessionType.QUALIF,
      trackId: oval.id,
      championshipId: '',
      fuelMode: 'ON',
      maxDuration: 0,
      maxLaps: 0,
      gracePeriod: 5000,
      order: 3,
    });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      name: 'Final',
      type: SessionType.QUALIF,
      trackId: oval.id,
      championshipId: null,
      maxDuration: null,
      maxLaps: null,
      gracePeriod: 5000,
      order: 3,
      track: { name: 'Oval' },
    });
    res = await api.put(`/api/sessions/${s.id}`).send({ championshipId: cup.id });
    expect(res.body.data.championship.name).toBe('Cup');
    res = await api.put(`/api/sessions/${s.id}`).send({ trackId: 'nope' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid trackId or championshipId');
    res = await api.put('/api/sessions/nope').send({ name: 'X' });
    expect(res.status).toBe(500);
  });
});

describe('DELETE and restore', () => {
  test('a first delete goes through the service, a second erases; a restore brings back what was hidden with it', async () => {
    const s = await newSession();
    const deletedAt = new Date('2026-01-01T00:00:00Z');
    await prisma.sessionDriver.create({ data: { sessionId: s.id, driverId: ana.id, controller: 0 } });
    await lap(s, ana, 0, 8000);

    expect((await api.delete(`/api/sessions/${s.id}`)).body).toEqual({ success: true, message: 'Session deleted' });
    expect(service.deleteSession).toHaveBeenCalledWith(s.id);

    await prisma.session.update({ where: { id: s.id }, data: { deletedAt } });
    await prisma.sessionDriver.updateMany({ where: { sessionId: s.id }, data: { deletedAt } });
    await prisma.lap.updateMany({ where: { sessionId: s.id }, data: { deletedAt } });
    await lap(s, ben, 1, 9000, { deletedAt: new Date('2025-01-01T00:00:00Z') });
    await prisma.trackRecord.create({
      data: { trackId: ring.id, sessionId: s.id, driverId: ana.id, carId: gt.id, lapTime: 8000, deletedAt },
    });

    expect((await api.patch(`/api/sessions/${s.id}/restore`)).body).toEqual({
      success: true,
      message: 'Session restored',
    });
    expect((await prisma.session.findUnique({ where: { id: s.id } })).deletedAt).toBeNull();
    expect(await prisma.sessionDriver.count({ where: { sessionId: s.id, deletedAt: null } })).toBe(1);
    expect(await prisma.lap.count({ where: { sessionId: s.id, deletedAt: null } })).toBe(1);
    expect(await prisma.trackRecord.count({ where: { sessionId: s.id, deletedAt: null } })).toBe(1);

    await prisma.session.update({ where: { id: s.id }, data: { deletedAt } });
    await prisma.trackRecord.deleteMany();
    expect((await api.delete(`/api/sessions/${s.id}`)).status).toBe(200);
    expect(await prisma.session.findUnique({ where: { id: s.id } })).toBeNull();
    expect(await prisma.lap.count({ where: { sessionId: s.id } })).toBe(0);
  });

  test('404 when missing', async () => {
    expect((await api.delete('/api/sessions/nope')).status).toBe(404);
    expect((await api.patch('/api/sessions/nope/restore')).status).toBe(404);
  });
});

describe('PUT /api/sessions/:id/drivers', () => {
  test('replaces the line-up, keeping partial rows with a controller, grid in order unless given', async () => {
    const s = await newSession();
    await prisma.sessionDriver.create({ data: { sessionId: s.id, driverId: ben.id, controller: 5 } });
    const res = await api.put(`/api/sessions/${s.id}/drivers`).send({
      drivers: [
        { driverId: ben.id, carId: gt.id, controller: '2' },
        { carId: gt.id, controller: 0, gridPos: 7 },
        { driverId: ana.id },
        { controller: 3 },
        { driverId: ana.id, controller: 1 },
      ],
    });
    expect(res.status).toBe(200);
    expect(res.body.data.drivers.map((d) => [d.controller, d.driverId, d.carId, d.gridPos])).toEqual([
      [0, null, gt.id, 7],
      [1, ana.id, null, 3],
      [2, ben.id, gt.id, 1],
    ]);
  });

  test('a balancing line-up belongs to the reference driver when there is one', async () => {
    const s = await newSession({ type: SessionType.BALANCING });
    await prisma.driver.update({ where: { id: ana.id }, data: { isReference: true } });
    const res = await api
      .put(`/api/sessions/${s.id}/drivers`)
      .send({ drivers: [{ driverId: ben.id, carId: gt.id, controller: 0 }] });
    expect(res.body.data.drivers[0].driverId).toBe(ana.id);
  });

  test('400 without an array, 404 for an unknown session, an empty line-up clears it', async () => {
    const s = await newSession();
    expect((await api.put(`/api/sessions/${s.id}/drivers`).send({})).status).toBe(400);
    expect((await api.put('/api/sessions/nope/drivers').send({ drivers: [] })).status).toBe(404);
    await prisma.sessionDriver.create({ data: { sessionId: s.id, driverId: ben.id, controller: 5 } });
    const res = await api.put(`/api/sessions/${s.id}/drivers`).send({ drivers: [] });
    expect(res.body.data.drivers).toEqual([]);
  });
});

describe('PATCH /api/sessions/:id/status', () => {
  const patch = (id, status) => api.patch(`/api/sessions/${id}/status`).send({ status });

  test('each allowed transition goes through the service; back to draft clears the times', async () => {
    const s = await newSession();
    let res = await patch(s.id, SessionStatus.ACTIVE);
    expect(res.body).toMatchObject({ success: true, message: "Status changed to 'active'" });
    expect(service.startSession).toHaveBeenCalledWith(s.id);
    expect((await patch(s.id, SessionStatus.PAUSED)).body.data.status).toBe(SessionStatus.PAUSED);
    expect((await patch(s.id, SessionStatus.ACTIVE)).body.data.status).toBe(SessionStatus.ACTIVE);
    expect(service.resumeSession).toHaveBeenCalled();
    expect((await patch(s.id, SessionStatus.FINISHED)).body.data.status).toBe(SessionStatus.FINISHED);

    await prisma.session.update({ where: { id: s.id }, data: { startedAt: new Date(), finishedAt: new Date() } });
    res = await patch(s.id, SessionStatus.DRAFT);
    expect(res.body.data).toMatchObject({ status: SessionStatus.DRAFT, startedAt: null, finishedAt: null });
  });

  test('finishing goes straight to the database', async () => {
    const s = await newSession({ status: SessionStatus.ACTIVE });
    const res = await patch(s.id, SessionStatus.FINISHING);
    expect(res.body.data.status).toBe(SessionStatus.FINISHING);
  });

  test('refused: unknown status, forbidden transition, unknown session', async () => {
    const s = await newSession();
    let res = await patch(s.id, 'flying');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid status. Must be one of: draft, active, paused, finishing, finished');
    expect((await patch(s.id)).status).toBe(400);
    res = await patch(s.id, SessionStatus.PAUSED);
    expect(res.body.error).toBe("Cannot transition from 'draft' to 'paused'");
    const ready = await newSession({ status: SessionStatus.READY });
    expect((await patch(ready.id, SessionStatus.ACTIVE)).body.error).toBe("Cannot transition from 'ready' to 'active'");
    expect((await patch('nope', SessionStatus.ACTIVE)).status).toBe(404);
  });

  test('a service failure answers 500', async () => {
    const s = await newSession();
    service.startSession.mockRejectedValueOnce(new Error('CU offline'));
    const res = await patch(s.id, SessionStatus.ACTIVE);
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('CU offline');
  });
});

describe('start, pause, resume, stop, reset', () => {
  test('each from the right status only', async () => {
    const s = await newSession();
    const post = (action) => api.post(`/api/sessions/${s.id}/${action}`);

    expect((await post('pause')).body.error).toBe("Session must be 'active' to pause, current: draft");
    expect((await post('resume')).body.error).toBe("Session must be 'paused' to resume, current: draft");
    expect((await post('stop')).body.error).toBe('Session must be active/paused/finishing to stop, current: draft');
    let res = await post('start');
    expect(res.body).toMatchObject({
      success: true,
      message: 'Session started',
      data: { status: SessionStatus.ACTIVE },
    });
    expect((await post('start')).body.error).toBe("Session must be 'draft' to start, current: active");
    expect((await post('pause')).body.message).toBe('Session paused');
    expect((await post('resume')).body.message).toBe('Session resumed');
    res = await post('stop');
    expect(res.body).toMatchObject({ message: 'Session stopped', data: { status: SessionStatus.FINISHED } });
    res = await post('reset');
    expect(res.body.message).toBe('Session reset');
    expect(service.resetSession).toHaveBeenCalledWith(s.id);
  });

  test('404 for an unknown session, 500 when the service fails', async () => {
    for (const action of ['start', 'pause', 'resume', 'stop']) {
      expect((await api.post(`/api/sessions/nope/${action}`)).status).toBe(404);
    }
    const s = await newSession();
    service.startSession.mockRejectedValueOnce(new Error('boom'));
    expect((await api.post(`/api/sessions/${s.id}/start`)).status).toBe(500);
    service.resetSession.mockRejectedValueOnce(new Error('boom'));
    expect((await api.post(`/api/sessions/${s.id}/reset`)).status).toBe(500);
  });
});

describe('GET /api/sessions/:id/leaderboard', () => {
  test('live from the service for the active session', async () => {
    const s = await newSession();
    service.activeSessionId = s.id;
    expect((await api.get(`/api/sessions/${s.id}/leaderboard`)).body).toEqual({
      success: true,
      data: [{ live: true }],
    });
  });

  test('otherwise from the stored laps: totals, best and last lap, in race order, divisions shown', async () => {
    const s = await newSession();
    const gold = await prisma.division.create({ data: { name: 'GOLD', scope: 'driver' } });
    const gt3 = await prisma.division.create({ data: { name: 'GT3', scope: 'car' } });
    await prisma.driverDivision.create({ data: { driverId: ana.id, divisionId: gold.id } });
    await prisma.carDivision.create({ data: { carId: gt.id, divisionId: gt3.id } });
    await prisma.sessionDriver.create({
      data: { sessionId: s.id, driverId: ana.id, carId: gt.id, controller: 0, gridPos: 2 },
    });
    await prisma.sessionDriver.create({
      data: { sessionId: s.id, driverId: ben.id, carId: gt.id, controller: 1, gridPos: 1 },
    });
    await lap(s, ana, 0, 8000.4, { timestamp: new Date('2026-01-01T10:01:00Z') });
    await lap(s, ana, 0, 8200, { timestamp: new Date('2026-01-01T10:02:00Z') });
    await lap(s, ana, 0, 7000, { deletedAt: new Date() });
    await lap(s, ben, 1, 7900, { timestamp: new Date('2026-01-01T10:01:30Z') });

    const res = await api.get(`/api/sessions/${s.id}/leaderboard`);
    expect(res.body.data.map((e) => [e.controller, e.totalLaps, e.totalTime, e.bestLapTime, e.lastLapTime])).toEqual([
      [0, 2, 16200, 8000.4, 8200],
      [1, 1, 7900, 7900, 7900],
    ]);
    expect(res.body.data[0]).toMatchObject({
      driverId: ana.id,
      gridPos: 2,
      driver: { name: 'Ana', divisions: [{ name: 'GOLD' }] },
      car: { divisions: [{ name: 'GT3' }] },
    });
    expect(res.body.data[0]).not.toHaveProperty('laps');
  });

  test('a balancing session also gives each lap in order, and a car without laps', async () => {
    const s = await newSession({ type: SessionType.BALANCING });
    await prisma.sessionDriver.create({ data: { sessionId: s.id, carId: gt.id, controller: 0 } });
    await prisma.sessionDriver.create({ data: { sessionId: s.id, carId: gt.id, controller: 1 } });
    await lap(s, null, 0, 8100.6, { lapNumber: 2, timestamp: new Date('2026-01-01T10:02:00Z') });
    await lap(s, null, 0, 8000, { lapNumber: 1, timestamp: new Date('2026-01-01T10:01:00Z') });

    const res = await api.get(`/api/sessions/${s.id}/leaderboard`);
    const byController = Object.fromEntries(res.body.data.map((e) => [e.controller, e]));
    expect(byController[0].laps).toEqual([
      { lapNumber: 1, lapTime: 8000 },
      { lapNumber: 2, lapTime: 8101 },
    ]);
    expect(byController[1]).toMatchObject({ totalLaps: 0, bestLapTime: null, lastLapTime: null, laps: [] });
  });

  test('404 for an unknown session', async () => {
    expect((await api.get('/api/sessions/nope/leaderboard')).status).toBe(404);
  });
});
