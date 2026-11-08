import express from 'express';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createPrismaClient } from '../lib/prisma.js';
import { readCockpitArchive } from '../lib/cockpitArchive.js';
import { mapCockpitArchive } from '../lib/cockpitMappers.js';
import { hasCockpitCatalog } from '../lib/cockpitCatalog.js';
import { COCKPIT_FIELDS, prepareCockpitPreview, commitCockpitImport } from '../lib/cockpitImport.js';

export function createCockpitRouter({
  prisma = createPrismaClient(),
  uploads = fileURLToPath(new URL('../../public/uploads/', import.meta.url)),
  backup,
  io,
} = {}) {
  const router = express.Router();
  const previews = new Map();
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 180 * 1024 * 1024, files: 1 } });
  const entry = (id) => {
    const preview = previews.get(id);
    if (!preview || preview.expires < Date.now()) throw Object.assign(new Error('Preview expired'), { status: 410 });
    return preview;
  };
  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  router.post('/cockpit/preview', upload.single('file'), async (req, res, next) => {
    try {
      if (!req.file) throw Object.assign(new Error('Select a Cockpit-XP ZIP backup'), { status: 400 });
      for (const [id, value] of previews) if (value.expires < Date.now()) previews.delete(id);
      if (previews.size >= 3) previews.delete(previews.keys().next().value);
      const raw = await readCockpitArchive(req.file.buffer);
      const preview = await prepareCockpitPreview(prisma, mapCockpitArchive(raw));
      const id = randomUUID();
      previews.set(id, { ...preview, expires: Date.now() + 30 * 60000 });
      const rows = Object.fromEntries(
        Object.entries(preview.rows).map(([group, items]) => [
          group,
          items.map(({ key, targetId, data, image, lockedTarget, catalogSerial }) => ({
            key,
            targetId,
            data,
            lockedTarget,
            ...(group === 'cars' ? { catalogSerial: catalogSerial || '' } : {}),
            includeImage: !!image,
            hasImage: !!image,
          })),
        ])
      );
      res.json({
        success: true,
        data: {
          id,
          rows,
          fields: COCKPIT_FIELDS,
          targets: preview.targets,
          catalogAvailable: hasCockpitCatalog(prisma),
        },
      });
    } catch (error) {
      error.status ||= 400;
      next(error);
    }
  });
  router.get('/cockpit/preview/:id/image/:key', async (req, res, next) => {
    try {
      const preview = entry(req.params.id);
      const image = Object.values(preview.rows)
        .flat()
        .find((row) => row.key === req.params.key)?.image;
      if (!image) return res.sendStatus(404);
      const mime = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
      };
      res.set('X-Content-Type-Options', 'nosniff').type(mime[image.extension]).send(Buffer.from(image.data, 'base64'));
    } catch (error) {
      next(error);
    }
  });
  router.post('/cockpit/import', async (req, res, next) => {
    let preview;
    let locked = false;
    try {
      if (req.body.confirmed !== true) throw Object.assign(new Error('Confirm the reviewed import'), { status: 400 });
      preview = entry(req.body.id);
      if (preview.busy) return res.status(409).json({ success: false, error: 'Import already running' });
      preview.busy = true;
      locked = true;
      const result = await commitCockpitImport({
        prisma,
        preview,
        rows: req.body.rows,
        uploads,
        backup,
        importCatalog: req.body.importCatalog ?? false,
      });
      previews.delete(req.body.id);
      io?.emit('data:restored');
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    } finally {
      if (locked) preview.busy = false;
    }
  });
  router.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    res
      .status(error.status || (error instanceof multer.MulterError ? 400 : 500))
      .json({ success: false, error: error.message || 'Cockpit-XP import failed' });
  });
  return router;
}
