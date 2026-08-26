import fs from 'fs';
import { fileURLToPath } from 'url';
import { getDatabaseUrl } from '../lib/database-url.js';

/** Remove the throwaway test database created by globalSetup. */
export default function globalTeardown() {
  const dbPath = fileURLToPath(getDatabaseUrl());
  if (!dbPath.endsWith('test.db')) return;

  for (const suffix of ['', '-wal', '-shm']) {
    fs.rmSync(dbPath + suffix, { force: true });
  }
}
