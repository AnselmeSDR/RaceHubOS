import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import { getDatabaseUrl } from '../lib/database-url.js';

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * Build a throwaway test database from the current schema on every run.
 * The SQL comes from `prisma migrate diff`, so the test schema can never
 * drift from schema.prisma, and no existing database is ever touched.
 */
export default function globalSetup() {
  const dbPath = fileURLToPath(getDatabaseUrl());
  if (!dbPath.endsWith('test.db')) {
    throw new Error(`Refusing to build a test database at ${dbPath} — expected a path ending in test.db`);
  }

  for (const suffix of ['', '-wal', '-shm']) {
    fs.rmSync(dbPath + suffix, { force: true });
  }

  const sqlFile = path.join(backendDir, 'prisma', '.test-schema.sql');
  execFileSync('npx', ['prisma', 'migrate', 'diff', '--from-empty', '--to-schema', 'prisma/schema.prisma', '--script', '--output', sqlFile], {
    cwd: backendDir,
    stdio: 'pipe',
  });

  const db = new Database(dbPath);
  try {
    db.exec(fs.readFileSync(sqlFile, 'utf-8'));
  } finally {
    db.close();
    fs.rmSync(sqlFile, { force: true });
  }
}
