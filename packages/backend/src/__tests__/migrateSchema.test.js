import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { migrateSchema } from '../lib/migrateSchema.js';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const migrationsDir = path.join(backendDir, 'prisma', 'migrations');

const migrationNames = () => fs.readdirSync(migrationsDir)
  .filter((name) => fs.existsSync(path.join(migrationsDir, name, 'migration.sql')))
  .sort();

/** A disposable database with the first `count` migrations replayed by hand. */
function fixture(dbPath, count) {
  const db = new Database(dbPath);
  for (const name of migrationNames().slice(0, count)) {
    db.exec(fs.readFileSync(path.join(migrationsDir, name, 'migration.sql'), 'utf-8'));
  }
  return db;
}

const historyOf = (dbPath) => {
  const db = new Database(dbPath, { readonly: true });
  try {
    return db.prepare('SELECT migration_name FROM _prisma_migrations').all().map((r) => r.migration_name);
  } catch {
    return null; // no _prisma_migrations table at all
  } finally {
    db.close();
  }
};

const hasColumn = (dbPath, table, column) => {
  const db = new Database(dbPath, { readonly: true });
  try {
    return db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === column);
  } finally {
    db.close();
  }
};

/**
 * The race PC and every other install predate `migrate deploy`: their schema was
 * kept current by `db push`, which writes no migration history. Prisma refuses
 * to deploy onto such a database (P3005), so migrateSchema baselines it first —
 * and must decide what to baseline from the schema, never from the history.
 */
describe('migrateSchema', () => {
  const originalUrl = process.env.DATABASE_URL;
  let workDir;
  let dbPath;

  beforeEach(() => {
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'racehubos-migrate-test-'));
    dbPath = path.join(workDir, 'fixture.db');
    process.env.DATABASE_URL = `file:${dbPath}`;
  });

  afterEach(() => {
    process.env.DATABASE_URL = originalUrl;
    fs.rmSync(workDir, { recursive: true, force: true });
  });

  it('applies every migration to a brand new database without baselining', () => {
    const result = migrateSchema();

    expect(result.baselined).toEqual([]);
    expect(historyOf(dbPath)).toEqual(migrationNames());
  }, 120000);

  it('baselines a database left current by db push, keeping its data', () => {
    const db = fixture(dbPath, migrationNames().length);
    db.prepare('INSERT INTO Driver (id, name, createdAt, updatedAt) VALUES (?, ?, 0, 0)').run('t1', 'Témoin');
    db.close();
    expect(historyOf(dbPath)).toBeNull();

    const result = migrateSchema();

    expect(result.baselined).toEqual(migrationNames());
    expect(historyOf(dbPath)).toEqual(migrationNames());
    const kept = new Database(dbPath, { readonly: true });
    expect(kept.prepare('SELECT name FROM Driver WHERE id = ?').get('t1').name).toBe('Témoin');
    kept.close();
  }, 120000);

  it('baselines only what an outdated database contains, then migrates the rest', () => {
    const db = fixture(dbPath, 1);
    db.prepare('INSERT INTO Driver (id, name, createdAt, updatedAt) VALUES (?, ?, 0, 0)').run('t2', 'Témoin');
    db.close();
    expect(hasColumn(dbPath, 'Driver', 'deletedAt')).toBe(false);

    const result = migrateSchema();

    // Only the migration the database already held is marked as applied;
    // the others genuinely run, which is the whole point of the switch
    expect(result.baselined).toEqual(migrationNames().slice(0, 1));
    expect(historyOf(dbPath)).toEqual(migrationNames());
    expect(hasColumn(dbPath, 'Driver', 'deletedAt')).toBe(true);
    const kept = new Database(dbPath, { readonly: true });
    expect(kept.prepare('SELECT name FROM Driver WHERE id = ?').get('t2').name).toBe('Témoin');
    kept.close();
  }, 120000);

  it('does nothing on a database whose history is already complete', () => {
    migrateSchema();

    const result = migrateSchema();

    expect(result.baselined).toEqual([]);
    expect(historyOf(dbPath)).toEqual(migrationNames());
  }, 180000);

  it('refuses to touch a database matching no known migration state', () => {
    const db = fixture(dbPath, migrationNames().length);
    db.exec('ALTER TABLE Driver DROP COLUMN deletedAt');
    db.close();

    // Half-migrating a race database is worse than not starting at all:
    // startup.js turns this into a repair prompt
    expect(() => migrateSchema()).toThrow(/P3005/);
    expect(historyOf(dbPath)).toBeNull();
  }, 120000);
});
