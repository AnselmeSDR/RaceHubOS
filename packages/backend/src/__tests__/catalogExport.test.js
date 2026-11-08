import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { catalogExport, catalogImportBundle, storeCatalogImages } from '../lib/catalog.js';

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
  'base64'
);
const entry = { serial: 'Own / reference ü', brand: 'Own brand', model: 'Own car', img: '/api/img/cars/own.png' };

test('portable export restores shared image bytes in a fresh directory without overwriting photos', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'catalog-export-'));
  try {
    const source = path.join(root, 'source');
    const target = path.join(root, 'target');
    fs.mkdirSync(source);
    fs.writeFileSync(path.join(source, 'own.png'), png);
    const payload = JSON.parse(
      catalogExport(
        [
          { ...entry, createdAt: 'internal' },
          { ...entry, serial: 'SECOND' },
        ],
        source
      )
    );
    expect(payload.entries).toHaveLength(2);
    expect(Object.keys(payload.images)).toEqual([entry.img]);
    expect(payload.entries[0]).not.toHaveProperty('createdAt');
    fs.rmSync(source, { recursive: true });
    const imported = catalogImportBundle(payload);
    storeCatalogImages(imported.images, target);
    const filename = path.basename(imported.entries[0].img);
    expect(imported.entries[0].img).toBe(imported.entries[1].img);
    expect(fs.readFileSync(path.join(target, filename))).toEqual(png);
    storeCatalogImages(imported.images, target);
    expect(fs.readdirSync(target)).toEqual([filename]);
    fs.writeFileSync(path.join(target, filename), 'Existing photo');
    expect(() => storeCatalogImages(imported.images, target)).toThrow();
    expect(fs.readFileSync(path.join(target, filename), 'utf8')).toBe('Existing photo');
    expect(fs.readdirSync(target)).toEqual([filename]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('portable bundles reject missing, unused, traversing, oversized and invalid image data', () => {
  const payload = { version: 2, entries: [entry], images: { [entry.img]: png.toString('base64') } };
  for (const images of [
    {},
    { '../escape.png': png.toString('base64') },
    { [entry.img]: png.toString('base64'), '/api/img/cars/unused.png': png.toString('base64') },
    { [entry.img]: 'not base64' },
    { [entry.img]: Buffer.from('not a png').toString('base64') },
    { [entry.img]: Buffer.alloc(5 * 1024 * 1024 + 1).toString('base64') },
  ])
    expect(() => catalogImportBundle({ ...payload, images })).toThrow();
  expect(() => catalogImportBundle({ ...payload, entries: [entry, entry] })).toThrow('Duplicate');
  expect(() =>
    catalogExport(Array.from({ length: 1001 }, (_, index) => ({ ...entry, serial: String(index) })))
  ).toThrow();
  expect(() => catalogExport([entry], os.tmpdir())).toThrow();
});

test('empty portable exports and legacy version-1 files use the same importer', () => {
  const empty = JSON.parse(catalogExport([]));
  expect(empty).toEqual({ version: 2, entries: [], images: {} });
  expect(catalogImportBundle(empty)).toEqual({ entries: [], images: [] });
  const legacy = catalogImportBundle({ version: 1, entries: [entry] });
  expect(legacy.entries[0]).toMatchObject(entry);
  expect(legacy.images).toEqual([]);
});
