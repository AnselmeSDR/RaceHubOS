import { jest } from '@jest/globals';
import { prisma } from './setup.js';
import { apiFor } from './helpers/entityFixtures.js';

jest.unstable_mockModule('../lib/prisma.js', () => ({ createPrismaClient: () => prisma }));
const { default: router } = await import('../routes/devices.js');
const api = apiFor('/api/devices', router);

let simulator, cu;

beforeEach(async () => {
  await prisma.device.deleteMany();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  cu = await prisma.device.create({ data: { address: 'AA', name: 'Old CU', lastConnected: new Date('2026-01-01') } });
  await prisma.device.create({ data: { address: 'BB', name: 'New CU', lastConnected: new Date('2026-02-01') } });
  simulator = await prisma.device.create({ data: { address: 'SIMULATOR', name: 'Simulator', type: 'simulator' } });
});
afterEach(() => jest.restoreAllMocks());

test('the list: control units first, the latest used on top, then the simulator', async () => {
  const { body } = await api.get('/api/devices');
  expect(body.data.map((d) => d.name)).toEqual(['New CU', 'Old CU', 'Simulator']);
  expect(body.count).toBe(3);
});

test('a device, renamed', async () => {
  expect((await api.get(`/api/devices/${cu.id}`)).body.data.name).toBe('Old CU');
  expect((await api.put(`/api/devices/${cu.id}`).send({ name: 'Garage' })).body.data.name).toBe('Garage');
  for (const res of [await api.get('/api/devices/nope'), await api.put('/api/devices/nope').send({ name: 'x' })]) {
    expect([res.status, res.body.error]).toEqual([404, 'Device not found']);
  }
});

test('a control unit is forgotten, never the simulator', async () => {
  expect((await api.delete(`/api/devices/${cu.id}`)).body).toEqual({
    success: true,
    message: 'Device deleted successfully',
  });
  expect(await prisma.device.count()).toBe(2);
  const res = await api.delete(`/api/devices/${simulator.id}`);
  expect([res.status, res.body.error]).toEqual([400, 'Cannot delete simulator device']);
  expect((await api.delete('/api/devices/nope')).status).toBe(404);
});

test.each([
  ['get', '/api/devices', 'findMany', 'Failed to fetch devices'],
  ['get', '/api/devices/x', 'findUnique', 'Failed to fetch device'],
  ['put', '/api/devices/x', 'findUnique', 'Failed to update device'],
  ['delete', '/api/devices/x', 'findUnique', 'Failed to delete device'],
])('%s %s: a database failure answers 500', async (method, url, call, error) => {
  jest.spyOn(prisma.device, call).mockRejectedValueOnce(new Error('db down'));
  const res = await api[method](url);
  expect([res.status, res.body]).toEqual([500, { success: false, error }]);
});
