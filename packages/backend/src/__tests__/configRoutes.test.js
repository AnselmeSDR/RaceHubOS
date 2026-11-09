import { jest } from '@jest/globals';
import { prisma } from './setup.js';
import { apiFor, wipe } from './helpers/entityFixtures.js';

jest.unstable_mockModule('../lib/prisma.js', () => ({ createPrismaClient: () => prisma }));
const { default: router, setConfigService } = await import('../routes/config.js');
const { ConfigService } = await import('../services/ConfigService.js');

const io = { emit: jest.fn() };
const service = new ConfigService(io);
setConfigService(service);
const api = apiFor('/api/config', router);

let track, ana, gt;

beforeEach(async () => {
  await wipe(prisma);
  io.emit.mockClear();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  track = await prisma.track.create({ data: { name: 'Ring' } });
  ana = await prisma.driver.create({ data: { name: 'Ana' } });
  gt = await prisma.car.create({ data: { brand: 'Ford', model: 'GT' } });
});
afterEach(() => jest.restoreAllMocks());

const slots = async () => (await api.get(`/api/config?trackId=${track.id}`)).body.data;

test('six slots per track, empty until set', async () => {
  const data = await slots();
  expect(data.map((s) => s.controller)).toEqual([0, 1, 2, 3, 4, 5]);
  expect(data[0]).toEqual({ controller: 0, driverId: null, carId: null, driver: null, car: null, isActive: true });
});

test('a slot is set, read back and broadcast', async () => {
  const listener = jest.fn();
  service.on('config:updated', listener);
  const res = await api.put('/api/config/2').send({ trackId: track.id, driverId: ana.id, carId: gt.id });
  expect(res.body.data).toMatchObject({ controller: 2, driver: { name: 'Ana' }, car: { model: 'GT' } });
  expect(io.emit).toHaveBeenCalledWith('config:updated', {
    controller: 2,
    config: expect.objectContaining({ id: res.body.data.id }),
  });
  expect(listener).toHaveBeenCalled();

  expect((await api.get(`/api/config/2?trackId=${track.id}`)).body.data.driverId).toBe(ana.id);
  expect((await api.get(`/api/config/3?trackId=${track.id}`)).body.data).toBeNull();
  expect((await slots())[2].car.model).toBe('GT');

  await api.put('/api/config/2').send({ trackId: track.id, driverId: '' });
  expect((await slots())[2]).toMatchObject({ driverId: null, carId: null });
});

test('several slots at once, then all cleared', async () => {
  const res = await api.put('/api/config/bulk').send({
    trackId: track.id,
    controllers: [
      { controller: 0, driverId: ana.id, carId: gt.id },
      { controller: 1, carId: gt.id },
    ],
  });
  expect(res.body.data.map((c) => c.controller)).toEqual([0, 1]);
  expect(io.emit).toHaveBeenCalledWith('config:bulk-updated', {
    trackId: track.id,
    configs: res.body.data.map(({ id }) => expect.objectContaining({ id })),
  });

  expect((await api.get(`/api/config/validate?trackId=${track.id}`)).body.data).toEqual({
    valid: false,
    unconfiguredSlots: [1],
  });

  expect((await api.delete(`/api/config?trackId=${track.id}`)).body).toEqual({
    success: true,
    message: 'All configurations cleared',
  });
  expect(io.emit).toHaveBeenCalledWith('config:cleared', { trackId: track.id });
  expect((await api.get(`/api/config/validate?trackId=${track.id}`)).body.data).toEqual({
    valid: true,
    unconfiguredSlots: [],
  });
});

test('every route needs a track, the bulk one a list', async () => {
  const missing = { success: false, error: 'trackId is required' };
  for (const res of [
    await api.get('/api/config'),
    await api.get('/api/config/validate'),
    await api.get('/api/config/1'),
    await api.put('/api/config/1').send({}),
    await api.put('/api/config/bulk').send({}),
    await api.delete('/api/config'),
  ]) {
    expect([res.status, res.body]).toEqual([400, missing]);
  }
  const res = await api.put('/api/config/bulk').send({ trackId: track.id, controllers: 'all' });
  expect([res.status, res.body.error]).toEqual([400, 'controllers array is required']);
});

test('a database failure answers 500 with its message', async () => {
  jest.spyOn(prisma.controllerConfig, 'findMany').mockRejectedValueOnce(new Error('db down'));
  const res = await api.get(`/api/config?trackId=${track.id}`);
  expect([res.status, res.body]).toEqual([500, { success: false, error: 'db down' }]);
});
