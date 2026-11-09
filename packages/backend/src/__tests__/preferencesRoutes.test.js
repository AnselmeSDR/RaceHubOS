import { jest } from '@jest/globals';
import { prisma } from './setup.js';
import { apiFor } from './helpers/entityFixtures.js';

jest.unstable_mockModule('../lib/prisma.js', () => ({ createPrismaClient: () => prisma }));
const { default: router } = await import('../routes/preferences.js');
const api = apiFor('/api/preferences', router);

beforeEach(async () => {
  await prisma.preference.deleteMany({ where: { key: { startsWith: 'test:' } } });
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

test('any JSON value by key, null until saved', async () => {
  expect((await api.get('/api/preferences/test:columns')).body).toEqual({ success: true, data: null });
  const value = { name: true, laps: [1, 2] };
  expect((await api.put('/api/preferences/test:columns').send({ value })).body.data).toEqual(value);
  await api.put('/api/preferences/test:columns').send({ value: false });
  expect((await api.get('/api/preferences/test:columns')).body.data).toBe(false);
});

test('a database failure answers 500 with its message', async () => {
  jest.spyOn(prisma.preference, 'findUnique').mockRejectedValueOnce(new Error('db down'));
  jest.spyOn(prisma.preference, 'upsert').mockRejectedValueOnce(new Error('disk full'));
  expect((await api.get('/api/preferences/test:x')).body).toEqual({ success: false, error: 'db down' });
  const res = await api.put('/api/preferences/test:x').send({ value: 1 });
  expect([res.status, res.body.error]).toEqual([500, 'disk full']);
});
