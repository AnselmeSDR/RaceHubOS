import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createCockpitRouter } from '../routes/cockpit.js';
import { backupDatabase } from '../lib/backupDatabase.js';
import { getDatabasePath } from '../lib/database-url.js';
import { createCockpitFixture } from './fixtures/createCockpitFixture.js';
import { prisma } from './setup.js';

let root;
let app;
let zip;
let backup;
beforeAll(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'cockpit-test-'));
  zip = await createCockpitFixture();
});
beforeEach(async () => {
  await prisma.cockpitImportRecord.deleteMany();
  await prisma.trackRecord.deleteMany();
  await prisma.controllerConfig.deleteMany();
  await prisma.lap.deleteMany();
  await prisma.sessionDriver.deleteMany();
  await prisma.session.deleteMany();
  await prisma.driver.deleteMany();
  await prisma.car.deleteMany();
  await prisma.track.deleteMany();
  backup = jest.fn((options) => backupDatabase({ ...options, reason: options.reason + '-' + Date.now() }));
  app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use('/api/data', createCockpitRouter({ prisma, uploads: root, backup }));
});
afterAll(async () => {
  await fs.rm(root, { recursive: true, force: true });
  await fs.rm(path.join(path.dirname(getDatabasePath()), 'db-old'), { recursive: true, force: true });
});
const preview = async (buffer = zip) =>
  (
    await request(app)
      .post('/api/data/cockpit/preview')
      .set('Origin', 'http://other-network-device:5173')
      .attach('file', buffer, 'synthetic.zip')
      .expect(200)
  ).body.data;
function reviewed(value) {
  const rows = structuredClone(value.rows);
  for (const group of Object.keys(rows))
    rows[group] = rows[group].map(({ key, targetId, data, includeImage }) => ({ key, targetId, data, includeImage }));
  rows.cars[0].data.brand = 'User selected brand';
  return rows;
}
const commit = (value, rows = reviewed(value)) =>
  request(app).post('/api/data/cockpit/import').send({ id: value.id, confirmed: true, rows });
test('Node preview exposes editable records, defaults and a missing brand without writes or backup', async () => {
  const value = await preview();
  expect(Object.keys(value.rows)).toEqual(['drivers', 'cars', 'tracks', 'sessions', 'results', 'laps']);
  expect(value.rows.cars[0].data).toMatchObject({
    brand: '',
    maxSpeed: 100,
    brakeForce: 50,
    fuelCapacity: 100,
    color: '#3B82F6',
    motor: 'Fixture motor',
  });
  expect(value.rows.sessions).toHaveLength(1);
  expect(value.rows.laps[0].data.session).toBe(value.rows.sessions[0].key);
  expect(await prisma.driver.count()).toBe(0);
  expect(await prisma.session.count()).toBe(0);
  expect(backup).not.toHaveBeenCalled();
  await request(app)
    .get(`/api/data/cockpit/preview/${value.id}/image/${value.rows.drivers[0].key}`)
    .expect('Content-Type', /image\/png/)
    .expect(200);
});
test('reviewed values and removal are stored through normal tables, including results/laps and images', async () => {
  const value = await preview();
  const rows = reviewed(value);
  rows.drivers = rows.drivers.filter((row) => row.data.name !== 'Unused Driver');
  rows.cars[0].data.model = 'Edited by user';
  rows.cars[0].data.year = 1888;
  rows.cars[0].data.maxSpeed = 70;
  rows.results[0].data.totalLaps = 9;
  rows.laps[0].data.lapTime = 6543;
  const result = (await commit(value, rows).expect(200)).body.data;
  expect(result.counts).toEqual({ drivers: 1, cars: 1, tracks: 1, sessions: 1, results: 1, laps: 1 });
  expect(backup).toHaveBeenCalledTimes(1);
  const car = await prisma.car.findFirst();
  expect(car).toMatchObject({
    model: 'Edited by user',
    year: 1888,
    maxSpeed: 70,
    brakeForce: 50,
    brand: 'User selected brand',
  });
  expect(car.notes).toBeNull();
  const session = await prisma.session.findFirst({ include: { drivers: true, laps: true } });
  expect(session.status).toBe('finished');
  expect(session.drivers[0].totalLaps).toBe(9);
  expect(session.laps[0]).toMatchObject({ lapTime: 6543, carId: car.id, trackId: session.trackId });
  const driver = await prisma.driver.findFirst();
  expect(driver.img).toMatch(/^\/api\/img\/drivers\/cockpit-/);
  expect(await prisma.preference.findFirst({ where: { key: { startsWith: 'cockpit:' } } })).toBeNull();
});
test('repeated imports link the previous targets without duplicates or overwriting their edited values', async () => {
  const first = await preview();
  await commit(first).expect(200);
  const car = await prisma.car.findFirst();
  await prisma.car.update({ where: { id: car.id }, data: { motor: 'User motor' } });
  const second = await preview();
  expect(second.rows.cars[0].targetId).toBe(car.id);
  await commit(second).expect(200);
  expect(await prisma.car.count()).toBe(1);
  expect(await prisma.session.count()).toBe(1);
  expect(await prisma.lap.count()).toBe(1);
  expect((await prisma.car.findFirst()).motor).toBe('User motor');
});
test('missing confirmation, arbitrary keys/fields, invalid defaults and remote images never write', async () => {
  const value = await preview();
  await request(app)
    .post('/api/data/cockpit/import')
    .send({ id: value.id, rows: reviewed(value) })
    .expect(400);
  for (const modify of [
    (rows) => {
      rows.cars[0].key = 'forged';
    },
    (rows) => {
      rows.cars[0].data.unexpected = true;
    },
    (rows) => {
      rows.cars[0].data.maxSpeed = 101;
    },
    (rows) => {
      rows.cars[0].data.img = 'https://example.com/image.png';
    },
    (rows) => {
      rows.cars[0].data.brand = '';
    },
  ]) {
    const rows = reviewed(value);
    modify(rows);
    await commit(value, rows).expect(400);
  }
  expect(await prisma.car.count()).toBe(0);
  expect(backup).not.toHaveBeenCalled();
});
test('removed references and ambiguous race links must be explicitly resolved', async () => {
  const value = await preview(await createCockpitFixture({ ambiguous: true }));
  expect(value.rows.laps[0].data.session).toBe('');
  await commit(value).expect(400);
  const rows = reviewed(value);
  rows.laps[0].data.session = rows.sessions[0].key;
  await commit(value, rows).expect(200);
  const next = await preview();
  const invalid = reviewed(next);
  invalid.cars = [];
  invalid.results[0].targetId = '';
  await commit(next, invalid).expect(400);
});
test('backup failure leaves no rows or image files; preview remains reusable', async () => {
  backup.mockImplementation(() => {
    throw new Error('Backup unavailable');
  });
  const value = await preview();
  const before = await fs.readdir(root);
  await commit(value).expect(500);
  expect(await prisma.car.count()).toBe(0);
  expect(await fs.readdir(root)).toEqual(before);
});
test('database changes invalidate a preview before any backup or write', async () => {
  const value = await preview();
  await prisma.car.create({ data: { brand: 'Existing', model: 'New after preview' } });
  await commit(value).expect(409);
  expect(await prisma.car.count()).toBe(1);
  expect(backup).not.toHaveBeenCalled();
});
test('failed Prisma transaction removes staged images and all imported rows', async () => {
  const value = await preview();
  const rows = reviewed(value);
  rows.drivers[0].data.email = 'duplicate@example.com';
  rows.drivers[1].data.email = 'duplicate@example.com';
  const before = await fs.readdir(path.join(root, 'drivers')).catch(() => []);
  await commit(value, rows).expect(500);
  expect(await prisma.driver.count()).toBe(0);
  expect(await prisma.cockpitImportRecord.count()).toBe(0);
  expect(await fs.readdir(path.join(root, 'drivers'))).toEqual(before);
});
test('invalid archive is rejected without executing or extracting programs', async () => {
  await request(app).post('/api/data/cockpit/preview').attach('file', Buffer.from('not a zip'), 'bad.zip').expect(400);
  expect(await prisma.car.count()).toBe(0);
});

test('optional catalog copy is capability-gated, transactional and preserves existing articles', async () => {
  const archive = await createCockpitFixture({ carPhoto: true });
  const value = await preview(archive);
  const rows = reviewed(value);
  rows.cars[0].catalogSerial = 'COCKPIT-CATALOG-TEST';
  rows.cars[0].data.tyresFront = 'Reviewed front tyres';
  rows.cars[0].data.tyresRear = 'Reviewed rear tyres';
  rows.cars[0].data.lengthMm = 125;
  const send = (current, data) =>
    request(app)
      .post('/api/data/cockpit/import')
      .send({ id: current.id, confirmed: true, importCatalog: true, rows: data });
  if (!prisma.catalogEntry) {
    expect(value.catalogAvailable).toBe(false);
    await send(value, rows).expect(400);
    expect(backup).not.toHaveBeenCalled();
    expect(await prisma.car.count()).toBe(0);
    return;
  }
  await prisma.catalogEntry.deleteMany({ where: { serial: 'COCKPIT-CATALOG-TEST' } });
  // Refresh after any deliberate catalog edit so stale-preview detection remains active.
  const fresh = await preview(archive);
  const current = reviewed(fresh);
  Object.assign(current.cars[0], { catalogSerial: rows.cars[0].catalogSerial });
  Object.assign(current.cars[0].data, rows.cars[0].data);
  const result = (await send(fresh, current).expect(200)).body.data;
  expect(result.counts.catalogImported).toBe(1);
  const article = await prisma.catalogEntry.findUnique({ where: { serial: 'COCKPIT-CATALOG-TEST' } });
  expect(article).toMatchObject({
    tyresFront: 'Reviewed front tyres',
    tyresRear: 'Reviewed rear tyres',
    lengthMm: 125,
  });
  const car = await prisma.car.findFirst();
  expect(car.serial).toBe(article.serial);
  expect(article.img).toBe(car.img);
  expect(await fs.readFile(path.join(root, 'cars', path.basename(article.img)))).toEqual(
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
      'base64'
    )
  );
  const again = await preview(archive);
  const repeat = reviewed(again);
  repeat.cars[0].catalogSerial = article.serial;
  const repeated = (await send(again, repeat).expect(200)).body.data;
  expect(repeated.counts.catalogSkipped).toBe(1);
  expect(await prisma.catalogEntry.findUnique({ where: { serial: article.serial } })).toEqual(article);
  const stale = await preview(archive);
  await prisma.catalogEntry.update({ where: { serial: article.serial }, data: { notes: 'Concurrent catalog edit' } });
  const staleRows = reviewed(stale);
  staleRows.cars[0].catalogSerial = article.serial;
  await send(stale, staleRows).expect(409);
  await prisma.catalogEntry.delete({ where: { serial: article.serial } });
});
