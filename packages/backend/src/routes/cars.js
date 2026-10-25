import { canonicalReference, scalextricEntries } from '../lib/scalextricCatalog.js';
import express from 'express';
import { articleNumber } from '../lib/carreraCatalog.js';
import { createPrismaClient } from '../lib/prisma.js';
import { softDeleteCar, restoreCar } from '../lib/softDelete.js';
import { withImageUrl, withNestedImageUrls } from '../utils/imageUrl.js';
import { carWorkbook, carsWorkbook, idsFromQuery, sendWorkbook } from '../lib/exportQueries.js';
import { normalizedCarScale, carSpecsFrom } from '@racehubos/shared';

const router = express.Router();
const prisma = createPrismaClient();
function requestYear(value) {
  if (value === undefined) return undefined;
  if (value === null || (typeof value === 'string' && !value.trim())) return null;
  const year = typeof value === 'number' || typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isInteger(year) || year < 1 || year > 9999) {
    const error = new Error('Bitte ein gültiges Baujahr eingeben oder das Feld leer lassen.');
    error.status = 400;
    throw error;
  }
  return year;
}
const articleKey = (id) => `carrera:car:${id}`;
async function withArticle(car) {
  const pref = await prisma.preference.findUnique({ where: { key: articleKey(car.id) } });
  return { ...car, articleNumber: pref ? JSON.parse(pref.value) : null };
}
function requestArticle(req) {
  if (req.body.articleNumber === undefined) return undefined;
  if (!req.body.articleNumber) return null;
  const number = articleNumber(req.body.articleNumber);
  if (!number) {
    const e = new Error('Bitte eine Carrera-, Scalextric- oder Superslot-Artikelnummer eingeben.');
    e.status = 400;
    throw e;
  }
  return canonicalReference(number);
}
async function saveArticle(tx, id, number) {
  if (number !== undefined)
    await tx.preference.upsert({
      where: { key: articleKey(id) },
      create: { key: articleKey(id), value: JSON.stringify(number) },
      update: { value: JSON.stringify(number) },
    });
}

// GET /api/cars - List all cars
router.get('/', async (req, res) => {
  try {
    const { deleted, scale = 'all', limit = '50', offset = '0', sortBy = 'brand', sortOrder = 'asc' } = req.query;
    if (!['all', '132', '124'].includes(scale))
      return res.status(400).json({ success: false, error: 'Ungültiger Maßstabsfilter.' });
    const selectedScale = scale === '132' ? '1:32' : scale === '124' ? '1:24' : null;
    const where = deleted === 'true' ? { deletedAt: { not: null } } : { deletedAt: null };
    const parsedLimit = parseInt(limit);
    const parsedOffset = parseInt(offset);

    const isComputedSort = sortBy === 'bestLap';
    const dbOrderBy =
      sortBy === 'sessions'
        ? { sessions: { _count: sortOrder } }
        : isComputedSort
          ? undefined
          : { [sortBy]: sortOrder };

    const [allCars, databaseTotal] = await Promise.all([
      prisma.car.findMany({
        where,
        include: {
          _count: {
            select: {
              sessions: { where: { deletedAt: null } },
            },
          },
        },
        orderBy: dbOrderBy,
        ...(!isComputedSort && !selectedScale ? { skip: parsedOffset, take: parsedLimit } : {}),
      }),
      prisma.car.count({ where }),
    ]);

    const preferences = await prisma.preference.findMany({
      where: { key: { in: allCars.map((c) => articleKey(c.id)) } },
    });
    const articles = new Map(preferences.map((p) => [p.key, JSON.parse(p.value)]));
    const catalogPreference = await prisma.preference.findUnique({ where: { key: 'carrera:catalog:v1' } });
    const catalogue = new Map(
      (catalogPreference ? JSON.parse(catalogPreference.value).entries || [] : []).map((e) => [
        e.articleNumber,
        e.scale,
      ])
    );
    const enriched = allCars.map((car) => {
      const number = articles.get(articleKey(car.id)) || null;
      return {
        ...car,
        articleNumber: number,
        displayScale:
          normalizedCarScale(car.scale) ||
          normalizedCarScale(catalogue.get(number)) ||
          scalextricEntries.find((e) => e.articleNumber === number || e.aliases.includes(number))?.scale,
      };
    });
    let sorted = selectedScale ? enriched.filter((car) => car.displayScale === selectedScale) : enriched;
    const total = selectedScale ? sorted.length : databaseTotal;
    if (isComputedSort) {
      const dir = sortOrder === 'asc' ? 1 : -1;
      sorted = [...sorted].sort((a, b) => dir * ((a.bestLap || Infinity) - (b.bestLap || Infinity)));
    }
    const cars = isComputedSort || selectedScale ? sorted.slice(parsedOffset, parsedOffset + parsedLimit) : sorted;

    res.json({
      success: true,
      data: cars.map((c) => withImageUrl(c)),
      total,
      hasMore: parsedOffset + parsedLimit < total,
    });
  } catch (error) {
    console.error('Error fetching cars:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch cars',
    });
  }
});

// GET /api/cars/:id - Get car by ID
/**
 * GET /api/cars/export?ids=a,b,c
 * Excel workbook for a hand-picked set of cars
 */
router.get('/export', async (req, res) => {
  try {
    const result = await carsWorkbook(prisma, idsFromQuery(req.query.ids));
    if (!result) {
      return res.status(404).json({ success: false, error: 'No car to export' });
    }

    await sendWorkbook(res, result);
  } catch (error) {
    console.error('Error exporting cars:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/cars/:id/export
 * Excel workbook centred on one car
 */
router.get('/:id/export', async (req, res) => {
  try {
    const result = await carWorkbook(prisma, req.params.id);
    if (!result) {
      return res.status(404).json({ success: false, error: 'Car not found' });
    }

    await sendWorkbook(res, result);
  } catch (error) {
    console.error('Error exporting car:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const car = await prisma.car.findUnique({
      where: { id },
      include: {
        sessions: {
          include: {
            session: {
              include: {
                track: true,
              },
            },
          },
          orderBy: {
            session: {
              createdAt: 'desc',
            },
          },
          take: 10,
        },
        _count: {
          select: { sessions: true },
        },
      },
    });

    if (!car) {
      return res.status(404).json({
        success: false,
        error: 'Car not found',
      });
    }

    // Get best laps per driver x track combo for this car (top 10)
    const bestLaps = await prisma.lap.findMany({
      where: { carId: id },
      orderBy: { lapTime: 'asc' },
      distinct: ['driverId', 'trackId'],
      take: 10,
      include: {
        driver: {
          select: { id: true, name: true, color: true, img: true },
        },
        track: {
          select: { id: true, name: true, color: true },
        },
        session: {
          select: { type: true },
        },
      },
    });

    const records = bestLaps.map((lap) => ({
      id: lap.id,
      lapTime: lap.lapTime,
      driver: lap.driver,
      track: lap.track,
      sessionType: lap.session?.type,
    }));

    res.json({
      success: true,
      data: withNestedImageUrls({ ...(await withArticle(car)), records }),
    });
  } catch (error) {
    console.error('Error fetching car:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch car',
    });
  }
});

// POST /api/cars - Create new car
router.post('/', async (req, res) => {
  try {
    const number = requestArticle(req);
    const normalizedYear = requestYear(req.body.year);
    const { brand, model, img, color, maxSpeed, brakeForce, fuelCapacity } = req.body;

    // Validation
    if (!brand || brand.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Brand is required',
      });
    }

    if (!model || model.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Model is required',
      });
    }

    const car = await prisma.$transaction(async (tx) => {
      const saved = await tx.car.create({
        data: {
          brand: brand.trim(),
          model: model.trim(),
          year: normalizedYear ?? null,
          img: img || null,
          color: color || '#3B82F6',
          maxSpeed: maxSpeed !== undefined ? maxSpeed : 100,
          brakeForce: brakeForce !== undefined ? brakeForce : 50,
          fuelCapacity: fuelCapacity !== undefined ? fuelCapacity : 100,
          ...carSpecsFrom(req.body),
        },
      });
      await saveArticle(tx, saved.id, number);
      return saved;
    });

    res.status(201).json({
      success: true,
      data: withImageUrl(await withArticle(car)),
    });
  } catch (error) {
    console.error('Error creating car:', error);
    res.status(error.status || 500).json({
      success: false,
      error: error.status ? error.message : 'Failed to create car',
    });
  }
});

// PUT /api/cars/:id - Update car
router.put('/:id', async (req, res) => {
  try {
    const number = requestArticle(req);
    const normalizedYear = requestYear(req.body.year);
    const { id } = req.params;
    const { brand, model, img, color, maxSpeed, brakeForce, fuelCapacity } = req.body;

    // Check if car exists
    const exists = await prisma.car.findUnique({
      where: { id },
    });

    if (!exists) {
      return res.status(404).json({
        success: false,
        error: 'Car not found',
      });
    }

    // Build update data
    const updateData = {};
    if (brand !== undefined) updateData.brand = brand.trim();
    if (model !== undefined) updateData.model = model.trim();
    if (normalizedYear !== undefined) updateData.year = normalizedYear;
    if (img !== undefined) updateData.img = img;
    if (color !== undefined) updateData.color = color;
    if (maxSpeed !== undefined) updateData.maxSpeed = maxSpeed;
    if (brakeForce !== undefined) updateData.brakeForce = brakeForce;
    if (fuelCapacity !== undefined) updateData.fuelCapacity = fuelCapacity;
    Object.assign(updateData, carSpecsFrom(req.body, { partial: true }));

    const car = await prisma.$transaction(async (tx) => {
      const saved = await tx.car.update({ where: { id }, data: updateData });
      await saveArticle(tx, id, number);
      return saved;
    });

    res.json({
      success: true,
      data: withImageUrl(await withArticle(car)),
    });
  } catch (error) {
    console.error('Error updating car:', error);
    res.status(error.status || 500).json({
      success: false,
      error: error.status ? error.message : 'Failed to update car',
    });
  }
});

// DELETE /api/cars/:id - Soft delete or hard delete car
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if car exists
    const exists = await prisma.car.findUnique({
      where: { id },
    });

    if (!exists) {
      return res.status(404).json({
        success: false,
        error: 'Car not found',
      });
    }

    if (exists.deletedAt) {
      // Hard delete - cascade related records
      await prisma.$transaction([
        prisma.sessionDriver.deleteMany({ where: { carId: id } }),
        prisma.lap.deleteMany({ where: { carId: id } }),
        prisma.controllerConfig.deleteMany({ where: { carId: id } }),
        prisma.trackRecord.deleteMany({ where: { carId: id } }),
        prisma.car.delete({ where: { id } }),
      ]);
    } else {
      // Soft delete
      // Cascade: everything recorded under this car is hidden with it
      await softDeleteCar(prisma, id);
    }

    res.json({
      success: true,
      message: 'Car deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting car:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete car',
    });
  }
});

// PATCH /api/cars/:id/restore - Restore soft-deleted car
router.patch('/:id/restore', async (req, res) => {
  try {
    const { id } = req.params;
    const entity = await prisma.car.findUnique({ where: { id } });
    if (!entity) return res.status(404).json({ success: false, error: 'Car not found' });

    await restoreCar(prisma, id);

    res.json({ success: true, message: 'Car restored' });
  } catch (error) {
    console.error('Error restoring car:', error);
    res.status(500).json({ success: false, error: 'Failed to restore car' });
  }
});

// POST /api/cars/:id/reset-stats - Reset car statistics
router.post('/:id/reset-stats', async (req, res) => {
  try {
    const { id } = req.params;

    const exists = await prisma.car.findUnique({
      where: { id },
    });

    if (!exists) {
      return res.status(404).json({
        success: false,
        error: 'Car not found',
      });
    }

    // Delete related data and reset stats in a transaction
    const car = await prisma.$transaction(async (tx) => {
      // Delete laps
      await tx.lap.deleteMany({ where: { carId: id } });
      // Delete session participations
      await tx.sessionDriver.deleteMany({ where: { carId: id } });

      // Reset stats fields
      return tx.car.update({
        where: { id },
        data: {
          totalRaces: 0,
          bestLap: null,
        },
        include: {
          _count: { select: { sessions: true } },
        },
      });
    });

    res.json({
      success: true,
      data: withImageUrl(await withArticle(car)),
      message: 'Statistics reset successfully',
    });
  } catch (error) {
    console.error('Error resetting car stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset car statistics',
    });
  }
});

export default router;
