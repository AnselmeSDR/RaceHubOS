import { hornbyImage } from './hornbyCatalogImport.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

export const CATALOG_KEY = 'carrera:catalog:v1';
export const COLLECTIONS = ['digital-124', 'digital-132', 'evolution'];
export { catalogReference as articleNumber } from '@racehubos/shared';
import { catalogReference as articleNumber } from '@racehubos/shared';
export function trustedImage(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' &&
      u.hostname === 'cdn.shopify.com' &&
      !u.username &&
      !u.password &&
      u.pathname.startsWith('/s/files/1/0944/1037/5507/')
      ? u
      : null;
  } catch {
    return null;
  }
}
const brands = [
  'Mercedes-AMG',
  'Mercedes',
  'Aston Martin',
  'Alfa Romeo',
  'De Tomaso',
  'Red Bull',
  'Volkswagen',
  'Chevrolet',
  'Lamborghini',
  'Porsche',
  'Ferrari',
  'McLaren',
  'Maserati',
  'Pontiac',
  'Plymouth',
  'Ford',
  'Dodge',
  'Shelby',
  'Lancia',
  'Toyota',
  'Nissan',
  'Peugeot',
  'Renault',
  'Opel',
  'BMW',
  'Audi',
  'VW',
  'KTM',
];
export function productEntry(product, collection) {
  const tags = Array.isArray(product?.tags) ? product.tags : [];
  if (!tags.includes('Autos') || tags.includes('Sets') || !COLLECTIONS.includes(collection)) return null;
  const number = articleNumber(product.variants?.[0]?.sku);
  if (!number || typeof product.title !== 'string' || !/^[a-z0-9-]+$/.test(product.handle || '')) return null;
  const series = tags.includes('DIGITAL 124')
    ? 'DIGITAL 124'
    : tags.includes('DIGITAL 132')
      ? 'DIGITAL 132'
      : tags.includes('EVOLUTION')
        ? 'EVOLUTION'
        : null;
  if (!series) return null;
  const title = product.title.trim().slice(0, 240);
  const brand = brands.find((b) => title.toLowerCase().includes(b.toLowerCase())) || 'Carrera';
  const imageUrl = product.images?.map((i) => i.src).find((src) => trustedImage(src)) || null;
  return {
    articleNumber: number,
    brand,
    model: title,
    scale: series === 'DIGITAL 124' ? '1:24' : '1:32',
    series,
    sourceUrl: `https://carrera-toys.com/products/${product.handle}`,
    imageUrl,
    img: null,
  };
}
async function limitedBody(response, limit) {
  if (!response.ok) throw new Error(`Carrera antwortet mit HTTP ${response.status}.`);
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > limit) throw new Error('Carrera-Datei überschreitet die Größenbegrenzung.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
export function imageExtension(bytes) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpg';
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'png';
  if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}
async function imageBytes(url, fetcher) {
  const allowed = trustedImage(url);
  if (!allowed) throw new Error('Unzulässige Bildquelle.');
  const optimized = new URL('https://carrera-toys.com/cdn/shop/' + allowed.pathname.split('/5507/')[1]);
  optimized.search = allowed.search;
  optimized.searchParams.set('width', '240');
  optimized.searchParams.set('format', 'pjpg');
  optimized.searchParams.set('quality', '70');
  allowed.searchParams.set('width', '240');
  allowed.searchParams.set('format', 'pjpg');
  let lastError;
  for (const source of [optimized, allowed]) {
    try {
      const response = await fetcher(source, {
        signal: AbortSignal.timeout(20000),
        redirect: 'error',
        headers: { Accept: 'image/webp,image/jpeg,image/png' },
      });
      const data = await limitedBody(response, 256 * 1024);
      const ext = imageExtension(data);
      if (!ext) throw new Error('Kein unterstütztes Produktbild.');
      return { data, ext };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}
export class CarreraCatalog {
  constructor({ store, uploads, fetcher = fetch, extraEntries = [], imageProvider, additionalImporter }) {
    this.additionalImporter = additionalImporter;
    this.extraEntries = extraEntries;
    this.imageProvider = imageProvider;
    this.store = store;
    this.uploads = uploads;
    this.fetcher = fetcher;
    this.job = { running: false, phase: 'idle', message: '', processed: 0, total: 0 };
  }
  async read() {
    const value = await this.store.get();
    const data =
      value?.version === 1 && Array.isArray(value.entries) ? value : { version: 1, updatedAt: null, entries: [] };
    const entries = new Map(data.entries.map((e) => [e.articleNumber, e]));
    for (const entry of this.extraEntries) {
      // Verified additional brands are bundled locally; no network request on lookup.
      if (this.imageProvider && !(await this.hasImage(entry.img))) {
        const bytes = await this.imageProvider(entry);
        if (createHash('sha256').update(bytes).digest('hex') !== entry.imageSha256)
          throw new Error('Ungültiges Katalogbild.');
        await fs.mkdir(path.join(this.uploads, 'cars'), { recursive: true });
        await fs.writeFile(path.join(this.uploads, 'cars', path.basename(entry.img)), bytes);
      }
      if (!entries.has(entry.articleNumber)) entries.set(entry.articleNumber, entry);
    }
    return { ...data, entries: [...entries.values()] };
  }
  async status() {
    const data = await this.read();
    let images = 0;
    for (const e of data.entries) if (e.img && (await this.hasImage(e.img))) images++;
    const manufacturers = {};
    for (const e of data.entries) {
      const name = e.manufacturer || 'Carrera';
      manufacturers[name] = (manufacturers[name] || 0) + 1;
    }
    return {
      ...this.job,
      manufacturers,
      verifiedMappings: data.entries.filter((e) => e.equivalence).length,
      updatedAt: data.updatedAt,
      count: data.entries.length,
      offlineImages: images,
      series: [...new Set(['DIGITAL 124', 'DIGITAL 132', 'EVOLUTION', ...data.entries.map((e) => e.series)])],
    };
  }
  async hasImage(img) {
    if (
      !/^\/api\/img\/cars\/(?:catalog-(?:200\d{5}|[CH]\d{4}[A-Z]?)-[a-f0-9]{16}\.(jpg|png|webp)|scalextric-c\d{4}-[a-f0-9]{16}\.jpg)$/.test(
        img || ''
      )
    )
      return false;
    try {
      return (await fs.stat(path.join(this.uploads, 'cars', path.basename(img)))).isFile();
    } catch {
      return false;
    }
  }
  async lookup(value) {
    const number = articleNumber(value);
    if (!number) throw new Error('Bitte eine Carrera-, Scalextric- oder Superslot-Artikelnummer eingeben.');
    const data = await this.read();
    const entry =
      data.entries.find((e) => e.articleNumber === number) || data.entries.find((e) => e.aliases?.includes(number));
    return entry ? { ...entry, img: (await this.hasImage(entry.img)) ? entry.img : null } : null;
  }
  async usedBytes() {
    let bytes = 0;
    for (const type of ['cars', 'drivers', 'tracks', 'teams']) {
      const directory = path.join(this.uploads, type);
      for (const file of await fs.readdir(directory, { withFileTypes: true }).catch(() => []))
        if (file.isFile()) bytes += (await fs.stat(path.join(directory, file.name))).size;
    }
    return bytes;
  }
  start() {
    if (this.job.running) return false;
    this.job = {
      running: true,
      phase: 'products',
      message: this.additionalImporter
        ? 'Carrera, Scalextric und Superslot werden abgerufen …'
        : 'Carrera-Modelle werden abgerufen …',
      processed: 0,
      total: 0,
    };
    this.completion = this.update()
      .catch((error) => {
        this.job.phase = 'error';
        this.job.message = `Aktualisierung fehlgeschlagen: ${error.message} Der bisherige Katalog bleibt erhalten.`;
      })
      .finally(() => {
        this.job.running = false;
      });
    return true;
  }
  async update() {
    const old = await this.read(),
      entries = new Map(old.entries.map((e) => [e.articleNumber, e])),
      found = new Map();
    for (const collection of COLLECTIONS) {
      let complete = false;
      for (let page = 1; page <= 20; page++) {
        this.job.message = `Modelle: ${collection}, Seite ${page} …`;
        const response = await this.fetcher(
          `https://carrera-toys.com/collections/${collection}/products.json?limit=250&page=${page}`,
          { signal: AbortSignal.timeout(30000), redirect: 'error', headers: { Accept: 'application/json' } }
        );
        const data = JSON.parse((await limitedBody(response, 8 * 1024 * 1024)).toString());
        if (!Array.isArray(data.products)) throw new Error('Unerwartetes Carrera-Datenformat.');
        for (const product of data.products) {
          const entry = productEntry(product, collection);
          if (entry) found.set(entry.articleNumber, entry);
        }
        if (data.products.length < 250) {
          complete = true;
          break;
        }
      }
      if (!complete) throw new Error('Zu viele Produktseiten; Abbruch ohne Änderung des Katalogs.');
    }
    if (this.additionalImporter) {
      this.job.message = 'Scalextric- und Superslot-Fahrzeuge werden geprüft …';
      for (const entry of await this.additionalImporter(this.fetcher)) found.set(entry.articleNumber, entry);
    }
    if (!found.size) throw new Error('Keine Fahrzeugdaten gefunden.');
    this.job.phase = 'images';
    this.job.total = found.size;
    // Keep native backups below their 30 MiB image limit, including personal photos.
    let budget = Math.max(0, Math.min(12 * 1024 * 1024, 28 * 1024 * 1024 - (await this.usedBytes()))),
      missing = 0;
    await fs.mkdir(path.join(this.uploads, 'cars'), { recursive: true });
    for (const [number, entry] of found) {
      this.job.message = `Vorschaubilder lokal speichern: ${++this.job.processed}/${this.job.total} …`;
      const previous = entries.get(number);
      if (previous?.imageUrl === entry.imageUrl && previous.imageVersion === 2 && (await this.hasImage(previous.img))) {
        entry.img = previous.img;
        entry.imageVersion = 2;
      } else if (entry.imageUrl && budget > 0) {
        try {
          const image = entry.importSource ? await hornbyImage(entry.imageUrl, this.fetcher) : null;
          const { data, ext } = image
            ? { data: image, ext: imageExtension(image) }
            : await imageBytes(entry.imageUrl, this.fetcher);
          if (!ext) throw new Error('Kein unterstütztes Produktbild.');
          if (data.length <= budget) {
            const filename = `catalog-${number}-${createHash('sha256').update(data).digest('hex').slice(0, 16)}.${ext}`;
            await fs.writeFile(path.join(this.uploads, 'cars', filename), data);
            budget -= data.length;
            entry.img = `/api/img/cars/${filename}`;
            entry.imageVersion = 2;
          }
        } catch (error) {
          if (!this.job.imageErrors) this.job.imageErrors = [];
          if (this.job.imageErrors.length < 5)
            this.job.imageErrors.push({ articleNumber: number, message: error.message });
        }
      }
      if (!entry.img && (await this.hasImage(previous?.img))) {
        entry.img = previous.img;
        entry.imageVersion = previous.imageVersion;
      }
      if (!entry.img) missing++;
      const merged = { ...previous, ...entry, ...(previous?.tyres ? { tyres: previous.tyres } : {}) };
      if (entry.importSource && !entry.equivalence) delete merged.equivalence;
      entries.set(number, merged);
    }
    const data = {
      version: 1,
      updatedAt: new Date().toISOString(),
      entries: [...entries.values()].sort((a, b) => a.articleNumber.localeCompare(b.articleNumber)),
    };
    await this.store.set(data);
    // Remove only regenerable catalogue cache files after the new index is saved.
    // Keep all files still used by any catalogue entry or saved car.
    const keep = new Set(
      [...data.entries.map((e) => e.img), ...((await this.store.usedImages?.()) || [])]
        .filter(Boolean)
        .map((p) => path.basename(p))
    );
    for (const filename of await fs.readdir(path.join(this.uploads, 'cars')))
      if (/^catalog-(?:200\d{5}|[CH]\d{4}[A-Z]?)-[a-f0-9]{16}\.(jpg|png|webp)$/.test(filename) && !keep.has(filename))
        await fs.unlink(path.join(this.uploads, 'cars', filename)).catch(() => {});
    this.job.phase = 'done';
    this.job.message = `${found.size} Modelle geprüft; ${entries.size} Modelle lokal verfügbar.${missing ? ` Bei ${missing} geprüften Modellen fehlt ein lokales Bild. Erneut aktualisieren, um fehlende Bilder nachzuladen.` : ' Alle geprüften Bilder sind offline verfügbar.'}`;
  }
}
