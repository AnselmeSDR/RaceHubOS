import path from 'path';
import { getDatabasePath, getDatabaseUrl } from '../lib/database-url.js';

/**
 * Windows regression: pathToFileURL() produced file:///C:/… which Prisma's
 * schema engine rejects ("os error 161"), while fileURLToPath() turned the
 * plain form back into an invalid /C:/… path. Both directions are covered.
 */
describe('database URL resolution', () => {
  const original = process.env.DATABASE_URL;
  afterEach(() => { process.env.DATABASE_URL = original; });

  it('resolves a relative URL from the prisma directory', () => {
    process.env.DATABASE_URL = 'file:./dev.db';
    const resolved = getDatabasePath();
    expect(path.isAbsolute(resolved)).toBe(true);
    expect(resolved.endsWith(path.join('prisma', 'dev.db'))).toBe(true);
  });

  it('hands Prisma the plain path form, never a file:// URL', () => {
    process.env.DATABASE_URL = 'file:./dev.db';
    const url = getDatabaseUrl();
    expect(url.startsWith('file:')).toBe(true);
    // file:///C:/… is what broke the Windows schema engine
    expect(url.startsWith('file://')).toBe(false);
    expect(url.slice('file:'.length)).toBe(getDatabasePath());
  });

  it('accepts an absolute path written in the plain form', () => {
    const absolute = path.join(path.sep, 'tmp', 'race.db');
    process.env.DATABASE_URL = `file:${absolute}`;
    expect(getDatabasePath()).toBe(absolute);
  });

  it('still understands a real file:// URL', () => {
    process.env.DATABASE_URL = 'file:///tmp/race.db';
    expect(getDatabasePath()).toBe(path.join(path.sep, 'tmp', 'race.db'));
  });

  it('leaves a non-file URL untouched', () => {
    process.env.DATABASE_URL = 'postgresql://localhost/race';
    expect(getDatabasePath()).toBeNull();
    expect(getDatabaseUrl()).toBe('postgresql://localhost/race');
  });
});
