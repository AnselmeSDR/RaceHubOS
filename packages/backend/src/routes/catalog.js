import express from 'express';
import { createPrismaClient } from '../lib/prisma.js';
import { catalogEntry, catalogImportBundle, storeCatalogImages, catalogExport } from '../lib/catalog.js';

const prisma = createPrismaClient();
const router = express.Router();
router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
router.get('/', async (req, res) => {
  try {
    const entries = await prisma.catalogEntry.findMany({ orderBy: { serial: 'asc' } });
    res.json({ success: true, data: entries });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to read catalog' });
  }
});
async function exportCatalog(req, res) {
  try {
    const serial = req.params.serial;
    const rows =
      serial === undefined
        ? await prisma.catalogEntry.findMany({ orderBy: { serial: 'asc' } })
        : await prisma.catalogEntry.findMany({ where: { serial } });
    if (serial !== undefined && !rows.length)
      return res.status(404).json({ success: false, error: 'Catalog entry not found' });
    let json;
    try {
      json = catalogExport(rows);
    } catch (error) {
      return res.status(400).json({ success: false, error: error.message });
    }
    const filename =
      serial === undefined ? 'catalog.json' : `catalog-${serial.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80)}.json`;
    res.attachment(filename).type('application/json').send(json);
  } catch {
    res.status(500).json({ success: false, error: 'Failed to export catalog' });
  }
}
router.get('/export', exportCatalog);
router.get('/export/:serial', exportCatalog);
router.get('/lookup/:serial', async (req, res) => {
  try {
    const entry = await prisma.catalogEntry.findUnique({ where: { serial: req.params.serial.trim() } });
    if (!entry) return res.status(404).json({ success: false, error: 'Catalog entry not found' });
    res.json({ success: true, data: entry });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to read catalog' });
  }
});
router.post('/import', async (req, res) => {
  let entries;
  let images;
  try {
    ({ entries, images } = catalogImportBundle(req.body));
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
  try {
    storeCatalogImages(images);
    await prisma.$transaction(
      entries.map((entry) =>
        prisma.catalogEntry.upsert({
          where: { serial: entry.serial },
          create: entry,
          update: entry,
        })
      )
    );
    res.json({ success: true, count: entries.length });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to import catalog' });
  }
});
router.put('/:serial', async (req, res) => {
  let entry;
  try {
    entry = catalogEntry({ ...req.body, serial: req.params.serial });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
  try {
    const data = await prisma.catalogEntry.upsert({ where: { serial: entry.serial }, create: entry, update: entry });
    res.json({ success: true, data });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to save catalog entry' });
  }
});
router.delete('/:serial', async (req, res) => {
  try {
    await prisma.catalogEntry.deleteMany({ where: { serial: req.params.serial } });
    // Images may also belong to cars. Keep uploads until the user removes them.
    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to delete catalog entry' });
  }
});
export default router;
