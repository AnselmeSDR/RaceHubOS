import { execFileSync } from 'child_process';
import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDatabasePath, getDatabaseUrl } from './database-url.js';

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const migrationsDir = path.join(backendDir, 'prisma', 'migrations');

// The URL is passed explicitly: prisma.config.js loads .env, and a stale entry
// there would otherwise decide which database gets migrated
const run = (args) => execFileSync('npx', args, {
  cwd: backendDir,
  encoding: 'utf-8',
  stdio: 'pipe',
  env: { ...process.env, DATABASE_URL: getDatabaseUrl() },
});

/** Migrations present on disk, oldest first. */
function migrationsOnDisk() {
  if (!fs.existsSync(migrationsDir)) return [];
  return fs.readdirSync(migrationsDir)
    .filter((name) => fs.existsSync(path.join(migrationsDir, name, 'migration.sql')))
    .sort();
}

/** Migrations the database already declares as applied. */
function migrationsApplied() {
  const dbPath = getDatabasePath();
  if (!dbPath || !fs.existsSync(dbPath)) return [];

  try {
    // Loaded lazily: a native module, and absent during some tooling runs
    const Database = createRequire(import.meta.url)('better-sqlite3');
    const db = new Database(dbPath, { readonly: true });
    try {
      return db.prepare('SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL')
        .all().map((r) => r.migration_name);
    } finally {
      db.close();
    }
  } catch {
    return [];
  }
}

/** True when replaying `names` would produce exactly the live database. */
function migrationsMatchDatabase(names) {
  const staging = fs.mkdtempSync(path.join(os.tmpdir(), 'racehubos-baseline-'));
  try {
    // migration_lock.toml tells Prisma which connector the directory targets
    fs.cpSync(path.join(migrationsDir, 'migration_lock.toml'), path.join(staging, 'migration_lock.toml'));
    for (const name of names) {
      fs.cpSync(path.join(migrationsDir, name), path.join(staging, name), { recursive: true });
    }
    const diff = run(['prisma', 'migrate', 'diff', '--from-migrations', staging, '--to-config-datasource', '--script']);
    return /empty migration/i.test(diff);
  } catch {
    return false;
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }
}

/**
 * The longest run of migrations the database already contains, or null when
 * none does — an empty database, or a schema matching no known state.
 */
function findBaseline(onDisk) {
  for (let count = onDisk.length; count > 0; count -= 1) {
    const prefix = onDisk.slice(0, count);
    if (migrationsMatchDatabase(prefix)) return prefix;
  }
  return null;
}

/**
 * Bring the schema up to date with `prisma migrate deploy`.
 *
 * Databases predating migrations carry a partial history, or none at all —
 * `db push` never wrote one. Prisma refuses to deploy onto them (P3005), so the
 * migrations they already contain are marked as applied first. Which ones is
 * never guessed from the history: the schema itself is compared against each
 * run of migrations, and only an exact match is baselined. An empty database
 * matches nothing and simply gets every migration applied; a schema matching no
 * known state is left untouched, and the deploy fails loudly rather than
 * half-migrating a race database.
 *
 * @returns {{ baselined: string[], applied: boolean }}
 */
export function migrateSchema() {
  const onDisk = migrationsOnDisk();
  if (onDisk.length === 0) throw new Error('No migration found in prisma/migrations');

  const applied = new Set(migrationsApplied());
  const baselined = [];

  if (onDisk.some((name) => !applied.has(name))) {
    const baseline = findBaseline(onDisk) ?? [];
    for (const name of baseline.filter((name) => !applied.has(name))) {
      run(['prisma', 'migrate', 'resolve', '--applied', name]);
      baselined.push(name);
    }
  }

  run(['prisma', 'migrate', 'deploy']);
  return { baselined, applied: true };
}
