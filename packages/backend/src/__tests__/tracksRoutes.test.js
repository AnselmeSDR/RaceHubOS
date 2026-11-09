import { jest } from '@jest/globals';
import { prisma } from './setup.js';
import { apiFor, recorder, wipe } from './helpers/entityFixtures.js';

// The router shares the test client, so a test can make one of its queries fail
jest.unstable_mockModule('../lib/prisma.js', () => ({ createPrismaClient: () => prisma }));
const { default: tracksRouter } = await import('../routes/tracks.js');

const api = apiFor('/api/tracks', tracksRouter);
const { session, entry, lap } = recorder(prisma);

let ring, oval, bay, old, ana, ben, gt, p911, s1, s2;

/** Ring (best 7000) holds s1 and s2, Oval (no best) s3, Bay (best 8000) nothing; Old is deleted. */
beforeEach(async () => {
  await wipe(prisma);
  jest.spyOn(console, 'error').mockImplementation(() => {});
  ring = await prisma.track.create({ data: { name: 'Ring', bestLap: 7000, bestLapBy: 'Ana', img: 'ring.png' } });
  oval = await prisma.track.create({ data: { name: 'Oval' } });
  bay = await prisma.track.create({ data: { name: 'Bay', bestLap: 8000 } });
  old = await prisma.track.create({ data: { name: 'Old', deletedAt: new Date() } });
  ana = await prisma.driver.create({ data: { name: 'Ana' } });
  ben = await prisma.driver.create({ data: { name: 'Ben' } });
  gt = await prisma.car.create({ data: { brand: 'Ford', model: 'GT' } });
  p911 = await prisma.car.create({ data: { brand: 'Porsche', model: '911' } });
  s1 = await session(ring, { name: 'S1', createdAt: new Date('2026-01-01T10:00:00Z') });
  s2 = await session(ring, { name: 'S2', createdAt: new Date('2026-01-02T10:00:00Z') });
  const s3 = await session(oval, { name: 'S3' });
  await session(oval, { name: 'Gone', deletedAt: new Date() });
  await entry(s1, ana, gt);
  await entry(s1, ben, p911, { controller: 1 });
  await entry(s3, ana, gt);
  await lap(s1, ana, gt, 8100);
  await lap(s1, ana, gt, 8200, { deletedAt: new Date() });
  await lap(s2, ana, p911, 8700);
  await lap(s1, ben, p911, 9000);
  await lap(s3, ana, gt, 6000);
});
afterEach(() => jest.restoreAllMocks());

const names = async (query) => (await api.get(`/api/tracks?${query}`)).body.data.map((t) => t.name);

describe('GET /api/tracks', () => {
  test('tracks not deleted by name, with session counts, image URLs and extras', async () => {
    const res = await api.get('/api/tracks');
    expect(res.body).toMatchObject({ success: true, total: 3, hasMore: false });
    expect(res.body.data.map((t) => t.name)).toEqual(['Bay', 'Oval', 'Ring']);
    expect(res.body.data[1]._count.sessions).toBe(1);
    expect(res.body.data[2]).toMatchObject({ img: '/api/img/ring.png', _count: { sessions: 2 }, extras: {} });
    expect(await names('deleted=true')).toEqual(['Old']);
  });

  test('sorted by a column, the session count or the best lap, then paginated', async () => {
    expect(await names('sortBy=sessions&sortOrder=desc')).toEqual(['Ring', 'Oval', 'Bay']);
    expect(await names('sortBy=bestLap&sortOrder=asc')).toEqual(['Ring', 'Bay', 'Oval']);
    expect(await names('sortBy=bestLap&sortOrder=desc')).toEqual(['Oval', 'Bay', 'Ring']);
    expect(await names('sortBy=bestLap&limit=1&offset=1')).toEqual(['Bay']);
    const res = await api.get('/api/tracks?sortOrder=desc&limit=2');
    expect(res.body.data.map((t) => t.name)).toEqual(['Ring', 'Oval']);
    expect(res.body).toMatchObject({ total: 3, hasMore: true });
  });

  test('a bad sort answers 500', async () => {
    const res = await api.get('/api/tracks?sortBy=nope');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ success: false, error: 'Failed to fetch tracks' });
  });
});

describe('GET /api/tracks/:id', () => {
  test('latest sessions first with their entry count, and the best lap per driver and car', async () => {
    const res = await api.get(`/api/tracks/${ring.id}`);
    expect(res.body.data).toMatchObject({
      name: 'Ring',
      img: '/api/img/ring.png',
      _count: { sessions: 2 },
      extras: {},
    });
    expect(res.body.data.sessions.map((s) => [s.name, s._count.drivers])).toEqual([
      ['S2', 0],
      ['S1', 2],
    ]);
    expect(res.body.data.records.map((r) => [r.lapTime, r.driver.name, r.car.model, r.sessionType])).toEqual([
      [8100, 'Ana', 'GT', 'race'],
      [8700, 'Ana', '911', 'race'],
      [9000, 'Ben', '911', 'race'],
    ]);
    expect(Object.keys(res.body.data.records[0].car)).toEqual(['id', 'brand', 'model', 'color', 'img']);
    expect((await api.get('/api/tracks/nope')).status).toBe(404);
  });
});

describe('POST /api/tracks', () => {
  test('a trimmed track with defaults; 400 without a name; 500 on failure', async () => {
    let res = await api.post('/api/tracks').send({ name: ' Hill ' });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      name: 'Hill',
      img: null,
      layout: null,
      length: null,
      corners: null,
      color: '#9333ea',
    });
    res = await api.post('/api/tracks').send({ name: 'Bend', img: 'b.png', layout: 'L', length: 12.5, corners: 6 });
    expect(res.body.data).toMatchObject({ img: '/api/img/b.png', layout: 'L', length: 12.5, corners: 6 });

    expect((await api.post('/api/tracks').send({ name: ' ' })).body).toEqual({
      success: false,
      error: 'Name is required',
    });
    jest.spyOn(prisma.track, 'create').mockRejectedValueOnce(new Error('db down'));
    res = await api.post('/api/tracks').send({ name: 'X' });
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Failed to create track');
  });
});

describe('PUT /api/tracks/:id', () => {
  test('updates the fields given; 404 when missing; 500 on failure', async () => {
    const res = await api.put(`/api/tracks/${oval.id}`).send({
      name: ' Oval 2 ',
      img: 'o.png',
      layout: 'O',
      length: 10,
      corners: 4,
      color: '#000000',
      bestLap: 5000,
      bestLapBy: 'Ben',
    });
    expect(res.body.data).toMatchObject({
      name: 'Oval 2',
      img: '/api/img/o.png',
      layout: 'O',
      length: 10,
      corners: 4,
      color: '#000000',
      bestLap: 5000,
      bestLapBy: 'Ben',
    });
    expect((await api.put(`/api/tracks/${ring.id}`).send({})).body.data).toMatchObject({ name: 'Ring', bestLap: 7000 });

    expect((await api.put('/api/tracks/nope').send({ name: 'X' })).status).toBe(404);
    jest.spyOn(prisma.track, 'update').mockRejectedValueOnce(new Error('db down'));
    expect((await api.put(`/api/tracks/${ring.id}`).send({ name: 'X' })).body.error).toBe('Failed to update track');
  });
});

describe('DELETE and restore', () => {
  test('a first delete hides the track and its sessions, a restore brings them back', async () => {
    let res = await api.delete(`/api/tracks/${ring.id}`);
    expect(res.body).toEqual({ success: true, message: 'Track deleted successfully' });
    expect(await prisma.session.count({ where: { trackId: ring.id, deletedAt: null } })).toBe(0);

    res = await api.patch(`/api/tracks/${ring.id}/restore`);
    expect(res.body).toEqual({ success: true, message: 'Track restored' });
    expect(await prisma.session.count({ where: { trackId: ring.id, deletedAt: null } })).toBe(2);
  });

  test('a second delete erases a track without records; 404 when missing; 500 on failure', async () => {
    await api.delete(`/api/tracks/${old.id}`);
    expect(await prisma.track.findUnique({ where: { id: old.id } })).toBeNull();
    expect((await api.delete('/api/tracks/nope')).status).toBe(404);
    expect((await api.patch('/api/tracks/nope/restore')).status).toBe(404);

    jest.spyOn(prisma.track, 'findUnique').mockRejectedValue(new Error('db down'));
    expect((await api.delete(`/api/tracks/${bay.id}`)).body.error).toBe('Failed to delete track');
    expect((await api.patch(`/api/tracks/${bay.id}/restore`)).body.error).toBe('Failed to restore track');
    expect((await api.get(`/api/tracks/${bay.id}`)).body.error).toBe('Failed to fetch track');
    expect((await api.post(`/api/tracks/${bay.id}/reset-stats`)).body.error).toBe('Failed to reset track statistics');
  });
});

describe('POST /api/tracks/:id/reset-stats', () => {
  test('erases its laps and records, clears the best lap, keeps the sessions', async () => {
    await prisma.trackRecord.create({ data: { trackId: ring.id, driverId: ana.id, carId: gt.id, lapTime: 8100 } });
    const res = await api.post(`/api/tracks/${ring.id}/reset-stats`);
    expect(res.body).toMatchObject({
      success: true,
      message: 'Statistics reset successfully',
      data: { bestLap: null, bestLapBy: null, img: '/api/img/ring.png', _count: { sessions: 2 } },
    });
    expect(await prisma.lap.count({ where: { trackId: ring.id } })).toBe(0);
    expect(await prisma.trackRecord.count({ where: { trackId: ring.id } })).toBe(0);
    expect(await prisma.lap.count({ where: { trackId: oval.id } })).toBe(1);
    expect((await api.post('/api/tracks/nope/reset-stats')).status).toBe(404);
  });
});
