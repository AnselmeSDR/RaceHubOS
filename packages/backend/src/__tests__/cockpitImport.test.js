import { beforeAll, afterAll, beforeEach, test, expect } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import Database from 'better-sqlite3';
import { createCockpitRouter } from '../routes/cockpit.js';
import { getDatabasePath } from '../lib/database-url.js';
import { readCockpitArchive } from '../lib/cockpitHistory.js';
import { validateBackup } from '../lib/dataBackup.js';
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cockpit-api-'));
const fixture = path.join(root, 'synthetic.zip');
const generator = fileURLToPath(new URL('./fixtures/createCockpitFixture.py', import.meta.url));
const converter = fileURLToPath(new URL('../../scripts/cockpit_import.py', import.meta.url));
let db,
  app,
  active = false;
const backups = path.join(root, 'backups'),
  uploads = path.join(root, 'uploads');
beforeAll(() => {
  execFileSync('python3', [generator, fixture]);
  db = new Database(getDatabasePath());
});
beforeEach(() => {
  active = false;
  db.exec('DELETE FROM Driver; DELETE FROM Car; DELETE FROM Track; DELETE FROM Preference;');
  fs.rmSync(backups, { recursive: true, force: true });
  fs.rmSync(uploads, { recursive: true, force: true });
  app = express();
  app.use(express.json());
  app.use(
    '/api/data',
    createCockpitRouter({ uploadsPath: uploads, backupDirectory: backups, sessionService: { isActive: () => active } })
  );
});
afterAll(() => {
  db.close();
  fs.rmSync(root, { recursive: true, force: true });
});
const preview = (options = {}) =>
  request(app).post('/api/data/cockpit/preview').field('options', JSON.stringify(options)).attach('file', fixture);
const commit = (id, confirmed = true) => request(app).post('/api/data/cockpit/import').send({ id, confirmed });
test('ZIP preview is read-only; confirmation creates a verified pre-import backup and imports images and labelled history exactly once', async () => {
  const p = await preview();
  expect(p.status).toBe(200);
  expect(p.body.summary.counts).toEqual({ drivers: 1, cars: 1, tracks: 1, technology: 1, history: 2 });
  expect(p.body.summary.inactive).toBe(1);
  expect(p.body.summary.history.empty).toBe(1);
  expect(db.prepare('SELECT count(*) n FROM Driver').get().n).toBe(0);
  expect(fs.existsSync(backups)).toBe(false);
  expect((await commit(p.body.id, false)).status).toBe(400);
  const result = await commit(p.body.id);
  expect(result.status).toBe(200);
  const backup = JSON.parse(fs.readFileSync(path.join(backups, result.body.previous)));
  validateBackup(getDatabasePath(), backup);
  expect(backup.payload.tables.Driver.rows).toHaveLength(0);
  expect(db.prepare('SELECT name FROM Driver').get().name).toBe('Fixture Driver');
  expect(db.prepare('SELECT motor,gearRatio FROM Car').get()).toEqual({ motor: 'Fixture motor', gearRatio: '9 / 27' });
  expect(fs.readdirSync(path.join(uploads, 'cars'))).toHaveLength(1);
  expect(readCockpitArchive(db).records).toHaveLength(2);
  expect(db.prepare('SELECT count(*) n FROM Lap').get().n).toBe(0);
  expect(db.prepare('SELECT count(*) n FROM Session').get().n).toBe(0);
  expect((await request(app).get(`/api/data/download/${result.body.previous}`)).status).toBe(200);
  expect((await commit(p.body.id)).status).toBe(400);
  const repeat = await preview();
  expect(repeat.body.summary.counts).toEqual({ drivers: 0, cars: 0, tracks: 0, technology: 0, history: 0 });
  expect((await commit(repeat.body.id)).status).toBe(400);
  expect(fs.readdirSync(backups)).toHaveLength(1);
});
test('malformed ZIPs and options are rejected without writes', async () => {
  expect(
    (await request(app).post('/api/data/cockpit/preview').attach('file', Buffer.from('not a zip'), 'invalid.zip'))
      .status
  ).toBe(400);
  expect(
    (await request(app).post('/api/data/cockpit/preview').field('options', '{broken').attach('file', fixture)).status
  ).toBe(400);
  expect((await request(app).post('/api/data/cockpit/preview')).status).toBe(400);
  expect(db.prepare('SELECT count(*) n FROM Car').get().n).toBe(0);
});
test('active sessions, expired previews, cross-origin requests and changed targets reject import', async () => {
  active = true;
  expect((await preview()).status).toBe(400);
  active = false;
  const p = await preview();
  expect(p.status).toBe(200);
  active = true;
  expect((await commit(p.body.id)).status).toBe(400);
  active = false;
  expect((await commit('missing')).status).toBe(400);
  expect(
    (
      await request(app)
        .post('/api/data/cockpit/import')
        .set('Origin', 'https://example.invalid')
        .send({ id: p.body.id, confirmed: true })
    ).status
  ).toBe(403);
  db.prepare('INSERT INTO Driver(id,name,createdAt,updatedAt) VALUES(?,?,?,?)').run(
    'existing',
    'Fixture Driver',
    Date.now(),
    Date.now()
  );
  const changed = await commit(p.body.id);
  expect(changed.status).toBe(400);
  expect(changed.body.error).toMatch(/seit der Vorschau/);
  expect(fs.existsSync(backups)).toBe(false);
});
test('sections can be deselected and inactive entries explicitly included', async () => {
  const p = await preview({
    cars: false,
    tracks: false,
    history: false,
    technology: false,
    maintenance: false,
    includeInactive: true,
  });
  expect(p.status).toBe(200);
  expect(p.body.summary.counts).toEqual({ drivers: 2, cars: 0, tracks: 0, technology: 0, history: 0 });
  expect((await commit(p.body.id)).status).toBe(200);
  expect(db.prepare('SELECT count(*) n FROM Driver').get().n).toBe(2);
  expect(db.prepare('SELECT count(*) n FROM Car').get().n).toBe(0);
});
test('backup failure prevents database and image writes', async () => {
  fs.writeFileSync(backups, 'not a directory');
  try {
    const p = await preview();
    expect(p.status).toBe(200);
    expect((await commit(p.body.id)).status).toBe(400);
    expect(db.prepare('SELECT count(*) n FROM Car').get().n).toBe(0);
    expect(fs.existsSync(uploads)).toBe(false);
  } finally {
    fs.rmSync(backups, { force: true });
  }
});
test('ambiguous image basenames are rejected rather than importing a wrong photo', () => {
  const duplicate = path.join(root, 'duplicate-images.zip');
  fs.copyFileSync(fixture, duplicate);
  execFileSync('python3', [
    '-c',
    "import zipfile,sys; z=zipfile.ZipFile(sys.argv[1],'a'); z.writestr('other/Bilder/car.png',b'other image'); z.close()",
    duplicate,
  ]);
  expect(() => execFileSync('python3', [converter, duplicate], { stdio: 'pipe' })).toThrow();
});
