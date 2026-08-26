import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '@prisma/client';
import { getDatabaseUrl } from './database-url.js';

export function createPrismaClient(options = {}) {
  const adapter = new PrismaBetterSqlite3(
    { url: getDatabaseUrl() },
    { timestampFormat: 'unixepoch-ms' },
  );

  return new PrismaClient({
    ...options,
    adapter,
  });
}
