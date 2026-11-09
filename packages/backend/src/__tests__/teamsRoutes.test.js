import { jest } from '@jest/globals';
import { prisma } from './setup.js';
import { apiFor, wipe } from './helpers/entityFixtures.js';

// The router shares the test client, so a test can make one of its queries fail
jest.unstable_mockModule('../lib/prisma.js', () => ({ createPrismaClient: () => prisma }));
const { default: teamsRouter } = await import('../routes/teams.js');

const api = apiFor('/api/teams', teamsRouter);

let red, blue, gray, gone;

/** Red has Ben and Ana (and deleted Dan), Blue has Cid, Gray nobody; Gone is deleted. */
beforeEach(async () => {
  await wipe(prisma);
  jest.spyOn(console, 'error').mockImplementation(() => {});
  red = await prisma.team.create({ data: { name: 'Red', img: 'red.png' } });
  blue = await prisma.team.create({ data: { name: 'Blue' } });
  gray = await prisma.team.create({ data: { name: 'Gray' } });
  gone = await prisma.team.create({ data: { name: 'Gone', deletedAt: new Date() } });
  await prisma.driver.create({ data: { name: 'Ben', teamId: red.id, img: 'ben.png' } });
  await prisma.driver.create({ data: { name: 'Ana', teamId: red.id } });
  await prisma.driver.create({ data: { name: 'Dan', teamId: red.id, deletedAt: new Date() } });
  await prisma.driver.create({ data: { name: 'Cid', teamId: blue.id } });
});
afterEach(() => jest.restoreAllMocks());

const names = async (query) => (await api.get(`/api/teams?${query}`)).body.data.map((t) => t.name);

describe('GET /api/teams', () => {
  test('teams not deleted by name, with their current drivers, counts, image URLs and extras', async () => {
    const res = await api.get('/api/teams');
    expect(res.body).toMatchObject({ success: true, total: 3, hasMore: false });
    expect(res.body.data.map((t) => t.name)).toEqual(['Blue', 'Gray', 'Red']);
    expect(res.body.data[2]).toMatchObject({ img: '/api/img/red.png', _count: { drivers: 2 }, extras: {} });
    expect(res.body.data[2].drivers.map((d) => [d.name, d.img])).toEqual([
      ['Ana', null],
      ['Ben', '/api/img/ben.png'],
    ]);
    expect(await names('deleted=true')).toEqual(['Gone']);
  });

  test('sorted by a column or the driver count, paginated', async () => {
    expect(await names('sortBy=drivers&sortOrder=desc')).toEqual(['Red', 'Blue', 'Gray']);
    const res = await api.get('/api/teams?sortOrder=desc&limit=2&offset=1');
    expect(res.body.data.map((t) => t.name)).toEqual(['Gray', 'Blue']);
    expect(res.body).toMatchObject({ total: 3, hasMore: false });
    expect((await api.get('/api/teams?limit=1')).body.hasMore).toBe(true);
  });

  test('a bad sort answers 500', async () => {
    const res = await api.get('/api/teams?sortBy=nope');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ success: false, error: 'Failed to fetch teams' });
  });
});

describe('GET /api/teams/:id', () => {
  test('with every driver by name, 404 when missing', async () => {
    const res = await api.get(`/api/teams/${red.id}`);
    expect(res.body.data).toMatchObject({ name: 'Red', img: '/api/img/red.png', extras: {} });
    expect(res.body.data.drivers.map((d) => d.name)).toEqual(['Ana', 'Ben', 'Dan']);
    expect((await api.get('/api/teams/nope')).status).toBe(404);
  });
});

describe('POST /api/teams', () => {
  test('a trimmed team; 400 without a name; 500 on failure', async () => {
    let res = await api.post('/api/teams').send({ name: ' Green ' });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ name: 'Green', color: null, img: null, drivers: [] });
    res = await api.post('/api/teams').send({ name: 'Gold', color: '#ffd700', img: 'gold.png' });
    expect(res.body.data).toMatchObject({ color: '#ffd700', img: '/api/img/gold.png' });

    expect((await api.post('/api/teams').send({})).body).toEqual({ success: false, error: 'Name is required' });
    jest.spyOn(prisma.team, 'create').mockRejectedValueOnce(new Error('db down'));
    res = await api.post('/api/teams').send({ name: 'X' });
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Failed to create team');
  });
});

describe('PUT /api/teams/:id', () => {
  test('updates the fields given, with its drivers; 404 when missing; 500 on failure', async () => {
    const res = await api.put(`/api/teams/${blue.id}`).send({ name: ' Navy ', color: '#000080', img: 'navy.png' });
    expect(res.body.data).toMatchObject({ name: 'Navy', color: '#000080', img: '/api/img/navy.png' });
    expect(res.body.data.drivers.map((d) => d.name)).toEqual(['Cid']);
    expect((await api.put(`/api/teams/${gray.id}`).send({})).body.data.name).toBe('Gray');

    expect((await api.put('/api/teams/nope').send({ name: 'X' })).status).toBe(404);
    jest.spyOn(prisma.team, 'update').mockRejectedValueOnce(new Error('db down'));
    expect((await api.put(`/api/teams/${gray.id}`).send({ name: 'X' })).body.error).toBe('Failed to update team');
  });
});

describe('DELETE and restore', () => {
  test('a first delete hides the team, a restore brings it back', async () => {
    let res = await api.delete(`/api/teams/${red.id}`);
    expect(res.body).toEqual({ success: true, message: 'Team deleted successfully' });
    expect((await prisma.team.findUnique({ where: { id: red.id } })).deletedAt).not.toBeNull();
    expect(await prisma.driver.count({ where: { teamId: red.id, deletedAt: null } })).toBe(2);

    res = await api.patch(`/api/teams/${red.id}/restore`);
    expect(res.body).toEqual({ success: true, message: 'Team restored' });
    expect((await prisma.team.findUnique({ where: { id: red.id } })).deletedAt).toBeNull();
  });

  test('a second delete erases an empty team and refuses one with drivers, even deleted ones', async () => {
    await api.delete(`/api/teams/${gone.id}`);
    expect(await prisma.team.findUnique({ where: { id: gone.id } })).toBeNull();

    await prisma.team.update({ where: { id: red.id }, data: { deletedAt: new Date() } });
    const res = await api.delete(`/api/teams/${red.id}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Cannot delete team with 3 driver(s). Please reassign or delete drivers first.');
  });

  test('404 when missing, 500 on failure', async () => {
    expect((await api.delete('/api/teams/nope')).status).toBe(404);
    expect((await api.patch('/api/teams/nope/restore')).status).toBe(404);
    jest.spyOn(prisma.team, 'findUnique').mockRejectedValue(new Error('db down'));
    expect((await api.delete(`/api/teams/${red.id}`)).body.error).toBe('Failed to delete team');
    expect((await api.patch(`/api/teams/${red.id}/restore`)).body.error).toBe('Failed to restore team');
    expect((await api.get(`/api/teams/${red.id}`)).body.error).toBe('Failed to fetch team');
  });
});
