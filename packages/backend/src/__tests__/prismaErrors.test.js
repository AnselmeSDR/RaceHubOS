import { prisma } from './setup.js';
import { uniqueConstraintFields, violatesUnique } from '../lib/prismaErrors.js';

describe('unique constraint errors', () => {
  it('reads the columns from a real Prisma 7 violation', async () => {
    await prisma.driver.create({ data: { name: 'Premier', number: 42 } });

    let error;
    try {
      await prisma.driver.create({ data: { name: 'Second', number: 42 } });
    } catch (err) {
      error = err;
    }

    expect(error?.code).toBe('P2002');
    // Prisma 7's driver adapter no longer fills meta.target
    expect(error.meta?.target).toBeUndefined();
    expect(uniqueConstraintFields(error)).toEqual(['number']);
    expect(violatesUnique(error, 'number')).toBe(true);
    expect(violatesUnique(error, 'email')).toBe(false);
  });

  it('still understands the Prisma 6 shape', () => {
    const legacy = { code: 'P2002', meta: { target: ['email'] } };
    expect(uniqueConstraintFields(legacy)).toEqual(['email']);
    expect(violatesUnique(legacy, 'email')).toBe(true);
  });

  it('tolerates a bare string target', () => {
    expect(uniqueConstraintFields({ code: 'P2002', meta: { target: 'email' } })).toEqual(['email']);
  });

  it('returns nothing when the error carries no constraint', () => {
    expect(uniqueConstraintFields({ code: 'P2025' })).toEqual([]);
    expect(uniqueConstraintFields(undefined)).toEqual([]);
    expect(violatesUnique({ code: 'P2025' }, 'number')).toBe(false);
  });
});
