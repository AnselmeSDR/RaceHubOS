import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

const migrationsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../prisma/migrations');
const MIGRATION = '20261112120000_divisions_replace_teams';
const sqlOf = (name) => fs.readFileSync(path.join(migrationsDir, name, 'migration.sql'), 'utf-8');
const before = fs
  .readdirSync(migrationsDir)
  .filter((name) => name < MIGRATION && fs.existsSync(path.join(migrationsDir, name, 'migration.sql')))
  .sort();

let workDir;
let db;

/** A database as every install had it before divisions: all the earlier migrations. */
beforeEach(() => {
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'racehubos-divisions-'));
  db = new Database(path.join(workDir, 'test.db'));
  for (const name of before) db.exec(sqlOf(name));
});
afterEach(() => {
  db.close();
  fs.rmSync(workDir, { recursive: true, force: true });
});

const rows = (sql) => db.prepare(sql).all();
const DAY = 86_400_000;

test('each team becomes a driver division with its logo, drivers and add-on fields; the cars get categories', () => {
  const insert = (sql, ...values) => db.prepare(sql).run(...values);
  const team = (id, name, extra = {}) =>
    insert(
      'INSERT INTO Team (id, name, color, img, deletedAt, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
      id,
      name,
      extra.color ?? null,
      extra.img ?? null,
      extra.deletedAt ?? null,
      DAY,
      2 * DAY
    );
  team('t-silver', 'SILVER', { color: '#c4c4c4', img: '/api/img/teams/silver.png' });
  team('t-gold', 'GOLD', { color: '#f5d13c' });
  team('t-old', 'AAA', { deletedAt: 3 * DAY });
  const driver = (id, name, teamId) =>
    insert('INSERT INTO Driver (id, name, teamId, updatedAt) VALUES (?, ?, ?, ?)', id, name, teamId, DAY);
  driver('ana', 'Ana', 't-gold');
  driver('ben', 'Ben', null);
  insert('INSERT INTO TeamExtra (teamId, addon, data, updatedAt) VALUES (?, ?, ?, ?)', 't-gold', 'cup', '{"a":1}', DAY);

  db.exec(sqlOf(MIGRATION));

  expect(
    rows('SELECT id, name, color, img, "order", deletedAt, createdAt FROM Division WHERE scope = \'driver\'')
  ).toEqual(
    expect.arrayContaining([
      { id: 't-gold', name: 'GOLD', color: '#f5d13c', img: null, order: 1, deletedAt: null, createdAt: DAY },
      {
        id: 't-silver',
        name: 'SILVER',
        color: '#c4c4c4',
        img: '/api/img/teams/silver.png',
        order: 2,
        deletedAt: null,
        createdAt: DAY,
      },
      // In the bin last, without a color the default one
      { id: 't-old', name: 'AAA', color: '#6B7280', img: null, order: 3, deletedAt: 3 * DAY, createdAt: DAY },
    ])
  );
  // Teams existed: no starting divisions on top of them
  expect(rows("SELECT COUNT(*) AS n FROM Division WHERE scope = 'driver'")).toEqual([{ n: 3 }]);
  expect(rows('SELECT driverId, divisionId FROM DriverDivision')).toEqual([{ driverId: 'ana', divisionId: 't-gold' }]);
  expect(rows('SELECT divisionId, addon, data FROM DivisionExtra')).toEqual([
    { divisionId: 't-gold', addon: 'cup', data: '{"a":1}' },
  ]);
  expect(rows('SELECT name FROM Division WHERE scope = \'car\' ORDER BY "order"').map((r) => r.name)).toEqual([
    'GT3',
    'GTE',
    'DTM',
    'Formule',
    'Classique',
  ]);
  expect(rows("SELECT name FROM sqlite_master WHERE name IN ('Team', 'TeamExtra')")).toEqual([]);
  expect(rows('PRAGMA table_info(Driver)').map((c) => c.name)).not.toContain('teamId');
  expect(rows('SELECT name FROM Driver ORDER BY name').map((r) => r.name)).toEqual(['Ana', 'Ben']);
});

test('without any team, a database starts with the PLATINIUM to BRONZE divisions, dated in milliseconds', () => {
  db.exec(sqlOf(MIGRATION));

  const divisions = rows('SELECT name, "order", typeof(createdAt) AS stored FROM Division WHERE scope = \'driver\'');
  expect(divisions.sort((a, b) => a.order - b.order)).toEqual([
    { name: 'PLATINIUM', order: 1, stored: 'integer' },
    { name: 'GOLD', order: 2, stored: 'integer' },
    { name: 'SILVER', order: 3, stored: 'integer' },
    { name: 'BRONZE', order: 4, stored: 'integer' },
  ]);
  const [{ createdAt }] = rows('SELECT createdAt FROM Division LIMIT 1');
  expect(Math.abs(createdAt - Date.now())).toBeLessThan(DAY);
});
