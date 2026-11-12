import express from 'express';
import { DivisionScope, isDivisionScope } from '@racehubos/shared';
import { createPrismaClient } from '../lib/prisma.js';
import { attachExtras } from '../addons/extras.js';
import { withImageUrl } from '../utils/imageUrl.js';
import { findOr404, HttpError, route } from '../lib/http.js';
import { addDeletionRoutes } from '../lib/entities/deletion.js';
import { changesFrom, kept, trimmed, trimmedOrNull } from '../lib/entities/fields.js';
import { listPage } from '../lib/entities/list.js';
import { DIVISION_DETAIL, divisionDetail } from '../lib/divisions.js';
import { divisionWorkbook, divisionsWorkbook, idsFromQuery, sendWorkbook } from '../lib/exportQueries.js';

const router = express.Router();
const prisma = createPrismaClient();

const members = {
  drivers: { where: { driver: { deletedAt: null } }, include: { driver: true }, orderBy: { driver: { name: 'asc' } } },
  cars: {
    where: { car: { deletedAt: null } },
    include: { car: true },
    orderBy: [{ car: { brand: 'asc' } }, { car: { model: 'asc' } }],
  },
};
const LIST = {
  sortBy: 'order',
  include: {
    ...members,
    _count: { select: { drivers: { where: members.drivers.where }, cars: { where: members.cars.where } } },
  },
  counts: ['drivers', 'cars'],
};

/** A division for the interface: its drivers and cars as plain records, image URLs. */
function shown(division) {
  const { drivers = [], cars = [], ...rest } = division;
  return {
    ...withImageUrl(rest),
    drivers: drivers.map((link) => withImageUrl(link.driver)),
    cars: cars.map((link) => withImageUrl(link.car)),
  };
}

/** `order` as sent: a whole rank from 0, 400 otherwise. */
function rankFrom(value) {
  const rank = Number(value);
  if (!Number.isInteger(rank) || rank < 0) throw new HttpError(400, 'order must be a whole number from 0');
  return rank;
}

// GET /api/divisions - filtered (deleted, scope), sorted (order, name, drivers, cars) and paginated
router.get(
  '/',
  route('Failed to fetch divisions', async (req, res) => {
    const { scope } = req.query;
    if (scope !== undefined && !isDivisionScope(scope)) throw new HttpError(400, 'Unknown scope');
    const where = scope ? { scope } : {};
    const { page, ...rest } = await listPage(prisma.division, req.query, { ...LIST, where });
    res.json({ success: true, data: await attachExtras(prisma, 'division', page.map(shown)), ...rest });
  })
);

// GET /api/divisions/export?ids=a,b,c - Excel workbook: the divisions, their members and championships, their links
router.get(
  '/export',
  route(null, async (req, res) => {
    const result = await divisionsWorkbook(prisma, idsFromQuery(req.query.ids));
    if (!result) throw new HttpError(404, 'No division to export');
    await sendWorkbook(res, result);
  })
);

// GET /api/divisions/:id/export - Excel workbook of one division
router.get(
  '/:id/export',
  route(null, async (req, res) => {
    const result = await divisionWorkbook(prisma, req.params.id);
    if (!result) throw new HttpError(404, 'Division not found');
    await sendWorkbook(res, result);
  })
);

/** A division's page: each member with its divisions, figures and join date, the championships run for it. */
async function detailOf(id) {
  const division = await findOr404(prisma.division, id, 'Division', DIVISION_DETAIL);
  return attachExtras(prisma, 'division', divisionDetail(division));
}

router.get(
  '/:id',
  route('Failed to fetch division', async (req, res) => {
    res.json({ success: true, data: await detailOf(req.params.id) });
  })
);

/** The member side of a division: a driver joins a driver division, a car a category. */
const MEMBERS = {
  [DivisionScope.DRIVER]: { model: 'driver', link: 'driverDivision', key: 'driverId', name: 'Driver' },
  [DivisionScope.CAR]: { model: 'car', link: 'carDivision', key: 'carId', name: 'Car' },
};

/** A division members can join: not in the bin. */
async function openDivision(id) {
  const division = await prisma.division.findFirst({ where: { id, deletedAt: null } });
  if (!division) throw new HttpError(404, 'Division not found');
  return { division, ...MEMBERS[division.scope] };
}

// POST /api/divisions/:id/members - Body: { memberId } — joining twice keeps the first date
router.post(
  '/:id/members',
  route('Failed to add to division', async (req, res) => {
    const { division, model, link, key, name } = await openDivision(req.params.id);
    const { memberId } = req.body;
    if (typeof memberId !== 'string' || !memberId) throw new HttpError(400, 'memberId is required');
    const member = await prisma[model].findFirst({ where: { id: memberId, deletedAt: null } });
    if (!member) throw new HttpError(404, `${name} not found`);
    const ids = { [key]: memberId, divisionId: division.id };
    await prisma[link].upsert({ where: { [`${key}_divisionId`]: ids }, create: ids, update: {} });
    res.status(201).json({ success: true, data: await detailOf(division.id) });
  })
);

// DELETE /api/divisions/:id/members/:memberId - the driver or car leaves the division
router.delete(
  '/:id/members/:memberId',
  route('Failed to remove from division', async (req, res) => {
    const { division, link, key } = await openDivision(req.params.id);
    await prisma[link].deleteMany({ where: { [key]: req.params.memberId, divisionId: division.id } });
    res.json({ success: true, data: await detailOf(division.id) });
  })
);

// POST /api/divisions - Body: { name, scope, shortName?, color?, img?, order? } — last rank by default
router.post(
  '/',
  route('Failed to create division', async (req, res) => {
    const { name, scope, shortName, color, img, order } = req.body;
    if (!name?.trim()) throw new HttpError(400, 'Name is required');
    if (!isDivisionScope(scope))
      throw new HttpError(400, `scope must be ${DivisionScope.DRIVER} or ${DivisionScope.CAR}`);
    const last = await prisma.division.aggregate({ where: { scope, deletedAt: null }, _max: { order: true } });
    const division = await prisma.division.create({
      data: {
        name: name.trim(),
        scope,
        shortName: trimmedOrNull(shortName),
        color: color || undefined,
        img: img || null,
        order: order === undefined ? (last._max.order ?? 0) + 1 : rankFrom(order),
      },
      include: members,
    });
    res.status(201).json({ success: true, data: shown(division) });
  })
);

// PUT /api/divisions/:id - its scope never changes: its drivers or cars would no longer fit
router.put(
  '/:id',
  route('Failed to update division', async (req, res) => {
    const { id } = req.params;
    await findOr404(prisma.division, id, 'Division');
    const data = changesFrom(req.body, {
      name: trimmed,
      shortName: trimmedOrNull,
      color: kept,
      img: kept,
      order: rankFrom,
    });
    if (data.name === '') throw new HttpError(400, 'Name is required');
    const division = await prisma.division.update({ where: { id }, data, include: members });
    res.json({ success: true, data: shown(division) });
  })
);

// A division in the bin keeps its links for a restore; erased, its drivers and cars just leave it
addDeletionRoutes(router, {
  name: 'Division',
  model: prisma.division,
  hide: (id) => prisma.division.update({ where: { id }, data: { deletedAt: new Date() } }),
  erase: (id) => prisma.division.delete({ where: { id } }),
  restore: (id) => prisma.division.update({ where: { id }, data: { deletedAt: null } }),
});

export default router;
