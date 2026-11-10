import express from 'express';
import { createPrismaClient } from '../lib/prisma.js';
import { attachExtras } from '../addons/extras.js';
import { softDeleteTrack, restoreTrack, purgeTrack } from '../lib/softDelete.js';
import { withImageUrl, withNestedImageUrls } from '../utils/imageUrl.js';
import { findOr404, HttpError, route } from '../lib/http.js';
import { addDeletionRoutes } from '../lib/entities/deletion.js';
import { changesFrom, kept, trimmed } from '../lib/entities/fields.js';
import { byBestLap, listPage } from '../lib/entities/list.js';
import { bestLapRecords } from '../lib/entities/records.js';

const router = express.Router();
const prisma = createPrismaClient();

const LIST = {
  sortBy: 'name',
  include: { _count: { select: { sessions: { where: { deletedAt: null } } } } },
  counts: ['sessions'],
  computed: { bestLap: byBestLap },
};

// GET /api/tracks - filtered (deleted), sorted and paginated
router.get(
  '/',
  route('Failed to fetch tracks', async (req, res) => {
    const { page, ...rest } = await listPage(prisma.track, req.query, LIST);
    res.json({ success: true, data: await attachExtras(prisma, 'track', page.map(withImageUrl)), ...rest });
  })
);

// GET /api/tracks/:id - with latest sessions, session count and best lap per driver and car
router.get(
  '/:id',
  route('Failed to fetch track', async (req, res) => {
    const track = await findOr404(prisma.track, req.params.id, 'Track', {
      sessions: { orderBy: { createdAt: 'desc' }, take: 10, include: { _count: { select: { drivers: true } } } },
      _count: { select: { sessions: true } },
    });
    const records = await bestLapRecords(prisma, 'track', track.id);
    res.json({ success: true, data: await attachExtras(prisma, 'track', withNestedImageUrls({ ...track, records })) });
  })
);

router.post(
  '/',
  route('Failed to create track', async (req, res) => {
    const { name, img, layout, length, corners, color } = req.body;
    if (!name?.trim()) throw new HttpError(400, 'Name is required');

    const track = await prisma.track.create({
      data: {
        name: name.trim(),
        img: img || null,
        layout: layout || null,
        length: length || null,
        corners: corners || null,
        color: color || '#9333ea',
      },
    });
    res.status(201).json({ success: true, data: withImageUrl(track) });
  })
);

const EDITABLE = {
  name: trimmed,
  img: kept,
  layout: kept,
  length: kept,
  corners: kept,
  color: kept,
  bestLap: kept,
  bestLapBy: kept,
};

router.put(
  '/:id',
  route('Failed to update track', async (req, res) => {
    const { id } = req.params;
    await findOr404(prisma.track, id, 'Track');
    const track = await prisma.track.update({ where: { id }, data: changesFrom(req.body, EDITABLE) });
    res.json({ success: true, data: withImageUrl(track) });
  })
);

addDeletionRoutes(router, {
  name: 'Track',
  model: prisma.track,
  hide: (id) => softDeleteTrack(prisma, id),
  erase: (id) => purgeTrack(prisma, id),
  restore: (id) => restoreTrack(prisma, id),
});

// POST /api/tracks/:id/reset-stats - erases its records and laps, clears the best lap
router.post(
  '/:id/reset-stats',
  route('Failed to reset track statistics', async (req, res) => {
    const { id } = req.params;
    await findOr404(prisma.track, id, 'Track');
    const track = await prisma.$transaction(async (tx) => {
      await tx.trackRecord.deleteMany({ where: { trackId: id } });
      await tx.lap.deleteMany({ where: { trackId: id } });
      return tx.track.update({
        where: { id },
        data: { bestLap: null, bestLapBy: null },
        include: { _count: { select: { sessions: true } } },
      });
    });
    res.json({ success: true, data: withImageUrl(track), message: 'Statistics reset successfully' });
  })
);

export default router;
