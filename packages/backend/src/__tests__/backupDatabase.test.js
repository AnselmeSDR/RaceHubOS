import { jest } from '@jest/globals';
import fs from 'fs';
import os from 'os';
import path from 'path';
import Database from 'better-sqlite3';
import { backupDatabase } from '../lib/backupDatabase.js';

// Never the real prisma/db-old/: the database lives in a temporary folder (a quote in its name)
const previousUrl = process.env.DATABASE_URL;
let dir, backups;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "racehubos-o'backup-"));
  backups = path.join(dir, 'db-old');
  process.env.DATABASE_URL = `file:${path.join(dir, 'race.db')}`;
});
afterEach(() => {
  process.env.DATABASE_URL = previousUrl;
  fs.rmSync(dir, { recursive: true, force: true });
});

function createDatabase() {
  const db = new Database(path.join(dir, 'race.db'));
  db.exec("CREATE TABLE driver (name TEXT); INSERT INTO driver VALUES ('Ana');");
  db.close();
}

test('no database yet, no backup', () => {
  expect(backupDatabase()).toBeNull();
  expect(fs.existsSync(backups)).toBe(false);
});

test('a dated, readable copy in db-old/, named after its reason', () => {
  createDatabase();
  const target = backupDatabase({ reason: "addon car/service's" });
  expect(path.dirname(target)).toBe(backups);
  expect(path.basename(target)).toMatch(/^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}_addon-car-service-s\.db$/);
  const copy = new Database(target, { readonly: true });
  expect(copy.prepare('SELECT name FROM driver').all()).toEqual([{ name: 'Ana' }]);
  copy.close();
});

test('only the latest backups are kept, other files untouched', () => {
  createDatabase();
  fs.mkdirSync(backups);
  for (let day = 1; day <= 5; day++) fs.writeFileSync(path.join(backups, `2020-01-0${day}_00-00-00_old.db`), '');
  fs.writeFileSync(path.join(backups, '2020-01-01_00-00-00_old.addons-data'), '');

  const target = backupDatabase({ keep: 3 });
  expect(fs.readdirSync(backups).sort()).toEqual([
    '2020-01-01_00-00-00_old.addons-data',
    '2020-01-04_00-00-00_old.db',
    '2020-01-05_00-00-00_old.db',
    path.basename(target),
  ]);

  backupDatabase({ keep: 0 });
  expect(fs.readdirSync(backups).filter((f) => f.endsWith('.db'))).toHaveLength(4);
});

test('two backups within the same second are both kept', () => {
  createDatabase();
  jest.useFakeTimers({ now: new Date(2026, 10, 9, 18, 30, 5), doNotFake: ['setImmediate', 'nextTick'] });
  try {
    const files = [1, 2, 3].map(() => path.basename(backupDatabase({ reason: 'update' })));
    expect(files).toEqual([
      '2026-11-09_18-30-05_update.db',
      '2026-11-09_18-30-05_update-2.db',
      '2026-11-09_18-30-05_update-3.db',
    ]);
  } finally {
    jest.useRealTimers();
  }
});
