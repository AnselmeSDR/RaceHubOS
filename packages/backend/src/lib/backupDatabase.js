import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import { getDatabaseUrl } from './database-url.js';

const BACKUP_DIR_NAME = 'db-old';
const DEFAULT_KEEP = 10;

/** 2026-08-26_18-42-07 — sortable, filesystem-safe on Windows. */
function timestamp(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}_` +
    `${p(date.getHours())}-${p(date.getMinutes())}-${p(date.getSeconds())}`;
}

/**
 * Snapshot the database into prisma/db-old/ before a risky operation
 * (update, schema push). Uses VACUUM INTO so the copy stays consistent
 * even while the server is running with WAL enabled.
 *
 * @returns {string|null} path of the backup, or null if there is no database yet
 */
export function backupDatabase({ reason = 'backup', keep = DEFAULT_KEEP } = {}) {
  const dbPath = fileURLToPath(getDatabaseUrl());
  if (!fs.existsSync(dbPath)) return null;

  const backupDir = path.join(path.dirname(dbPath), BACKUP_DIR_NAME);
  fs.mkdirSync(backupDir, { recursive: true });

  const safeReason = reason.replace(/[^a-z0-9-]/gi, '-');
  const target = path.join(backupDir, `${timestamp()}_${safeReason}.db`);

  const db = new Database(dbPath, { readonly: true });
  try {
    // VACUUM INTO refuses to overwrite, so the target is always fresh.
    // The path must be a SQL string literal: single quotes, doubled inside.
    db.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
  } finally {
    db.close();
  }

  pruneBackups(backupDir, keep);
  return target;
}

/** Keep only the most recent `keep` backups. */
function pruneBackups(backupDir, keep) {
  if (!keep || keep < 1) return;

  const backups = fs.readdirSync(backupDir)
    .filter((f) => f.endsWith('.db'))
    .sort()
    .reverse();

  for (const stale of backups.slice(keep)) {
    fs.rmSync(path.join(backupDir, stale), { force: true });
  }
}
