import { jest } from '@jest/globals';
import { SessionType } from '@racehubos/shared';
import { prisma } from './setup.js';
import { apiFor, recorder, wipe } from './helpers/entityFixtures.js';

// The router shares the test client, so a test can make one of its queries fail
jest.unstable_mockModule('../lib/prisma.js', () => ({ createPrismaClient: () => prisma }));
const { default: recordsRouter } = await import('../routes/records.js');

const api = apiFor('/api/records', recordsRouter);
const { session, entry, lap } = recorder(prisma);

let ring, oval, cup, ana, ben, gt, p911;

/**
 * On Ring: a free practice, a qualif in the Cup, two free races and two balancing sessions (the
 * second created first); a practice lap on Oval and a deleted lap must stay out.
 */
beforeEach(async () => {
  await wipe(prisma);
  jest.spyOn(console, 'error').mockImplementation(() => {});
  ring = await prisma.track.create({ data: { name: 'Ring', img: 'ring.png' } });
  oval = await prisma.track.create({ data: { name: 'Oval' } });
  cup = await prisma.championship.create({ data: { name: 'Cup', season: '2026', trackId: ring.id } });
  ana = await prisma.driver.create({ data: { name: 'Ana', img: 'ana.png' } });
  ben = await prisma.driver.create({ data: { name: 'Ben' } });
  gt = await prisma.car.create({ data: { brand: 'Ford', model: 'GT', img: 'gt.png' } });
  p911 = await prisma.car.create({ data: { brand: 'Porsche', model: '911' } });

  const practice = await session(ring, { type: SessionType.PRACTICE, name: 'P' });
  await lap(practice, ana, gt, 8000);
  await lap(practice, ana, gt, 7900);
  await lap(practice, ben, gt, 8100);
  await lap(practice, ana, gt, 7000, { deletedAt: new Date() });
  await lap(await session(oval, { type: SessionType.PRACTICE }), ana, gt, 6000);

  const qualif = await session(ring, { type: SessionType.QUALIF, championshipId: cup.id });
  await lap(qualif, ana, p911, 8200);

  const r1 = await session(ring, { name: 'R1' });
  const r2 = await session(ring, { name: 'R2' });
  await lap(r1, ana, gt, 8300);
  await lap(r1, ben, p911, 8600);
  await lap(r2, ana, gt, 8250);
  await entry(r1, ana, gt, { totalTime: 50000, totalLaps: 5 });
  await entry(r1, ben, p911, { controller: 1, totalTime: 52000, totalLaps: 5 });
  await entry(r2, ana, gt, { totalTime: 60000, totalLaps: 6 });
  await entry(r2, ben, p911, { controller: 1, totalTime: 0, totalLaps: 0 });

  const balancing = (createdAt) => session(ring, { type: SessionType.BALANCING, createdAt: new Date(createdAt) });
  const b2 = await balancing('2026-01-02T10:00:00Z');
  const b1 = await balancing('2026-01-01T10:00:00Z');
  const laps = async (s, car, times) => {
    for (const [index, time] of times.entries()) await lap(s, null, car, time, { lapNumber: index + 1 });
  };
  await laps(b1, gt, [9000, 8000, 8100, 8200]);
  await laps(b2, gt, [9100, 7900, 8050, 8250, 8300]);
  await laps(b2, p911, [8800]);
});
afterEach(() => jest.restoreAllMocks());

describe('GET /api/records/track/:trackId', () => {
  test('the best lap of each driver and car per session type, with lap counts and image URLs', async () => {
    const { data } = (await api.get(`/api/records/track/${ring.id}`)).body;
    expect(data.track).toMatchObject({ name: 'Ring', img: '/api/img/ring.png' });
    expect(data.practice.map((l) => [l.driver.name, l.lapTime, l.laps])).toEqual([
      ['Ana', 7900, 2],
      ['Ben', 8100, 1],
    ]);
    expect(data.practice[0]).toMatchObject({
      driver: { img: '/api/img/ana.png' },
      car: { img: '/api/img/gt.png' },
      session: { type: SessionType.PRACTICE, name: 'P' },
    });
    expect(data.practice[0].totalTime).toBeUndefined();
    expect(data.qualif.map((l) => [l.driver.name, l.car.model, l.lapTime])).toEqual([['Ana', '911', 8200]]);
  });

  test("races add each pairing's longest total time from the sessions of its best laps", async () => {
    const { race } = (await api.get(`/api/records/track/${ring.id}`)).body.data;
    expect(race.map((l) => [l.driver.name, l.lapTime, l.laps, l.totalTime, l.totalLaps])).toEqual([
      ['Ana', 8250, 2, 60000, 6],
      ['Ben', 8600, 1, 52000, 5],
    ]);
  });

  test('balancing keeps the best lap per car, with medians and best-60% averages per session, oldest first', async () => {
    const { balancing } = (await api.get(`/api/records/track/${ring.id}`)).body.data;
    expect(balancing.map((l) => [l.car.model, l.lapTime, l.laps])).toEqual([
      ['GT', 7900, 9],
      ['911', 8800, 1],
    ]);
    expect(balancing[0]).toMatchObject({ median: 8100, avg60: 8050, car: { img: '/api/img/gt.png' } });
    expect(balancing[0].history).toEqual([
      { median: 8100, avg60: null, laps: 3 },
      { median: 8150, avg60: (7900 + 8050 + 8250) / 3, laps: 4 },
    ]);
    expect(balancing[1]).toMatchObject({ median: null, avg60: null, history: [] });
  });

  test('filtered to free sessions or one championship', async () => {
    let { data } = (await api.get(`/api/records/track/${ring.id}?championshipId=null`)).body;
    expect(data.qualif).toEqual([]);
    expect(data.practice).toHaveLength(2);

    ({ data } = (await api.get(`/api/records/track/${ring.id}?championshipId=${cup.id}`)).body);
    expect(data.qualif).toHaveLength(1);
    expect([data.practice, data.race, data.balancing]).toEqual([[], [], []]);
  });

  test('an unknown track has no track and no laps; a failure answers 500 with its message', async () => {
    expect((await api.get('/api/records/track/nope')).body.data).toEqual({
      track: null,
      practice: [],
      qualif: [],
      race: [],
      balancing: [],
    });
    jest.spyOn(prisma.lap, 'findMany').mockRejectedValueOnce(new Error('db down'));
    const res = await api.get(`/api/records/track/${ring.id}`);
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ success: false, error: 'db down' });
  });
});

describe('track records by driver, by car, overall', () => {
  let fast;
  beforeEach(async () => {
    fast = await prisma.trackRecord.create({
      data: { trackId: ring.id, driverId: ana.id, carId: gt.id, lapTime: 7900 },
    });
    await prisma.trackRecord.create({ data: { trackId: oval.id, driverId: ana.id, carId: p911.id, lapTime: 8500 } });
    await prisma.trackRecord.create({ data: { trackId: ring.id, driverId: ben.id, carId: gt.id, lapTime: 8100 } });
  });

  test("a driver's records, fastest first, with track and car", async () => {
    const { data } = (await api.get(`/api/records/driver/${ana.id}`)).body;
    expect(data).toMatchObject({ driver: { name: 'Ana' }, count: 2 });
    expect(data.records.map((r) => [r.lapTime, r.track.name, r.car.model, r.session])).toEqual([
      [7900, 'Ring', 'GT', null],
      [8500, 'Oval', '911', null],
    ]);
    expect((await api.get('/api/records/driver/nope')).body.data).toEqual({ driver: null, records: [], count: 0 });
  });

  test("a car's records, fastest first, with track and driver", async () => {
    const { data } = (await api.get(`/api/records/car/${gt.id}`)).body;
    expect(data).toMatchObject({ car: { model: 'GT' }, count: 2 });
    expect(data.records.map((r) => [r.lapTime, r.driver.name])).toEqual([
      [7900, 'Ana'],
      [8100, 'Ben'],
    ]);
  });

  test('the leaderboard, limited', async () => {
    let res = await api.get('/api/records/leaderboard');
    expect(res.body.data.map((r) => [r.lapTime, r.track.name, r.driver.name, r.car.model])).toEqual([
      [7900, 'Ring', 'Ana', 'GT'],
      [8100, 'Ring', 'Ben', 'GT'],
      [8500, 'Oval', 'Ana', '911'],
    ]);
    res = await api.get('/api/records/leaderboard?limit=1');
    expect(res.body.data).toHaveLength(1);
  });

  test('a record deleted; an unknown one answers 500', async () => {
    expect((await api.delete(`/api/records/${fast.id}`)).body).toEqual({ success: true, message: 'Record deleted' });
    expect(await prisma.trackRecord.count()).toBe(2);
    const res = await api.delete('/api/records/nope');
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });

  test('failures answer 500 with their message', async () => {
    jest.spyOn(prisma.trackRecord, 'findMany').mockRejectedValue(new Error('db down'));
    for (const path of [`driver/${ana.id}`, `car/${gt.id}`, 'leaderboard']) {
      const res = await api.get(`/api/records/${path}`);
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('db down');
    }
  });
});
