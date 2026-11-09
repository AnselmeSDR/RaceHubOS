import express from 'express';
import { createPrismaClient } from '../lib/prisma.js';
import { attachExtras } from '../addons/extras.js';
import { withNestedImageUrls } from '../utils/imageUrl.js';
import { findOr404, HttpError, route } from '../lib/http.js';
import { addDeletionRoutes } from '../lib/entities/deletion.js';
import { changesFrom, kept, trimmed } from '../lib/entities/fields.js';
import { listPage } from '../lib/entities/list.js';

const router = express.Router();
const prisma = createPrismaClient();

const notDeleted = { where: { deletedAt: null } };
const LIST = {
  sortBy: 'name',
  include: { drivers: { ...notDeleted, orderBy: { name: 'asc' } }, _count: { select: { drivers: notDeleted } } },
  counts: ['drivers'],
};

// GET /api/teams - filtered (deleted), sorted and paginated, with their current drivers
router.get(
  '/',
  route('Failed to fetch teams', async (req, res) => {
    const { page, ...rest } = await listPage(prisma.team, req.query, LIST);
    res.json({ success: true, data: await attachExtras(prisma, 'team', page.map(withNestedImageUrls)), ...rest });
  })
);

router.get(
  '/:id',
  route('Failed to fetch team', async (req, res) => {
    const team = await findOr404(prisma.team, req.params.id, 'Team', { drivers: { orderBy: { name: 'asc' } } });
    res.json({ success: true, data: await attachExtras(prisma, 'team', withNestedImageUrls(team)) });
  })
);

router.post(
  '/',
  route('Failed to create team', async (req, res) => {
    const { name, color, img } = req.body;
    if (!name?.trim()) throw new HttpError(400, 'Name is required');
    const team = await prisma.team.create({
      data: { name: name.trim(), color: color || null, img: img || null },
      include: { drivers: true },
    });
    res.status(201).json({ success: true, data: withNestedImageUrls(team) });
  })
);

router.put(
  '/:id',
  route('Failed to update team', async (req, res) => {
    const { id } = req.params;
    await findOr404(prisma.team, id, 'Team');
    const data = changesFrom(req.body, { name: trimmed, color: kept, img: kept });
    const team = await prisma.team.update({ where: { id }, data, include: { drivers: true } });
    res.json({ success: true, data: withNestedImageUrls(team) });
  })
);

addDeletionRoutes(router, {
  name: 'Team',
  model: prisma.team,
  hide: (id) => prisma.team.update({ where: { id }, data: { deletedAt: new Date() } }),
  // A team is erased once empty: its drivers, even deleted ones, go elsewhere first
  erase: async (id) => {
    const drivers = await prisma.driver.count({ where: { teamId: id } });
    if (drivers > 0) {
      throw new HttpError(
        400,
        `Cannot delete team with ${drivers} driver(s). Please reassign or delete drivers first.`
      );
    }
    await prisma.team.delete({ where: { id } });
  },
  restore: (id) => prisma.team.update({ where: { id }, data: { deletedAt: null } }),
});

export default router;
