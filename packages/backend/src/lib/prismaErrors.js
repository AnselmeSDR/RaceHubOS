/**
 * Reading Prisma's unique-constraint errors.
 *
 * Prisma 6 exposed the offending columns as `error.meta.target = ['number']`.
 * With the Prisma 7 driver adapter that field is gone, and the information now
 * sits under `meta.driverAdapterError.cause.constraint.fields`. Both shapes are
 * handled so the error messages stay accurate.
 */

/** @returns {string[]} the columns that violated a unique constraint */
export function uniqueConstraintFields(error) {
  const target = error?.meta?.target;
  if (Array.isArray(target)) return target;
  if (typeof target === 'string') return [target];

  const fields = error?.meta?.driverAdapterError?.cause?.constraint?.fields;
  if (Array.isArray(fields)) return fields;

  return [];
}

/** True when `error` is a unique-constraint violation on `field`. */
export function violatesUnique(error, field) {
  return error?.code === 'P2002' && uniqueConstraintFields(error).includes(field);
}
