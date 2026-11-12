import { jest } from '@jest/globals';
import { SessionType } from '@racehubos/shared';
import { prisma } from './setup.js';
import { apiFor, recorder, wipe } from './helpers/entityFixtures.js';

// The router shares the test client, so a test can make one of its queries fail
jest.unstable_mockModule('../lib/prisma.js', () => ({ createPrismaClient: () => prisma }));
const { default: driversRouter } = await import('../routes/drivers.js');

const api = apiFor('/api/drivers', driversRouter);
const { session, entry, lap } = recorder(prisma);

let red, ana, ben, cid, dan, gt, p911, ring, oval, s1, s2;

/**
 * Ana (team Red, best 8000) races s1 on Ring and s2 on Oval, Ben (no team, no best) only s1, Cid
 * (team Blue, best 7000) nothing; Dan is deleted.
 */
beforeEach(async () => {
  await wipe(prisma);
  jest.spyOn(console, 'error').mockImplementation(() => {});
  red = await prisma.team.create({ data: { name: 'Red', img: '/uploads/red.png' } });
  const blue = await prisma.team.create({ data: { name: 'Blue' } });
  ana = await prisma.driver.create({ data: { name: 'Ana', teamId: red.id, bestLap: 8000, img: 'ana.png', number: 7 } });
  ben = await prisma.driver.create({ data: { name: 'Ben', email: 'ben@example.com' } });
  cid = await prisma.driver.create({ data: { name: 'Cid', teamId: blue.id, bestLap: 7000 } });
  dan = await prisma.driver.create({ data: { name: 'Dan', deletedAt: new Date() } });
  gt = await prisma.car.create({ data: { brand: 'Ford', model: 'GT' } });
  p911 = await prisma.car.create({ data: { brand: 'Porsche', model: '911' } });
  ring = await prisma.track.create({ data: { name: 'Ring' } });
  oval = await prisma.track.create({ data: { name: 'Oval' } });
  s1 = await session(ring, { createdAt: new Date('2026-01-01T10:00:00Z') });
  s2 = await session(oval, { createdAt: new Date('2026-01-02T10:00:00Z') });
  await entry(s1, ana, gt, { finalPos: 1 });
  await entry(s1, ben, p911, { controller: 1, finalPos: 2 });
  await entry(s2, ana, gt, { finalPos: 4 });
  await lap(s1, ana, gt, 8100);
  await lap(s1, ana, gt, 8200, { deletedAt: new Date() });
  await lap(s2, ana, gt, 8500);
  await lap(s1, ben, p911, 9000);
});
afterEach(() => jest.restoreAllMocks());

const names = async (query) => (await api.get(`/api/drivers?${query}`)).body.data.map((d) => d.name);

describe('GET /api/drivers', () => {
  test('drivers not deleted by name, with team, counts, image URLs and extras', async () => {
    const res = await api.get('/api/drivers');
    expect(res.body).toMatchObject({ success: true, total: 3, hasMore: false });
    expect(res.body.data.map((d) => d.name)).toEqual(['Ana', 'Ben', 'Cid']);
    expect(res.body.data[0]).toMatchObject({
      img: '/api/img/ana.png',
      team: { name: 'Red', img: '/api/img/red.png' },
      _count: { laps: 2, sessions: 2 },
      extras: {},
    });
    expect(await names('deleted=true')).toEqual(['Dan']);
  });

  test('sorted by a column, a count, the team name or the best lap, then paginated', async () => {
    expect(await names('sortBy=sessions&sortOrder=desc')).toEqual(['Ana', 'Ben', 'Cid']);
    expect(await names('sortBy=laps&sortOrder=asc')).toEqual(['Cid', 'Ben', 'Ana']);
    expect(await names('sortBy=team&sortOrder=asc')).toEqual(['Ben', 'Cid', 'Ana']);
    expect(await names('sortBy=team&sortOrder=desc')).toEqual(['Ana', 'Cid', 'Ben']);
    expect(await names('sortBy=bestLap&sortOrder=asc')).toEqual(['Cid', 'Ana', 'Ben']);
    expect(await names('sortBy=bestLap&sortOrder=desc')).toEqual(['Ben', 'Ana', 'Cid']);
    expect(await names('sortBy=bestLap&limit=1&offset=1')).toEqual(['Ana']);

    const res = await api.get('/api/drivers?sortBy=name&sortOrder=desc&limit=2');
    expect(res.body.data.map((d) => d.name)).toEqual(['Cid', 'Ben']);
    expect(res.body).toMatchObject({ total: 3, hasMore: true });
  });

  test('a bad sort answers 500, even one named like an object method', async () => {
    for (const sortBy of ['nope', 'toString']) {
      const res = await api.get(`/api/drivers?sortBy=${sortBy}`);
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ success: false, error: 'Failed to fetch drivers' });
    }
  });
});

describe('reference driver', () => {
  test('none at first, then set, cleared, and refused for an unknown driver', async () => {
    expect((await api.get('/api/drivers/reference')).body).toEqual({ success: true, data: null });

    let res = await api.put('/api/drivers/reference').send({ driverId: ana.id });
    expect(res.body.data).toMatchObject({ id: ana.id, img: '/api/img/ana.png' });
    expect((await api.get('/api/drivers/reference')).body.data.id).toBe(ana.id);

    res = await api.put('/api/drivers/reference').send({});
    expect(res.body.data).toBeNull();

    res = await api.put('/api/drivers/reference').send({ driverId: 'nope' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Driver not found');
  });

  test('the STIG is created as reference, once', async () => {
    const res = await api.post('/api/drivers/reference/stig');
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ name: 'Le STIG', isReference: true });
  });

  test('past balancing laps move onto the reference driver', async () => {
    let res = await api.post('/api/drivers/reference/migrate-balancing');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('No reference driver configured');

    const balancing = await session(ring, { type: SessionType.BALANCING });
    await entry(balancing, null, gt);
    await lap(balancing, null, gt, 8000);
    await prisma.driver.update({ where: { id: cid.id }, data: { isReference: true } });

    res = await api.post('/api/drivers/reference/migrate-balancing');
    expect(res.body.data).toMatchObject({ driver: { id: cid.id }, laps: 1, sessionDrivers: 1 });
  });

  test('a database failure answers 500 with its message, 400 when creating the STIG', async () => {
    jest.spyOn(prisma.driver, 'findFirst').mockRejectedValue(new Error('db down'));
    for (const res of [
      await api.get('/api/drivers/reference'),
      await api.post('/api/drivers/reference/migrate-balancing'),
    ]) {
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('db down');
    }
    const res = await api.post('/api/drivers/reference/stig');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('db down');
  });
});

describe('exports', () => {
  test('a workbook for one or several drivers, 404 for none', async () => {
    expect((await api.get(`/api/drivers/${ana.id}/export`)).status).toBe(200);
    expect((await api.get(`/api/drivers/export?ids=${ana.id},${ben.id}`)).status).toBe(200);
    expect((await api.get('/api/drivers/nope/export')).status).toBe(404);
    expect((await api.get('/api/drivers/export')).status).toBe(404);
  });

  test('a database failure answers 500 with its message', async () => {
    jest.spyOn(prisma.driver, 'findMany').mockRejectedValue(new Error('db down'));
    expect((await api.get(`/api/drivers/${ana.id}/export`)).body).toEqual({ success: false, error: 'db down' });
    expect((await api.get(`/api/drivers/export?ids=${ana.id}`)).status).toBe(500);
  });
});

describe('GET /api/drivers/:id', () => {
  test('with team, latest sessions first, counts and the best lap per car and track', async () => {
    const res = await api.get(`/api/drivers/${ana.id}`);
    expect(res.body.data).toMatchObject({
      name: 'Ana',
      img: '/api/img/ana.png',
      team: { name: 'Red' },
      _count: { sessions: 2, laps: 3 },
      extras: {},
    });
    expect(res.body.data.sessions.map((s) => s.session.track.name)).toEqual(['Oval', 'Ring']);
    expect(res.body.data.records).toEqual([
      expect.objectContaining({ lapTime: 8100, car: expect.objectContaining({ model: 'GT' }), sessionType: 'race' }),
      expect.objectContaining({ lapTime: 8500, track: { id: oval.id, name: 'Oval', color: '#9333ea' } }),
    ]);
    expect((await api.get('/api/drivers/nope')).status).toBe(404);
  });
});

describe('POST /api/drivers', () => {
  test('a trimmed driver with defaults, 400 without a name', async () => {
    const res = await api.post('/api/drivers').send({ name: '  Eve ', email: ' eve@example.com ', teamId: red.id });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      name: 'Eve',
      email: 'eve@example.com',
      number: null,
      img: null,
      color: '#3B82F6',
      team: { name: 'Red' },
    });
    for (const body of [{}, { name: '   ' }]) {
      expect((await api.post('/api/drivers').send(body)).body).toEqual({ success: false, error: 'Name is required' });
    }
  });

  test('a number or an email already taken answers 400', async () => {
    let res = await api.post('/api/drivers').send({ name: 'Eve', number: 7 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Number already exists');
    res = await api.post('/api/drivers').send({ name: 'Eve', email: 'ben@example.com' });
    expect(res.body.error).toBe('Email already exists');
  });

  test('another failure answers 500', async () => {
    const res = await api.post('/api/drivers').send({ name: 'Eve', teamId: 'nope' });
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Failed to create driver');
  });
});

describe('PUT /api/drivers/:id', () => {
  test('updates the fields given; empty number, email and team become null', async () => {
    let res = await api
      .put(`/api/drivers/${ana.id}`)
      .send({ name: ' Anna ', number: '', email: '  ', teamId: '', img: 'new.png', color: '#000000' });
    expect(res.body.data).toMatchObject({
      name: 'Anna',
      number: null,
      email: null,
      teamId: null,
      img: '/api/img/new.png',
      color: '#000000',
    });
    res = await api.put(`/api/drivers/${ben.id}`).send({ number: 9, email: 'b@example.com', teamId: red.id });
    expect(res.body.data).toMatchObject({ name: 'Ben', number: 9, email: 'b@example.com', team: { name: 'Red' } });
  });

  test('a preferred car is set, cleared, refused when unknown or deleted; erasing the car forgets it', async () => {
    const created = await api.post('/api/drivers').send({ name: 'Eve', preferredCarId: gt.id });
    expect(created.status).toBe(201);
    expect(created.body.data.preferredCarId).toBe(gt.id);

    expect((await api.put(`/api/drivers/${ana.id}`).send({ preferredCarId: p911.id })).body.data.preferredCarId).toBe(
      p911.id
    );
    const bin = await prisma.car.create({ data: { brand: 'Old', model: 'Bin', deletedAt: new Date() } });
    for (const preferredCarId of ['nope', bin.id]) {
      const res = await api.put(`/api/drivers/${ana.id}`).send({ preferredCarId });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Preferred car not found');
    }
    expect((await api.post('/api/drivers').send({ name: 'Fay', preferredCarId: 'nope' })).status).toBe(400);

    await prisma.lap.deleteMany({ where: { carId: p911.id } });
    await prisma.sessionDriver.deleteMany({ where: { carId: p911.id } });
    await prisma.car.delete({ where: { id: p911.id } });
    expect((await prisma.driver.findUnique({ where: { id: ana.id } })).preferredCarId).toBeNull();
    expect(
      (await api.put(`/api/drivers/${created.body.data.id}`).send({ preferredCarId: '' })).body.data
    ).toMatchObject({
      preferredCarId: null,
    });
  });

  test('404 when missing, 400 on a taken number, 500 otherwise', async () => {
    expect((await api.put('/api/drivers/nope').send({ name: 'X' })).status).toBe(404);
    let res = await api.put(`/api/drivers/${ben.id}`).send({ number: 7 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Number already exists');
    res = await api.put(`/api/drivers/${ben.id}`).send({ teamId: 'nope' });
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Failed to update driver');
  });
});

describe('DELETE and restore', () => {
  test('a first delete hides the driver and its laps, a restore brings them back', async () => {
    let res = await api.delete(`/api/drivers/${ana.id}`);
    expect(res.body).toEqual({ success: true, message: 'Driver deleted successfully' });
    expect((await prisma.driver.findUnique({ where: { id: ana.id } })).deletedAt).not.toBeNull();
    expect(await prisma.lap.count({ where: { driverId: ana.id, deletedAt: null } })).toBe(0);

    res = await api.patch(`/api/drivers/${ana.id}/restore`);
    expect(res.body).toEqual({ success: true, message: 'Driver restored' });
    expect(await prisma.lap.count({ where: { driverId: ana.id, deletedAt: null } })).toBe(2);
  });

  test('a second delete erases a driver with everything recorded under them', async () => {
    const championship = await prisma.championship.create({ data: { name: 'Cup', season: '2026' } });
    await prisma.championshipParticipant.create({ data: { championshipId: championship.id, driverId: ana.id } });
    await prisma.trackRecord.create({ data: { trackId: ring.id, driverId: ana.id, carId: gt.id, lapTime: 8100 } });
    await prisma.controllerConfig.create({ data: { trackId: ring.id, controller: 0, driverId: ana.id, carId: gt.id } });
    await api.delete(`/api/drivers/${ana.id}`);

    const res = await api.delete(`/api/drivers/${ana.id}`);
    expect(res.body).toEqual({ success: true, message: 'Driver deleted successfully' });
    expect(await prisma.driver.findUnique({ where: { id: ana.id } })).toBeNull();
    expect(await prisma.lap.count({ where: { driverId: ana.id } })).toBe(0);
    expect(await prisma.sessionDriver.count({ where: { driverId: ana.id } })).toBe(0);
    expect(await prisma.trackRecord.count()).toBe(0);
    expect(await prisma.championshipParticipant.count()).toBe(0);
    expect(await prisma.controllerConfig.count()).toBe(0);
    // Ben's lap and entry stay
    expect(await prisma.lap.count()).toBe(1);
    expect(await prisma.sessionDriver.count()).toBe(1);
  });

  test('a second delete erases a driver without records; 404 when missing; 500 on failure', async () => {
    await api.delete(`/api/drivers/${dan.id}`);
    expect(await prisma.driver.findUnique({ where: { id: dan.id } })).toBeNull();
    expect((await api.delete('/api/drivers/nope')).status).toBe(404);
    expect((await api.patch('/api/drivers/nope/restore')).status).toBe(404);

    jest.spyOn(prisma.driver, 'findUnique').mockRejectedValue(new Error('db down'));
    expect((await api.delete(`/api/drivers/${ana.id}`)).body.error).toBe('Failed to delete driver');
    expect((await api.patch(`/api/drivers/${ana.id}/restore`)).body.error).toBe('Failed to restore driver');
  });
});

describe('GET /api/drivers/:id/stats', () => {
  test('sessions, laps, wins, podiums, best and average lap, rates', async () => {
    const res = await api.get(`/api/drivers/${ana.id}/stats`);
    expect(res.body.data).toEqual({
      driver: { id: ana.id, name: 'Ana' },
      stats: {
        totalSessions: 2,
        totalLaps: 3,
        wins: 1,
        podiums: 1,
        bestLapTime: 8000,
        avgLapTime: 8266.666666666666,
        winRate: 50,
        podiumRate: 50,
      },
    });
    const none = (await api.get(`/api/drivers/${cid.id}/stats`)).body.data.stats;
    expect(none).toMatchObject({ totalSessions: 0, avgLapTime: null, winRate: 0, podiumRate: 0 });
    expect((await api.get('/api/drivers/nope/stats')).status).toBe(404);
  });
});

describe('POST /api/drivers/:id/reset-stats', () => {
  test('erases laps, entries and records, and zeroes the totals', async () => {
    await prisma.trackRecord.create({ data: { trackId: ring.id, driverId: ana.id, carId: gt.id, lapTime: 8100 } });
    await prisma.driver.update({ where: { id: ana.id }, data: { totalRaces: 2, wins: 1, podiums: 1 } });

    const res = await api.post(`/api/drivers/${ana.id}/reset-stats`);
    expect(res.body).toMatchObject({
      success: true,
      message: 'Statistics reset successfully',
      data: { totalRaces: 0, wins: 0, podiums: 0, bestLap: null, _count: { sessions: 0, laps: 0 }, team: {} },
    });
    expect(await prisma.trackRecord.count({ where: { driverId: ana.id } })).toBe(0);
    expect(await prisma.lap.count({ where: { driverId: ben.id } })).toBe(1);
    expect((await api.post('/api/drivers/nope/reset-stats')).status).toBe(404);
  });
});

describe('failures answer 500 with a fixed message', () => {
  test.each([
    ['get', `/api/drivers/x`, 'Failed to fetch driver'],
    ['get', `/api/drivers/x/stats`, 'Failed to fetch driver statistics'],
    ['post', `/api/drivers/x/reset-stats`, 'Failed to reset driver statistics'],
  ])('%s %s', async (method, path, error) => {
    jest.spyOn(prisma.driver, 'findUnique').mockRejectedValueOnce(new Error('db down'));
    const res = await api[method](path);
    expect(res.status).toBe(500);
    expect(res.body.error).toBe(error);
  });
});
