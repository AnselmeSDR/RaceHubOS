import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  SESSION_TYPES,
  STANDARD_SESSION_TYPES,
  SessionType,
  isSessionType,
  sessionTypeFullKey,
  sessionTypeKey,
} from '@racehubos/shared';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const localesDir = path.join(rootDir, 'packages/frontend/src/i18n/locales');

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf-8'));

/**
 * Session types are declared three times over — the Prisma enum, the shared
 * module, the translations — and nothing but these tests keeps them in step.
 * "balancing" was in the database for months before it reached the statistics
 * filter, because every list of types was written out by hand.
 */
describe('session types', () => {
  it('matches the enum declared in schema.prisma', () => {
    const schema = fs.readFileSync(path.join(rootDir, 'packages/backend/prisma/schema.prisma'), 'utf-8');
    const block = schema.match(/enum SessionType \{([^}]*)\}/);
    expect(block).not.toBeNull();

    const declared = block[1].split('\n').map((l) => l.trim()).filter(Boolean);
    expect(declared.sort()).toEqual([...SESSION_TYPES].sort());
  });

  it('keeps balancing out of the types offered when setting up a race', () => {
    // It has its own screen, belongs to no championship and has no standings
    expect(STANDARD_SESSION_TYPES).not.toContain(SessionType.BALANCING);
    expect(SESSION_TYPES).toContain(SessionType.BALANCING);
    for (const type of STANDARD_SESSION_TYPES) {
      expect(SESSION_TYPES).toContain(type);
    }
  });

  it('recognises its own values and nothing else', () => {
    for (const type of SESSION_TYPES) expect(isSessionType(type)).toBe(true);
    expect(isSessionType('inexistant')).toBe(false);
    expect(isSessionType(undefined)).toBe(false);
  });

  it.each(['fr', 'en'])('has a short and a full label in %s for every type', (locale) => {
    const glossary = readJson(path.join(localesDir, locale, 'glossary.json'));

    for (const type of SESSION_TYPES) {
      expect(glossary.sessionType?.[type]).toBeTruthy();
      expect(glossary.sessionTypeFull?.[type]).toBeTruthy();
    }
  });

  it('builds keys the translations actually hold', () => {
    const glossary = readJson(path.join(localesDir, 'fr', 'glossary.json'));

    // The helpers prefix with the namespace, which the files themselves do not
    expect(sessionTypeKey(SessionType.RACE)).toBe('glossary:sessionType.race');
    expect(sessionTypeFullKey(SessionType.RACE)).toBe('glossary:sessionTypeFull.race');
    expect(glossary.sessionType.race).toBeTruthy();
  });
});
