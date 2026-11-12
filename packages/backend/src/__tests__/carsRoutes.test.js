import { jest } from '@jest/globals';
import { prisma } from './setup.js';
import { apiFor, recorder, wipe } from './helpers/entityFixtures.js';

// The router shares the test client, so a test can make one of its queries fail
jest.unstable_mockModule('../lib/prisma.js', () => ({ createPrismaClient: () => prisma }));
const { default: carsRouter } = await import('../routes/cars.js');

const api = apiFor('/api/cars', carsRouter);
const { session, entry, lap } = recorder(prisma);

let gt, p911, ana, ben, ring, oval;

/** The GT races s1 on Ring and s2 on Oval, the 911 s1, the R8 nothing. */
beforeEach(async () => {
  await wipe(prisma);
  jest.spyOn(console, 'error').mockImplementation(() => {});
  gt = await prisma.car.create({ data: { brand: 'Ford', model: 'GT', img: 'gt.png' } });
  p911 = await prisma.car.create({ data: { brand: 'Porsche', model: '911' } });
  await prisma.car.create({ data: { brand: 'Audi', model: 'R8' } });
  await prisma.car.create({ data: { brand: 'Opel', model: 'Manta', deletedAt: new Date() } });
  ana = await prisma.driver.create({ data: { name: 'Ana' } });
  ben = await prisma.driver.create({ data: { name: 'Ben' } });
  ring = await prisma.track.create({ data: { name: 'Ring' } });
  oval = await prisma.track.create({ data: { name: 'Oval' } });
  const s1 = await session(ring, { createdAt: new Date('2026-01-01T10:00:00Z') });
  const s2 = await session(oval, { createdAt: new Date('2026-01-02T10:00:00Z') });
  await entry(s1, ana, gt);
  await entry(s1, ben, p911, { controller: 1 });
  await entry(s2, ana, gt);
  await entry(s2, ben, gt, { controller: 1, deletedAt: new Date() });
  await lap(s1, ana, gt, 8100);
  await lap(s1, ana, gt, 8200, { deletedAt: new Date() });
  await lap(s2, ana, gt, 8500);
  await lap(s1, ben, gt, 8300);
  await lap(s1, ben, p911, 9000);
});
afterEach(() => jest.restoreAllMocks());

const brands = async (query) => (await api.get(`/api/cars?${query}`)).body.data.map((c) => c.brand);

describe('GET /api/cars', () => {
  test('cars not deleted by brand, with entry counts, image URLs and extras', async () => {
    const res = await api.get('/api/cars');
    expect(res.body).toMatchObject({ success: true, total: 3, hasMore: false });
    expect(res.body.data.map((c) => c.brand)).toEqual(['Audi', 'Ford', 'Porsche']);
    expect(res.body.data[1]).toMatchObject({ img: '/api/img/gt.png', _count: { sessions: 2 }, extras: {} });
    // Figures from the races and the laps not deleted
    expect(res.body.data.map(({ races, bestLap }) => [races, bestLap])).toEqual([
      [0, null],
      [2, 8100],
      [1, 9000],
    ]);
    expect(await brands('deleted=true')).toEqual(['Opel']);
  });

  test('with their categories, filtered on one or several, or none', async () => {
    const category = (name, order) => prisma.division.create({ data: { name, order, scope: 'car' } });
    const gt3 = await category('GT3', 1);
    const gte = await category('GTE', 2);
    await api.put(`/api/cars/${gt.id}`).send({ divisionIds: [gte.id, gt3.id] });
    await api.put(`/api/cars/${p911.id}`).send({ divisionIds: [gte.id] });

    const res = await api.get(`/api/cars?divisionId=${gt3.id}`);
    expect(res.body.data.map((c) => [c.brand, c.divisions.map((d) => d.name)])).toEqual([['Ford', ['GT3', 'GTE']]]);
    expect(await brands(`divisionId=${gt3.id},${gte.id}`)).toEqual(['Ford', 'Porsche']);
    expect(await brands('divisionId=none')).toEqual(['Audi']);
    expect(await brands('sortBy=divisions')).toEqual(['Ford', 'Porsche', 'Audi']);
  });

  test('sorted by a column, the entry count or the best lap, then paginated', async () => {
    expect(await brands('sortBy=sessions&sortOrder=desc')).toEqual(['Ford', 'Porsche', 'Audi']);
    expect(await brands('sortBy=bestLap&sortOrder=asc')).toEqual(['Ford', 'Porsche', 'Audi']);
    expect(await brands('sortBy=bestLap&sortOrder=desc')).toEqual(['Audi', 'Porsche', 'Ford']);
    expect(await brands('sortBy=bestLap&limit=1&offset=1')).toEqual(['Porsche']);
    const res = await api.get('/api/cars?sortBy=model&limit=2');
    expect(res.body.data.map((c) => c.model)).toEqual(['911', 'GT']);
    expect(res.body).toMatchObject({ total: 3, hasMore: true });
  });

  test('a bad sort answers 500', async () => {
    const res = await api.get('/api/cars?sortBy=nope');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ success: false, error: 'Failed to fetch cars' });
  });
});

describe('exports', () => {
  test('a workbook for one or several cars, 404 for none, 500 with the message on failure', async () => {
    expect((await api.get(`/api/cars/${gt.id}/export`)).status).toBe(200);
    expect((await api.get(`/api/cars/export?ids=${gt.id},${p911.id}`)).status).toBe(200);
    expect((await api.get('/api/cars/nope/export')).status).toBe(404);
    expect((await api.get('/api/cars/export')).status).toBe(404);

    jest.spyOn(prisma.car, 'findMany').mockRejectedValue(new Error('db down'));
    expect((await api.get(`/api/cars/${gt.id}/export`)).body).toEqual({ success: false, error: 'db down' });
    expect((await api.get(`/api/cars/export?ids=${gt.id}`)).status).toBe(500);
  });
});

describe('GET /api/cars/:id', () => {
  test('latest sessions first, entry count and the best lap per driver and track', async () => {
    const res = await api.get(`/api/cars/${gt.id}`);
    expect(res.body.data).toMatchObject({
      model: 'GT',
      img: '/api/img/gt.png',
      _count: { sessions: 3 },
      races: 2,
      bestLap: 8100,
      extras: {},
    });
    expect(res.body.data.sessions.map((s) => s.session.track.name)).toEqual(['Oval', 'Oval', 'Ring']);
    expect(res.body.data.records.map((r) => [r.lapTime, r.driver.name, r.track.name, r.sessionType])).toEqual([
      [8100, 'Ana', 'Ring', 'race'],
      [8300, 'Ben', 'Ring', 'race'],
      [8500, 'Ana', 'Oval', 'race'],
    ]);
    expect(Object.keys(res.body.data.records[0].driver)).toEqual(['id', 'name', 'color', 'img']);
    expect((await api.get('/api/cars/nope')).status).toBe(404);
  });
});

describe('POST /api/cars', () => {
  test('a trimmed car with defaults and its specs', async () => {
    const res = await api
      .post('/api/cars')
      .send({ brand: ' Ford ', model: ' Capri ', chassis: ' X ', weightGrams: '82' });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      brand: 'Ford',
      model: 'Capri',
      year: null,
      img: null,
      color: '#3B82F6',
      maxSpeed: 100,
      brakeForce: 50,
      fuelCapacity: 100,
      chassis: 'X',
      weightGrams: 82,
      motor: null,
    });
    const tuned = await api
      .post('/api/cars')
      .send({ brand: 'A', model: 'B', maxSpeed: 0, brakeForce: 10, fuelCapacity: 5 });
    expect(tuned.body.data).toMatchObject({ maxSpeed: 0, brakeForce: 10, fuelCapacity: 5 });
  });

  test('in the categories given, never a driver division', async () => {
    const gt3 = await prisma.division.create({ data: { name: 'GT3', scope: 'car' } });
    const gold = await prisma.division.create({ data: { name: 'GOLD', scope: 'driver' } });
    const res = await api.post('/api/cars').send({ brand: 'Ford', model: 'Capri', divisionIds: [gt3.id] });
    expect(res.body.data.divisions).toMatchObject([{ name: 'GT3' }]);
    expect((await api.get(`/api/cars/${res.body.data.id}`)).body.data.divisions).toMatchObject([{ name: 'GT3' }]);

    const refused = await api.post('/api/cars').send({ brand: 'Ford', model: 'Capri', divisionIds: [gold.id] });
    expect(refused.status).toBe(400);
    expect(refused.body.error).toBe('Only car divisions can be given');
    expect((await api.put(`/api/cars/${gt.id}`).send({ divisionIds: [gold.id] })).status).toBe(400);
  });

  test('400 without a brand or a model, 500 on failure', async () => {
    expect((await api.post('/api/cars').send({ model: 'GT' })).body.error).toBe('Brand is required');
    expect((await api.post('/api/cars').send({ brand: 'Ford', model: ' ' })).body.error).toBe('Model is required');
    jest.spyOn(prisma.car, 'create').mockRejectedValueOnce(new Error('db down'));
    const res = await api.post('/api/cars').send({ brand: 'Ford', model: 'GT' });
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Failed to create car');
  });
});

describe('PUT /api/cars/:id', () => {
  test('updates only the fields and specs given', async () => {
    await prisma.car.update({ where: { id: gt.id }, data: { motor: 'S-Can', guide: 'Deep' } });
    const res = await api.put(`/api/cars/${gt.id}`).send({
      brand: ' Ford ',
      model: ' GT40 ',
      year: 1966,
      img: 'gt40.png',
      color: '#000000',
      maxSpeed: 90,
      brakeForce: 40,
      fuelCapacity: 80,
      motor: '',
    });
    expect(res.body.data).toMatchObject({
      brand: 'Ford',
      model: 'GT40',
      year: 1966,
      img: '/api/img/gt40.png',
      color: '#000000',
      maxSpeed: 90,
      brakeForce: 40,
      fuelCapacity: 80,
      motor: null,
      guide: 'Deep',
    });
  });

  test('404 when missing, 500 on failure', async () => {
    expect((await api.put('/api/cars/nope').send({ brand: 'X' })).status).toBe(404);
    jest.spyOn(prisma, '$transaction').mockRejectedValueOnce(new Error('db down'));
    const res = await api.put(`/api/cars/${gt.id}`).send({ brand: 'X' });
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Failed to update car');
  });
});

describe('DELETE and restore', () => {
  test('a first delete hides the car and its laps, a restore brings them back', async () => {
    let res = await api.delete(`/api/cars/${gt.id}`);
    expect(res.body).toEqual({ success: true, message: 'Car deleted successfully' });
    expect(await prisma.lap.count({ where: { carId: gt.id, deletedAt: null } })).toBe(0);

    res = await api.patch(`/api/cars/${gt.id}/restore`);
    expect(res.body).toEqual({ success: true, message: 'Car restored' });
    expect(await prisma.lap.count({ where: { carId: gt.id, deletedAt: null } })).toBe(3);
  });

  test('a second delete erases the car with everything recorded under it', async () => {
    await prisma.controllerConfig.create({ data: { controller: 0, carId: gt.id, trackId: ring.id } });
    await prisma.trackRecord.create({ data: { trackId: ring.id, driverId: ana.id, carId: gt.id, lapTime: 8100 } });
    await prisma.car.update({ where: { id: gt.id }, data: { deletedAt: new Date() } });

    await api.delete(`/api/cars/${gt.id}`);
    expect(await prisma.car.findUnique({ where: { id: gt.id } })).toBeNull();
    for (const model of ['lap', 'sessionDriver', 'controllerConfig', 'trackRecord']) {
      expect(await prisma[model].count({ where: { carId: gt.id } })).toBe(0);
    }
    expect(await prisma.lap.count({ where: { carId: p911.id } })).toBe(1);
  });

  test('404 when missing, 500 on failure', async () => {
    expect((await api.delete('/api/cars/nope')).status).toBe(404);
    expect((await api.patch('/api/cars/nope/restore')).status).toBe(404);
    jest.spyOn(prisma.car, 'findUnique').mockRejectedValue(new Error('db down'));
    expect((await api.delete(`/api/cars/${gt.id}`)).body.error).toBe('Failed to delete car');
    expect((await api.patch(`/api/cars/${gt.id}/restore`)).body.error).toBe('Failed to restore car');
    expect((await api.get(`/api/cars/${gt.id}`)).body.error).toBe('Failed to fetch car');
    expect((await api.post(`/api/cars/${gt.id}/reset-stats`)).body.error).toBe('Failed to reset car statistics');
  });
});

describe('POST /api/cars/:id/reset-stats', () => {
  test('erases its laps and entries: its figures fall to zero', async () => {
    const res = await api.post(`/api/cars/${gt.id}/reset-stats`);
    expect(res.body).toMatchObject({
      success: true,
      message: 'Statistics reset successfully',
      data: { races: 0, bestLap: null, img: '/api/img/gt.png', _count: { sessions: 0 } },
    });
    expect(await prisma.lap.count({ where: { carId: gt.id } })).toBe(0);
    expect(await prisma.lap.count({ where: { carId: p911.id } })).toBe(1);
    expect((await api.post('/api/cars/nope/reset-stats')).status).toBe(404);
  });
});
