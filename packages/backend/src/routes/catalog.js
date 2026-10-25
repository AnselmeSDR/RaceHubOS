import { importHornbyCatalog } from '../lib/hornbyCatalogImport.js';
import { scalextricEntries, scalextricImage } from '../lib/scalextricCatalog.js';
import express from 'express';
import { tyreParts } from '../lib/carreraTyres.js';
import { articleNumber } from '../lib/carreraCatalog.js';
import { fileURLToPath } from 'node:url';
import { createPrismaClient } from '../lib/prisma.js';
import { CarreraCatalog, CATALOG_KEY } from '../lib/carreraCatalog.js';
const prisma = createPrismaClient(),
  router = express.Router();
export const catalog = new CarreraCatalog({
  additionalImporter: importHornbyCatalog,
  extraEntries: scalextricEntries,
  imageProvider: scalextricImage,
  uploads: fileURLToPath(new URL('../../public/uploads/', import.meta.url)),
  store: {
    async usedImages() {
      return (await prisma.car.findMany({ select: { img: true } })).map((c) => c.img);
    },
    async get() {
      const p = await prisma.preference.findUnique({ where: { key: CATALOG_KEY } });
      return p ? JSON.parse(p.value) : null;
    },
    async set(data) {
      await prisma.preference.upsert({
        where: { key: CATALOG_KEY },
        create: { key: CATALOG_KEY, value: JSON.stringify(data) },
        update: { value: JSON.stringify(data) },
      });
    },
  },
});
router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
router.get('/status', async (req, res) => {
  try {
    res.json({ success: true, data: await catalog.status() });
  } catch {
    res.status(500).json({ success: false, error: 'Katalog konnte nicht gelesen werden.' });
  }
});
router.get('/lookup/:number', async (req, res) => {
  try {
    const entry = await catalog.lookup(req.params.number);
    res.status(entry ? 200 : 404).json(
      entry
        ? { success: true, data: entry }
        : {
            success: false,
            error:
              'Artikelnummer nicht im lokalen Katalog gefunden. Katalog aktualisieren oder das Auto manuell anlegen.',
          }
    );
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});
router.get('/tyres/:number', async (req, res) => {
  const number = articleNumber(req.params.number);
  if (!number) return res.status(400).json({ success: false, error: 'Ungültige Artikelnummer.' });
  try {
    const entry = await catalog.lookup(number);
    const p = await prisma.preference.findUnique({ where: { key: `carrera:tyres:${entry?.articleNumber || number}` } });
    res.json({ success: true, data: p ? JSON.parse(p.value) : entry?.tyres || null });
  } catch {
    res.status(500).json({ success: false, error: 'Reifendaten konnten nicht gelesen werden.' });
  }
});
router.post('/tyres/:number/update', async (req, res) => {
  const origin = req.get('origin');
  if (
    !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress) ||
    (origin && origin !== `${req.protocol}://${req.get('host')}`)
  )
    return res.status(403).json({ success: false, error: 'Reifenabfrage nur lokal öffnen.' });
  try {
    const entry = await catalog.lookup(req.params.number);
    if (!entry) throw new Error('Auto zuerst einer Artikelnummer im lokalen Katalog zuordnen.');
    if (entry.tyres?.archived) return res.json({ success: true, data: entry.tyres });
    const source = new URL(entry.sourceUrl);
    if (
      source.origin !== 'https://carrera-toys.com' ||
      !/^\/products\/[a-z0-9-]+$/.test(source.pathname) ||
      source.username ||
      source.password
    )
      throw new Error('Ungültige Carrera-Produktquelle. Katalog aktualisieren.');
    const response = await fetch(source, { signal: AbortSignal.timeout(25000), redirect: 'error' });
    if (!response.ok) throw new Error('Carrera-Ersatzteilseite ist gerade nicht erreichbar.');
    const chunks = [];
    let size = 0;
    for await (const chunk of response.body) {
      size += chunk.length;
      if (size > 3 * 1024 * 1024) throw new Error('Ersatzteilseite zu groß.');
      chunks.push(chunk);
    }
    const text = Buffer.concat(chunks).toString();
    const data = {
      articleNumber: entry.articleNumber,
      checkedAt: new Date().toISOString(),
      sourceUrl: entry.sourceUrl,
      parts: tyreParts(text),
    };
    await prisma.preference.upsert({
      where: { key: `carrera:tyres:${entry.articleNumber}` },
      create: { key: `carrera:tyres:${entry.articleNumber}`, value: JSON.stringify(data) },
      update: { value: JSON.stringify(data) },
    });
    res.json({ success: true, data });
  } catch (e) {
    res.status(502).json({ success: false, error: e.message });
  }
});
router.post('/update', (req, res) => {
  const origin = req.get('origin');
  if (
    !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress) ||
    (origin && origin !== `${req.protocol}://${req.get('host')}`)
  )
    return res.status(403).json({ success: false, error: 'Katalogaktualisierung nur lokal öffnen.' });
  const started = catalog.start();
  res.status(202).json({ success: true, started });
});
export default router;
