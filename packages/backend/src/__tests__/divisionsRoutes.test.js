import { jest } from '@jest/globals';
import { prisma } from './setup.js';
import { apiFor, wipe } from './helpers/entityFixtures.js';

// The router shares the test client, so a test can make one of its queries fail
jest.unstable_mockModule('../lib/prisma.js', () => ({ createPrismaClient: () => prisma }));
const { default: divisionsRouter } = await import('../routes/divisions.js');

const api = apiFor('/api/divisions', divisionsRouter);

let gold, silver, gt3;

const division = (data) => prisma.division.create({ data: { scope: 'driver', ...data } });

/**
 * Drivers: GOLD (rank 1) has Ben and Ana (and deleted Dan), SILVER (rank 2) nobody, OLD is deleted.
 * Cars: GT3 has the Audi (and a deleted BMW).
 */
beforeEach(async () => {
  await wipe(prisma);
  jest.spyOn(console, 'error').mockImplementation(() => {});
  gold = await division({ name: 'Gold league', shortName: 'GOLD', img: 'gold.png', order: 1 });
  silver = await division({ name: 'SILVER', order: 2 });
  await division({ name: 'OLD', order: 3, deletedAt: new Date() });
  gt3 = await division({ name: 'GT3', scope: 'car', order: 1 });
  const inGold = { divisions: { create: [{ divisionId: gold.id }] } };
  await prisma.driver.create({ data: { name: 'Ben', img: 'ben.png', ...inGold } });
  await prisma.driver.create({ data: { name: 'Ana', ...inGold } });
  await prisma.driver.create({ data: { name: 'Dan', deletedAt: new Date(), ...inGold } });
  const inGt3 = { divisions: { create: [{ divisionId: gt3.id }] } };
  await prisma.car.create({ data: { brand: 'Audi', model: 'R8', ...inGt3 } });
  await prisma.car.create({ data: { brand: 'BMW', model: 'M4', deletedAt: new Date(), ...inGt3 } });
});
afterEach(() => jest.restoreAllMocks());

const names = async (query) => (await api.get(`/api/divisions?${query}`)).body.data.map((d) => d.name);

describe('GET /api/divisions', () => {
  test('by rank, with their current drivers and cars, counts, image URLs and extras', async () => {
    const res = await api.get('/api/divisions?scope=driver');
    expect(res.body).toMatchObject({ success: true, total: 2, hasMore: false });
    expect(res.body.data.map((d) => d.name)).toEqual(['Gold league', 'SILVER']);
    expect(res.body.data[0]).toMatchObject({
      shortName: 'GOLD',
      img: '/api/img/gold.png',
      _count: { drivers: 2, cars: 0 },
      extras: {},
    });
    expect(res.body.data[0].drivers.map((d) => [d.name, d.img])).toEqual([
      ['Ana', null],
      ['Ben', '/api/img/ben.png'],
    ]);
    const [category] = (await api.get('/api/divisions?scope=car')).body.data;
    expect(category).toMatchObject({ name: 'GT3', _count: { cars: 1 } });
    expect(category.cars.map((c) => c.brand)).toEqual(['Audi']);
    expect(await names('deleted=true')).toEqual(['OLD']);
  });

  test('both scopes without one; sorted by a column or a count; an unknown scope is a 400', async () => {
    expect(await names('sortBy=name')).toEqual(['GT3', 'Gold league', 'SILVER']);
    expect(await names('scope=driver&sortBy=drivers&sortOrder=asc')).toEqual(['SILVER', 'Gold league']);
    const res = await api.get('/api/divisions?scope=team');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Unknown scope');
  });
});

describe('GET /api/divisions/:id', () => {
  test('with its drivers, 404 when missing', async () => {
    const res = await api.get(`/api/divisions/${gold.id}`);
    expect(res.body.data).toMatchObject({ name: 'Gold league', extras: {} });
    expect(res.body.data.drivers.map((d) => d.name)).toEqual(['Ana', 'Ben']);
    expect((await api.get('/api/divisions/nope')).status).toBe(404);
  });
});

describe('GET /api/divisions/:id, the page', () => {
  test('each member with its divisions, figures and join date; the championships still run for it', async () => {
    const ana = await prisma.driver.findFirst({ where: { name: 'Ana' } });
    await prisma.driverDivision.create({ data: { driverId: ana.id, divisionId: silver.id } });
    const track = await prisma.track.create({ data: { name: 'Monza' } });
    const r8 = await prisma.car.findFirst({ where: { model: 'R8' } });
    // Figures from the results and the laps: two races (a win, a third place), a faster qualifying, a deleted race
    const ran = (type, finalPos, lapTime, deletedAt = null) =>
      prisma.session.create({
        data: {
          type,
          trackId: track.id,
          deletedAt,
          drivers: { create: [{ driverId: ana.id, carId: r8.id, controller: 0, finalPos }] },
          laps: {
            create: [
              { driverId: ana.id, carId: r8.id, trackId: track.id, controller: 0, phase: type, lapNumber: 1, lapTime },
            ],
          },
        },
      });
    await ran('race', 1, 8400);
    await ran('race', 3, 8300);
    await ran('qualif', 1, 8123);
    await ran('race', 1, 7000, new Date());
    const runFor = (ids) => ({ divisions: { create: ids.map((divisionId) => ({ divisionId })) } });
    await prisma.championship.create({
      data: { name: 'Cup', season: '2026', trackId: track.id, ...runFor([gold.id, gt3.id]) },
    });
    await prisma.championship.create({
      data: { name: 'Gone', season: '2025', deletedAt: new Date(), ...runFor([gold.id]) },
    });

    const { data } = (await api.get(`/api/divisions/${gold.id}`)).body;
    const [first] = data.drivers;
    expect(first).toMatchObject({ name: 'Ana', races: 2, wins: 1, podiums: 2, bestLap: 8123 });
    expect(first.divisions.map((d) => d.name)).toEqual(['Gold league', 'SILVER']);
    expect(Date.parse(first.since)).not.toBeNaN();
    expect(data.championships).toHaveLength(1);
    expect(data.championships[0]).toMatchObject({ name: 'Cup', track: { name: 'Monza' } });
    expect(data.championships[0].divisions.map((d) => d.name).sort()).toEqual(['GT3', 'Gold league']);
    const category = (await api.get(`/api/divisions/${gt3.id}`)).body.data;
    expect(category.cars[0]).toMatchObject({ model: 'R8', races: 2, bestLap: 8123 });
  });
});

describe('members', () => {
  const join = (id, body) => api.post(`/api/divisions/${id}/members`).send(body);

  test('a driver joins a driver division once, keeping the first date; a car joins a category', async () => {
    const cid = await prisma.driver.create({ data: { name: 'Cid' } });
    let res = await join(silver.id, { memberId: cid.id });
    expect(res.status).toBe(201);
    expect(res.body.data.drivers.map((d) => d.name)).toEqual(['Cid']);
    const { since } = res.body.data.drivers[0];
    res = await join(silver.id, { memberId: cid.id });
    expect(res.body.data.drivers).toEqual([expect.objectContaining({ name: 'Cid', since })]);

    const fiat = await prisma.car.create({ data: { brand: 'Fiat', model: '500' } });
    res = await join(gt3.id, { memberId: fiat.id });
    expect(res.body.data.cars.map((c) => c.brand)).toEqual(['Audi', 'Fiat']);
  });

  test('refused: a member of the other kind or deleted, none given, a division missing or in the bin', async () => {
    const audi = await prisma.car.findFirst({ where: { brand: 'Audi' } });
    const dan = await prisma.driver.findFirst({ where: { name: 'Dan' } });
    const old = await prisma.division.findFirst({ where: { name: 'OLD' } });
    const cid = await prisma.driver.create({ data: { name: 'Cid' } });

    let res = await join(silver.id, { memberId: audi.id });
    expect([res.status, res.body.error]).toEqual([404, 'Driver not found']);
    expect((await join(silver.id, { memberId: dan.id })).status).toBe(404);
    expect((await join(silver.id, {})).status).toBe(400);
    res = await join(old.id, { memberId: cid.id });
    expect([res.status, res.body.error]).toEqual([404, 'Division not found']);
    expect((await join('nope', { memberId: cid.id })).status).toBe(404);
    expect(await prisma.driverDivision.count({ where: { driverId: cid.id } })).toBe(0);
  });

  test('leaving a division keeps the other ones', async () => {
    const ana = await prisma.driver.findFirst({ where: { name: 'Ana' } });
    await prisma.driverDivision.create({ data: { driverId: ana.id, divisionId: silver.id } });
    const res = await api.delete(`/api/divisions/${gold.id}/members/${ana.id}`);
    expect(res.body.data.drivers.map((d) => d.name)).toEqual(['Ben']);
    expect(await prisma.driverDivision.findMany({ where: { driverId: ana.id } })).toEqual([
      expect.objectContaining({ divisionId: silver.id }),
    ]);
  });
});

describe('exports', () => {
  test('a workbook for one or several divisions, 404 for none', async () => {
    expect((await api.get(`/api/divisions/${gold.id}/export`)).status).toBe(200);
    expect((await api.get(`/api/divisions/export?ids=${gold.id},${gt3.id}`)).status).toBe(200);
    expect((await api.get('/api/divisions/nope/export')).status).toBe(404);
    expect((await api.get('/api/divisions/export')).status).toBe(404);
  });
});

describe('POST /api/divisions', () => {
  test('a trimmed division, last of its scope unless ranked; default color', async () => {
    let res = await api.post('/api/divisions').send({ name: ' Bronze ', shortName: '  ', scope: 'driver' });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ name: 'Bronze', shortName: null, color: '#6B7280', order: 3, drivers: [] });
    res = await api.post('/api/divisions').send({ name: 'DTM', scope: 'car', color: '#0284c7', order: 0 });
    expect(res.body.data).toMatchObject({ scope: 'car', color: '#0284c7', order: 0 });
  });

  test('400 without a name, a scope or with a bad rank', async () => {
    const error = async (body) => (await api.post('/api/divisions').send(body)).body.error;
    expect(await error({ scope: 'driver' })).toBe('Name is required');
    expect(await error({ name: 'X', scope: 'team' })).toBe('scope must be driver or car');
    expect(await error({ name: 'X', scope: 'car', order: -1 })).toBe('order must be a whole number from 0');
    expect(await error({ name: 'X', scope: 'car', order: 1.5 })).toBe('order must be a whole number from 0');
  });
});

describe('PUT /api/divisions/:id', () => {
  test('updates the fields given but never the scope; 404 when missing; 400 on an empty name', async () => {
    const res = await api
      .put(`/api/divisions/${silver.id}`)
      .send({ name: ' Silver ', shortName: 'SLV', color: '#c0c0c0', order: 4, scope: 'car' });
    expect(res.body.data).toMatchObject({ name: 'Silver', shortName: 'SLV', color: '#c0c0c0', order: 4 });
    expect(res.body.data.scope).toBe('driver');

    expect((await api.put('/api/divisions/nope').send({ name: 'X' })).status).toBe(404);
    expect((await api.put(`/api/divisions/${silver.id}`).send({ name: ' ' })).status).toBe(400);
  });
});

describe('DELETE and restore', () => {
  test('in the bin, a division keeps its links for a restore', async () => {
    const ana = await prisma.driver.findFirst({ where: { name: 'Ana' } });
    const linksOf = () => prisma.driverDivision.count({ where: { driverId: ana.id } });

    let res = await api.delete(`/api/divisions/${gold.id}`);
    expect(res.body).toEqual({ success: true, message: 'Division deleted successfully' });
    expect(await linksOf()).toBe(1);

    res = await api.patch(`/api/divisions/${gold.id}/restore`);
    expect(res.body).toEqual({ success: true, message: 'Division restored' });
    expect((await prisma.division.findUnique({ where: { id: gold.id } })).deletedAt).toBeNull();
  });

  test('a second delete erases it: its drivers stay, outside it', async () => {
    await api.delete(`/api/divisions/${gold.id}`);
    await api.delete(`/api/divisions/${gold.id}`);
    expect(await prisma.division.findUnique({ where: { id: gold.id } })).toBeNull();
    expect(await prisma.driverDivision.count()).toBe(0);
    expect(await prisma.driver.count()).toBe(3);
  });
});
