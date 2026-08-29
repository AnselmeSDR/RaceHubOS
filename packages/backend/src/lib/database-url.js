import path from 'path';
import { fileURLToPath } from 'url';

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const prismaDir = path.join(backendDir, 'prisma');

/**
 * Resolve DATABASE_URL to a native filesystem path.
 *
 * Preserves Prisma 6's SQLite behavior: a relative file URL (file:./dev.db)
 * is resolved from the directory holding schema.prisma. Absolute forms are
 * accepted too, whether written as a real URL (file:///C:/…) or as the plain
 * path form Prisma's engine expects (file:C:\…).
 *
 * @returns {string|null} native path, or null when the URL is not a file
 */
export function getDatabasePath() {
  const configured = process.env.DATABASE_URL || 'file:./dev.db';
  if (!configured.startsWith('file:')) return null;

  const raw = configured.slice('file:'.length);
  // file://… is a real URL and must be decoded as such
  if (raw.startsWith('//')) return fileURLToPath(configured);

  return path.resolve(prismaDir, raw);
}

/**
 * The URL handed to Prisma.
 *
 * Deliberately `file:<native path>` rather than a file:// URL: pathToFileURL()
 * yields file:///C:/… on Windows, which the schema engine rejects with
 * "os error 161" — it wants the native path form.
 */
export function getDatabaseUrl() {
  const dbPath = getDatabasePath();
  return dbPath ? `file:${dbPath}` : process.env.DATABASE_URL;
}
