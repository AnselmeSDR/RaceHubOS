import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { SessionStatus, SessionType } from '@racehubos/shared';
import { prisma } from './setup.js';
import statsRouter from '../routes/stats.js';

const app = express();
app.use(express.json());
app.use('/api/stats', statsRouter);
const api = request(app);

async function wipe() {
  await prisma.lap.deleteMany();
  await prisma.sessionDriver.deleteMany();
  await prisma.session.deleteMany();
  await prisma.championship.deleteMany();
  await prisma.driver.deleteMany();
  await prisma.team.deleteMany();
  await prisma.car.deleteMany();
  await prisma.track.deleteMany();
}

let f;
let lapNumber = 0;

/**
 * Ana (team Red) wins the championship race R1 on Ring and is third on Oval (R2); Ben is second
 * then DNF. Ana also sets a qualif lap (Q1) and a deleted lap; Ben the fastest practice lap.
 */
async function fixture() {
  const ring = await prisma.track.create({ data: { name: 'Ring' } });
  const oval = await prisma.track.create({ data: { name: 'Oval' } });
  const empty = await prisma.track.create({ data: { name: 'Empty', bestLap: 6000 } });
  const red = await prisma.team.create({ data: { name: 'Red' } });
  const blue = await prisma.team.create({ data: { name: 'Blue' } });
  const ana = await prisma.driver.create({ data: { name: 'Ana', teamId: red.id } });
  const ben = await prisma.driver.create({ data: { name: 'Ben' } });
  const cid = await prisma.driver.create({ data: { name: 'Cid' } });
  const gt = await prisma.car.create({ data: { brand: 'Ford', model: 'GT' } });
  const p911 = await prisma.car.create({ data: { brand: 'Porsche', model: '911' } });
  const cup = await prisma.championship.create({ data: { name: 'Cup', season: '2026', trackId: ring.id } });

  const session = (type, track, data = {}) =>
    prisma.session.create({ data: { type, status: SessionStatus.FINISHED, trackId: track.id, ...data } });
  const r1 = await session(SessionType.RACE, ring, {
    championshipId: cup.id,
    createdAt: new Date('2026-01-01T10:00:00Z'),
    startedAt: new Date('2026-01-01T10:00:00Z'),
    finishedAt: new Date('2026-01-01T10:10:00Z'),
  });
  const q1 = await session(SessionType.QUALIF, ring, {
    championshipId: cup.id,
    createdAt: new Date('2026-01-01T09:00:00Z'),
  });
  const r2 = await session(SessionType.RACE, oval, { createdAt: new Date('2026-01-02T10:00:00Z') });
  const p = await session(SessionType.PRACTICE, oval, { createdAt: new Date('2026-01-03T10:00:00Z') });

  const lap = (s, driver, car, lapTime, data = {}) =>
    prisma.lap.create({
      data: {
        sessionId: s.id,
        trackId: s.trackId,
        driverId: driver.id,
        carId: car.id,
        controller: 0,
        phase: s.type,
        lapNumber: ++lapNumber,
        lapTime,
        ...data,
      },
    });
  const laps = {
    a1: await lap(r1, ana, gt, 8000, { timestamp: new Date('2026-01-01T10:01:00Z') }),
    a2: await lap(r1, ana, gt, 8200, { timestamp: new Date('2026-01-01T10:02:00Z') }),
    b1: await lap(r1, ben, p911, 8100, { timestamp: new Date('2026-01-01T10:03:00Z') }),
    aq: await lap(q1, ana, gt, 7900, { timestamp: new Date('2026-01-01T09:00:00Z') }),
    ad: await lap(r2, ana, gt, 9000, { deletedAt: new Date(), timestamp: new Date('2026-01-02T10:00:00Z') }),
    b2: await lap(r2, ben, p911, 9500, { timestamp: new Date('2026-01-02T10:01:00Z') }),
    bp: await lap(p, ben, p911, 7000, { timestamp: new Date('2026-01-03T10:00:00Z') }),
  };

  const entry = (s, driver, car, controller, data) =>
    prisma.sessionDriver.create({ data: { sessionId: s.id, driverId: driver.id, carId: car.id, controller, ...data } });
  await entry(r1, ana, gt, 0, { finalPos: 1, gridPos: 1 });
  await entry(r1, ben, p911, 1, { finalPos: 2, gridPos: 2 });
  await entry(r2, ana, gt, 0, { finalPos: 3 });
  await entry(r2, ben, p911, 1, {});
  await entry(q1, ana, gt, 0, { position: 1 });

  return { ring, oval, empty, red, blue, ana, ben, cid, gt, p911, cup, r1, q1, r2, p, laps };
}

beforeEach(async () => {
  await wipe();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  f = await fixture();
});
afterEach(() => jest.restoreAllMocks());

describe('GET /api/stats/drivers', () => {
  const stats = async (query = '') => {
    const res = await api.get(`/api/stats/drivers${query}`);
    expect(res.status).toBe(200);
    return Object.fromEntries(res.body.data.map((d) => [d.name, d.statistics]));
  };

  test('races, wins, podiums, poles, DNFs and lap times; the most successful first', async () => {
    const res = await api.get('/api/stats/drivers');
    expect(res.body.data.map((d) => d.name)).toEqual(['Ana', 'Ben', 'Cid']);
    expect(res.body.data[0].team.name).toBe('Red');
    expect(res.body.filters).toEqual({});
    const { Ana, Ben, Cid } = await stats();
    expect(Ana).toEqual({
      totalRaces: 2,
      totalLaps: 4,
      wins: 1,
      podiums: 2,
      bestLap: 7900,
      avgLapTime: (8000 + 8200 + 7900) / 3,
      dnf: 0,
      polePositions: 1,
    });
    expect(Ben).toMatchObject({ totalRaces: 2, totalLaps: 3, wins: 0, podiums: 1, bestLap: 7000, dnf: 1 });
    expect(Cid).toEqual({
      totalRaces: 0,
      totalLaps: 0,
      wins: 0,
      podiums: 0,
      bestLap: null,
      avgLapTime: null,
      dnf: 0,
      polePositions: 0,
    });
  });

  test('within a championship, on a track, or in championships only', async () => {
    const inCup = await stats(`?championshipId=${f.cup.id}`);
    expect(inCup.Ana).toMatchObject({ totalRaces: 1, totalLaps: 3, wins: 1, bestLap: 7900 });
    expect(inCup.Ben).toMatchObject({ totalRaces: 1, bestLap: 8100, dnf: 0 });
    expect(await stats('?has_championship=true')).toEqual(inCup);

    const onOval = await stats(`?trackId=${f.oval.id}`);
    expect(onOval.Ana).toMatchObject({
      totalRaces: 1,
      totalLaps: 1,
      wins: 0,
      podiums: 1,
      bestLap: null,
      avgLapTime: null,
    });
    expect(onOval.Ben).toMatchObject({ totalRaces: 1, bestLap: 7000, dnf: 1 });
  });
});

describe('GET /api/stats/cars', () => {
  test('races, wins, reliability and lap times; the most winning first; per championship or track', async () => {
    let res = await api.get('/api/stats/cars');
    expect(res.body.data.map((c) => c.model)).toEqual(['GT', '911']);
    expect(res.body.data[0].statistics).toEqual({
      totalRaces: 2,
      totalLaps: 4,
      wins: 1,
      bestLap: 7900,
      avgLapTime: (8000 + 8200 + 7900) / 3,
      reliability: 100,
    });
    expect(res.body.data[1].statistics).toMatchObject({ totalRaces: 2, wins: 0, reliability: 50, bestLap: 7000 });

    res = await api.get(`/api/stats/cars?trackId=${f.oval.id}`);
    expect(res.body.data[0].statistics).toMatchObject({ totalRaces: 1, totalLaps: 1, bestLap: null, reliability: 100 });
    res = await api.get(`/api/stats/cars?championshipId=${f.cup.id}`);
    expect(res.body.data[0].statistics).toMatchObject({ totalRaces: 1, wins: 1, totalLaps: 3 });
    expect(res.body.filters).toEqual({ championshipId: f.cup.id });
  });

  test('a car that never raced', async () => {
    await prisma.car.create({ data: { brand: 'Mini', model: 'Cooper' } });
    const res = await api.get('/api/stats/cars');
    expect(res.body.data.find((c) => c.model === 'Cooper').statistics).toEqual({
      totalRaces: 0,
      totalLaps: 0,
      wins: 0,
      bestLap: null,
      avgLapTime: null,
      reliability: 0,
    });
  });
});

describe('GET /api/stats/tracks', () => {
  test('sessions, laps, best lap and average session length; the busiest first', async () => {
    const res = await api.get('/api/stats/tracks');
    const byName = Object.fromEntries(res.body.data.map((t) => [t.name, t.statistics]));
    expect(res.body.data.map((t) => t.name)).toEqual(['Ring', 'Oval', 'Empty']);
    expect(byName.Ring).toEqual({
      totalSessions: 2,
      totalLaps: 4,
      bestLap: 7900,
      bestLapBy: null,
      avgSessionDuration: 5,
    });
    expect(byName.Oval).toMatchObject({ totalSessions: 2, totalLaps: 3, bestLap: 7000, avgSessionDuration: 0 });
    expect(byName.Empty).toMatchObject({ totalSessions: 0, totalLaps: 0, bestLap: 6000, avgSessionDuration: null });
  });
});

describe('GET /api/stats/leaderboard/drivers', () => {
  test("a session's entries with their laps, best and last lap", async () => {
    const res = await api.get(`/api/stats/leaderboard/drivers?sessionId=${f.r1.id}`);
    expect(res.body.data).toEqual([
      expect.objectContaining({ position: 1, laps: 2, bestLap: 8000, lastLap: 8200, gap: null }),
      expect.objectContaining({ position: 2, laps: 1, bestLap: 8100, lastLap: 8100 }),
    ]);
    expect(res.body.data[0].driver.name).toBe('Ana');
    expect(res.body.data[0].car.model).toBe('GT');
  });

  test('race order by laps then best lap; qualif order by best lap, those without one left out', async () => {
    let res = await api.get(`/api/stats/leaderboard/drivers?sessionId=${f.r2.id}&phase=${SessionType.RACE}`);
    expect(res.body.data.map((e) => [e.position, e.driver.name, e.laps])).toEqual([
      [1, 'Ana', 1],
      [2, 'Ben', 1],
    ]);
    res = await api.get(`/api/stats/leaderboard/drivers?sessionId=${f.q1.id}&phase=${SessionType.QUALIF}`);
    expect(res.body.data.map((e) => [e.position, e.driver.name, e.bestLap])).toEqual([[1, 'Ana', 7900]]);
    res = await api.get(`/api/stats/leaderboard/drivers?sessionId=${f.r1.id}&phase=${SessionType.QUALIF}`);
    expect(res.body.data).toEqual([]);
  });

  test('race order puts a driver without a lap last', async () => {
    const r3 = await prisma.session.create({ data: { type: SessionType.RACE, trackId: f.ring.id } });
    await prisma.sessionDriver.create({
      data: { sessionId: r3.id, driverId: f.cid.id, carId: f.gt.id, controller: 0 },
    });
    await prisma.sessionDriver.create({
      data: { sessionId: r3.id, driverId: f.ana.id, carId: f.gt.id, controller: 1 },
    });
    await prisma.sessionDriver.create({
      data: { sessionId: r3.id, driverId: f.ben.id, carId: f.gt.id, controller: 2 },
    });
    const lap = (driver, lapTime) =>
      prisma.lap.create({
        data: {
          sessionId: r3.id,
          trackId: f.ring.id,
          driverId: driver.id,
          carId: f.gt.id,
          controller: 0,
          phase: SessionType.RACE,
          lapNumber: ++lapNumber,
          lapTime,
        },
      });
    await lap(f.ana, 8200);
    await lap(f.ben, 8100);
    const res = await api.get(`/api/stats/leaderboard/drivers?sessionId=${r3.id}&phase=${SessionType.RACE}`);
    expect(res.body.data.map((e) => e.driver.name)).toEqual(['Ben', 'Ana', 'Cid']);
  });

  test('nothing for a championship; all-time wins, podiums and races otherwise', async () => {
    let res = await api.get(`/api/stats/leaderboard/drivers?championshipId=${f.cup.id}`);
    expect(res.body.data).toEqual([]);
    res = await api.get('/api/stats/leaderboard/drivers');
    expect(res.body.data.map((e) => [e.position, e.driver.name, e.wins, e.podiums, e.races])).toEqual([
      [1, 'Ana', 1, 2, 2],
      [2, 'Ben', 0, 1, 2],
      [3, 'Cid', 0, 0, 0],
    ]);
    expect(res.body.filters).toEqual({ limit: 10 });
    res = await api.get('/api/stats/leaderboard/drivers?limit=1');
    expect(res.body.data).toHaveLength(1);
  });
});

describe('GET /api/stats/leaderboard/teams', () => {
  test("points from the drivers' race places, the gap to the leader; per championship", async () => {
    let res = await api.get('/api/stats/leaderboard/teams');
    expect(res.body.data.map((e) => [e.position, e.team.name, e.points, e.wins, e.podiums, e.races, e.gap])).toEqual([
      [1, 'Red', 40, 1, 2, 2, null],
      [2, 'Blue', 0, 0, 0, 0, 40],
    ]);
    res = await api.get(`/api/stats/leaderboard/teams?championshipId=${f.cup.id}`);
    expect(res.body.data[0]).toMatchObject({ points: 25, races: 1 });
  });
});

describe('GET /api/stats/laptimes', () => {
  const ids = (res) => res.body.data.map((l) => l.id);

  test("each driver, car and track's best lap by default, fastest first", async () => {
    const res = await api.get('/api/stats/laptimes');
    expect(ids(res)).toEqual([f.laps.bp.id, f.laps.aq.id, f.laps.b1.id]);
    expect(res.body).toMatchObject({ total: 3, hasMore: false });
    expect(res.body.data[1]).toMatchObject({
      lapTime: 7900,
      sessionType: SessionType.QUALIF,
      driver: { name: 'Ana' },
      car: { model: 'GT' },
      track: { name: 'Ring' },
      championship: { name: 'Cup' },
      sessionId: f.q1.id,
    });
  });

  test('every lap, paginated, with the deleted ones apart', async () => {
    let res = await api.get('/api/stats/laptimes?unique=false&limit=2');
    expect(ids(res)).toEqual([f.laps.bp.id, f.laps.aq.id]);
    expect(res.body).toMatchObject({ total: 6, hasMore: true });
    res = await api.get('/api/stats/laptimes?unique=false&limit=2&offset=4');
    expect(res.body.hasMore).toBe(false);
    res = await api.get('/api/stats/laptimes?deleted=true');
    expect(ids(res)).toEqual([f.laps.ad.id]);
    res = await api.get('/api/stats/laptimes?limit=1&offset=1');
    expect(ids(res)).toEqual([f.laps.aq.id]);
    expect(res.body.hasMore).toBe(true);
  });

  test('filtered by driver, car, track, session type and championship (or none)', async () => {
    const get = async (query) => ids(await api.get(`/api/stats/laptimes?unique=false&${query}`));
    expect(await get(`driverId=${f.ana.id}`)).toEqual([f.laps.aq.id, f.laps.a1.id, f.laps.a2.id]);
    expect(await get(`driverId=${f.ana.id},${f.ben.id}`)).toHaveLength(6);
    expect(await get(`carId=${f.p911.id}`)).toEqual([f.laps.bp.id, f.laps.b1.id, f.laps.b2.id]);
    expect(await get(`carId=${f.p911.id},${f.gt.id}`)).toHaveLength(6);
    expect(await get(`trackId=${f.oval.id}`)).toEqual([f.laps.bp.id, f.laps.b2.id]);
    expect(await get(`trackId=${f.oval.id},${f.ring.id}`)).toHaveLength(6);
    expect(await get(`sessionType=${SessionType.QUALIF}`)).toEqual([f.laps.aq.id]);
    expect(await get(`sessionType=${SessionType.QUALIF},${SessionType.PRACTICE}`)).toEqual([
      f.laps.bp.id,
      f.laps.aq.id,
    ]);
    expect(await get(`championshipId=${f.cup.id}`)).toHaveLength(4);
    expect(await get(`championshipId=none`)).toEqual([f.laps.bp.id, f.laps.b2.id]);
    expect(await get(`championshipId=none,${f.cup.id}`)).toHaveLength(6);
    expect(await get(`championshipId=${f.cup.id},other`)).toHaveLength(4);
    expect(await get('has_championship=true')).toHaveLength(4);
  });

  test.each([
    ['lapTime', 'desc', ['b1', 'aq', 'bp']],
    ['timestamp', 'asc', ['aq', 'b1', 'bp']],
    ['driver', 'asc', ['aq', 'b1', 'bp']],
    ['car', 'desc', ['b1', 'bp', 'aq']],
    ['track', 'asc', ['bp', 'aq', 'b1']],
    ['sessionType', 'asc', ['bp', 'aq', 'b1']],
    ['championship', 'desc', ['aq', 'b1', 'bp']],
    ['date', 'asc', ['aq', 'b1', 'bp']],
    ['nonsense', 'desc', ['b1', 'aq', 'bp']],
  ])('best laps sorted by %s %s', async (sortBy, sortOrder, expected) => {
    const res = await api.get(`/api/stats/laptimes?sortBy=${sortBy}&sortOrder=${sortOrder}`);
    const names = Object.fromEntries(Object.entries(f.laps).map(([name, lap]) => [lap.id, name]));
    expect(ids(res).map((id) => names[id])).toEqual(expected);
  });

  test('every lap sorted by the database', async () => {
    const res = await api.get('/api/stats/laptimes?unique=false&sortBy=driver&sortOrder=desc&limit=3');
    expect(res.body.data.map((l) => l.driver.name)).toEqual(['Ben', 'Ben', 'Ben']);
  });

  test('a bad page size answers 500', async () => {
    const res = await api.get('/api/stats/laptimes?unique=false&limit=abc');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ success: false, error: 'Failed to fetch lap times' });
  });
});

describe('GET /api/stats/records', () => {
  test('fastest lap, most wins, podiums and poles; in championships only', async () => {
    let res = await api.get('/api/stats/records');
    expect(res.body.data).toMatchObject({
      fastestLap: { time: 7000, driver: { name: 'Ben' }, car: { model: '911' }, track: { name: 'Oval' } },
      mostWins: { driver: { name: 'Ana' }, count: 1 },
      mostPodiums: { driver: { name: 'Ana' }, count: 2 },
      mostPolePositions: { driver: { name: 'Ana' }, count: 1 },
    });
    res = await api.get('/api/stats/records?has_championship=true');
    expect(res.body.data).toMatchObject({
      fastestLap: { time: 7900, driver: { name: 'Ana' } },
      mostPodiums: { count: 1 },
    });
  });

  test('none before any race', async () => {
    await wipe();
    const res = await api.get('/api/stats/records');
    expect(res.body.data).toEqual({ fastestLap: null, mostWins: null, mostPodiums: null, mostPolePositions: null });
  });
});

describe('laps: delete and restore', () => {
  test('a first delete hides the lap, a second erases it; a restore brings it back', async () => {
    const id = f.laps.a1.id;
    expect((await api.delete(`/api/stats/laps/${id}`)).body).toEqual({ success: true, message: 'Lap deleted' });
    expect((await prisma.lap.findUnique({ where: { id } })).deletedAt).not.toBeNull();
    expect((await api.patch(`/api/stats/laps/${id}/restore`)).body).toEqual({ success: true, message: 'Lap restored' });
    expect((await prisma.lap.findUnique({ where: { id } })).deletedAt).toBeNull();
    await api.delete(`/api/stats/laps/${id}`);
    await api.delete(`/api/stats/laps/${id}`);
    expect(await prisma.lap.findUnique({ where: { id } })).toBeNull();
    expect((await api.delete(`/api/stats/laps/${id}`)).status).toBe(404);
    expect((await api.patch(`/api/stats/laps/${id}/restore`)).status).toBe(404);
  });
});
