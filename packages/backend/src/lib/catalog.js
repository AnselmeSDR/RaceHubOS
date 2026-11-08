import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
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
  if (![1, 2].includes(input?.version) || !Array.isArray(input.entries) || input.entries.length > 1000) {
    throw new Error('Expected version 1 or 2 and at most 1000 catalog entries');
  }
  if (Buffer.byteLength(JSON.stringify(input), 'utf8') > (input.version === 1 ? 1 : 50) * 1024 * 1024)
    throw new Error('Catalog import too large');
  const entries = input.entries.map(catalogEntry);
  if (new Set(entries.map((entry) => entry.serial)).size !== entries.length)
    throw new Error('Duplicate catalog serial');
  return entries;
}

export const CATALOG_IMAGE_DIR = new URL('../../public/uploads/cars/', import.meta.url);
const imagePattern = /^\/api\/img\/cars\/([a-zA-Z0-9_-]+\.(png|jpe?g|webp|gif))$/;

function imageBuffer(encoded, extension) {
  if (typeof encoded !== 'string' || !encoded.length || encoded.length > 7 * 1024 * 1024)
    throw new Error('Invalid catalog image');
  const data = Buffer.from(encoded, 'base64');
  if (data.toString('base64') !== encoded || data.length > 5 * 1024 * 1024)
    throw new Error('Invalid catalog image size or encoding');
  const hex = data.subarray(0, 12).toString('hex');
  const valid =
    extension === 'png'
      ? hex.startsWith('89504e470d0a1a0a')
      : ['jpg', 'jpeg'].includes(extension)
        ? hex.startsWith('ffd8ff')
        : extension === 'gif'
          ? ['GIF87a', 'GIF89a'].includes(data.subarray(0, 6).toString())
          : data.subarray(0, 4).toString() === 'RIFF' && data.subarray(8, 12).toString() === 'WEBP';
  if (!valid) throw new Error('Invalid catalog image format');
  return data;
}

/** Validate all metadata and images before creating files or updating the database. */
export function catalogImportBundle(input) {
  const entries = catalogImport(input);
  if (input.version === 1) return { entries, images: [] };
  if (!input.images || typeof input.images !== 'object' || Array.isArray(input.images))
    throw new Error('Expected embedded catalog images');
  const refs = new Set(entries.map((entry) => entry.img).filter(Boolean));
  const images = [];
  const replacements = new Map();
  for (const [ref, encoded] of Object.entries(input.images)) {
    const match = ref.match(imagePattern);
    if (!match || !refs.has(ref)) throw new Error('Invalid or unused catalog image path');
    const data = imageBuffer(encoded, match[2]);
    const filename = `catalog-import-${createHash('sha256').update(data).digest('hex')}.${match[2]}`;
    replacements.set(ref, `/api/img/cars/${filename}`);
    images.push({ filename, data });
  }
  for (const entry of entries) {
    if (!entry.img) continue;
    if (!replacements.has(entry.img)) throw new Error('Missing embedded catalog image');
    entry.img = replacements.get(entry.img);
  }
  return { entries, images };
}

export function storeCatalogImages(images, directory = CATALOG_IMAGE_DIR) {
  fs.mkdirSync(directory, { recursive: true });
  for (const { filename, data } of images) {
    const destination = path.join(typeof directory === 'string' ? directory : fileURLToPath(directory), filename);
    const temporary = `${destination}.${randomUUID()}.tmp`;
    try {
      fs.writeFileSync(temporary, data, { flag: 'wx' });
      try {
        fs.linkSync(temporary, destination);
      } catch (error) {
        if (error.code !== 'EEXIST' || !fs.readFileSync(destination).equals(data)) throw error;
      }
    } finally {
      fs.rmSync(temporary, { force: true });
    }
  }
}

/** Full and single-entry downloads share one portable, versioned import format. */
export function catalogExport(rows, directory = CATALOG_IMAGE_DIR) {
  const entries = catalogImport({
    version: 2,
    entries: rows.map((row) => Object.fromEntries(CATALOG_FIELDS.map((key) => [key, row[key]]))),
  });
  const images = Object.create(null);
  let totalBytes = 0;
  for (const entry of entries) {
    if (!entry.img || images[entry.img]) continue;
    const match = entry.img.match(imagePattern);
    const source = path.join(typeof directory === 'string' ? directory : fileURLToPath(directory), match[1]);
    const size = fs.statSync(source).size;
    totalBytes += Math.ceil(size / 3) * 4;
    if (size > 5 * 1024 * 1024 || totalBytes > 50 * 1024 * 1024) throw new Error('Catalog images too large');
    const data = fs.readFileSync(source);
    const encoded = data.toString('base64');
    imageBuffer(encoded, match[2]);
    images[entry.img] = encoded;
  }
  const json = JSON.stringify({ version: 2, entries, images }, null, 2) + '\n';
  if (Buffer.byteLength(json, 'utf8') > 50 * 1024 * 1024)
    throw new Error('Catalog export exceeds the 50 MiB import limit');
  return json;
}
