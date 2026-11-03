import { CAR_SPECS, CAR_TEXT_SPECS, CAR_NUMBER_SPECS } from '@racehubos/shared';

export const CATALOG_FIELDS = ['serial', 'brand', 'model', 'year', 'img', ...CAR_SPECS];

/** Strict, versioned import: validate the entire file before writing any row. */
export function catalogEntry(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid catalog entry');
  for (const key of Object.keys(input)) {
    if (!CATALOG_FIELDS.includes(key)) throw new Error(`Unknown catalog field: ${key}`);
  }
  const data = {};
  for (const key of ['serial', 'brand', 'model', 'img', ...CAR_TEXT_SPECS]) {
    const value = input[key];
    if (value != null && typeof value !== 'string') throw new Error(`Invalid text field: ${key}`);
    if (value?.length > 10000) throw new Error(`Text field too long: ${key}`);
    data[key] = value?.trim() || null;
  }
  for (const key of ['serial', 'brand', 'model']) {
    if (!data[key]) throw new Error(`Required catalog field: ${key}`);
  }
  // Never load remote images or filesystem paths from imported metadata.
  if (data.img && !/^\/api\/img\/cars\/[a-zA-Z0-9_-]+\.(png|jpe?g|webp|gif)$/.test(data.img)) {
    throw new Error('Catalog images must be local car uploads');
  }
  for (const key of ['year', ...CAR_NUMBER_SPECS]) {
    const value = input[key];
    if (value == null || value === '') data[key] = null;
    else {
      if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`Invalid number field: ${key}`);
      if (['year', 'weightGrams'].includes(key) && !Number.isInteger(value))
        throw new Error(`Invalid integer field: ${key}`);
      data[key] = value;
    }
  }
  return data;
}

export function catalogImport(input) {
  if (input?.version !== 1 || !Array.isArray(input.entries) || input.entries.length > 1000) {
    throw new Error('Expected version 1 and at most 1000 catalog entries');
  }
  const entries = input.entries.map(catalogEntry);
  if (new Set(entries.map((entry) => entry.serial)).size !== entries.length)
    throw new Error('Duplicate catalog serial');
  return entries;
}
