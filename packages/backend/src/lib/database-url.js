import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const prismaDir = path.join(backendDir, 'prisma');

/**
 * Preserve Prisma 6's SQLite behavior: relative file URLs in DATABASE_URL
 * were resolved from the directory containing schema.prisma.
 */
export function getDatabaseUrl() {
  const configuredUrl = process.env.DATABASE_URL || 'file:./dev.db';

  if (!configuredUrl.startsWith('file:./')) {
    return configuredUrl;
  }

  const relativePath = configuredUrl.slice('file:'.length);
  return pathToFileURL(path.resolve(prismaDir, relativePath)).href;
}
