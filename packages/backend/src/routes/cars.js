import express from 'express';
import { createPrismaClient } from '../lib/prisma.js';
import { attachExtras } from '../addons/extras.js';
import { purgeCar, restoreCar, softDeleteCar } from '../lib/softDelete.js';
import { withImageUrl, withNestedImageUrls } from '../utils/imageUrl.js';
import { carWorkbook, carsWorkbook, idsFromQuery, sendWorkbook } from '../lib/exportQueries.js';
import { carSpecsFrom } from '@racehubos/shared';
import { findOr404, HttpError, route } from '../lib/http.js';
import { addDeletionRoutes } from '../lib/entities/deletion.js';
import { changesFrom, kept, trimmed } from '../lib/entities/fields.js';
import { byBestLap, listPage } from '../lib/entities/list.js';
import { bestLapRecords } from '../lib/entities/records.js';

const router = express.Router();
const prisma = createPrismaClient();

const LIST = {
  sortBy: 'brand',
  include: { _count: { select: { sessions: { where: { deletedAt: null } } } } },
  counts: ['sessions'],
  computed: { bestLap: byBestLap },
};

// GET /api/cars - filtered (deleted), sorted and paginated
router.get(
  '/',
  route('Failed to fetch cars', async (req, res) => {
    const { page, ...rest } = await listPage(prisma.car, req.query, LIST);
    res.json({ success: true, data: await attachExtras(prisma, 'car', page.map(withImageUrl)), ...rest });
  })
);

// GET /api/cars/export?ids=a,b,c - Excel workbook for a hand-picked set of cars
router.get(
  '/export',
  route(null, async (req, res) => {
    const result = await carsWorkbook(prisma, idsFromQuery(req.query.ids));
    if (!result) throw new HttpError(404, 'No car to export');
    await sendWorkbook(res, result);
  })
);

// GET /api/cars/:id/export - Excel workbook centred on one car
router.get(
  '/:id/export',
  route(null, async (req, res) => {
    const result = await carWorkbook(prisma, req.params.id);
    if (!result) throw new HttpError(404, 'Car not found');
    await sendWorkbook(res, result);
  })
);

// GET /api/cars/:id - with latest sessions, entry count and best lap per driver and track
router.get(
  '/:id',
  route('Failed to fetch car', async (req, res) => {
    const car = await findOr404(prisma.car, req.params.id, 'Car', {
      sessions: {
        include: { session: { include: { track: true } } },
        orderBy: { session: { createdAt: 'desc' } },
        take: 10,
      },
      _count: { select: { sessions: true } },
    });
    const records = await bestLapRecords(prisma, 'car', car.id);
    res.json({ success: true, data: await attachExtras(prisma, 'car', withNestedImageUrls({ ...car, records })) });
  })
);

router.post(
  '/',
  route('Failed to create car', async (req, res) => {
    const { brand, model, year, img, color, maxSpeed, brakeForce, fuelCapacity } = req.body;
    if (!brand?.trim()) throw new HttpError(400, 'Brand is required');
    if (!model?.trim()) throw new HttpError(400, 'Model is required');

    const car = await prisma.car.create({
      data: {
        brand: brand.trim(),
        model: model.trim(),
        year: year || null,
        img: img || null,
        color: color || '#3B82F6',
        // Left out, the schema's defaults apply
        maxSpeed,
        brakeForce,
        fuelCapacity,
        ...carSpecsFrom(req.body),
      },
    });
    res.status(201).json({ success: true, data: withImageUrl(car) });
  })
);

const EDITABLE = {
  brand: trimmed,
  model: trimmed,
  year: kept,
  img: kept,
  color: kept,
  maxSpeed: kept,
  brakeForce: kept,
  fuelCapacity: kept,
};

router.put(
  '/:id',
  route('Failed to update car', async (req, res) => {
    const { id } = req.params;
    await findOr404(prisma.car, id, 'Car');
    const data = { ...changesFrom(req.body, EDITABLE), ...carSpecsFrom(req.body, { partial: true }) };
    res.json({ success: true, data: withImageUrl(await prisma.car.update({ where: { id }, data })) });
  })
);

addDeletionRoutes(router, {
  name: 'Car',
  model: prisma.car,
  hide: (id) => softDeleteCar(prisma, id),
  erase: (id) => purgeCar(prisma, id),
  restore: (id) => restoreCar(prisma, id),
});

// POST /api/cars/:id/reset-stats - erases its laps and entries, zeroes the totals
router.post(
  '/:id/reset-stats',
  route('Failed to reset car statistics', async (req, res) => {
    const { id } = req.params;
    await findOr404(prisma.car, id, 'Car');
    const car = await prisma.$transaction(async (tx) => {
      await tx.lap.deleteMany({ where: { carId: id } });
      await tx.sessionDriver.deleteMany({ where: { carId: id } });
      return tx.car.update({
        where: { id },
        data: { totalRaces: 0, bestLap: null },
        include: { _count: { select: { sessions: true } } },
      });
    });
    res.json({ success: true, data: withImageUrl(car), message: 'Statistics reset successfully' });
  })
);

export default router;
