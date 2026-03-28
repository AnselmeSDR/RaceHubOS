import express from 'express';
import { PrismaClient } from '@prisma/client';
import { withImageUrl, withNestedImageUrls } from '../utils/imageUrl.js';

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/cars - List all cars
router.get('/', async (req, res) => {
  try {
    const { deleted, limit = '50', offset = '0', sortBy = 'brand', sortOrder = 'asc' } = req.query;
    const where = deleted === 'true' ? { deletedAt: { not: null } } : { deletedAt: null };
    const parsedLimit = parseInt(limit);
    const parsedOffset = parseInt(offset);

    const isComputedSort = sortBy === 'bestLap';
    const dbOrderBy = sortBy === 'sessions' ? { sessions: { _count: sortOrder } }
      : isComputedSort ? undefined
      : { [sortBy]: sortOrder };

    const [allCars, total] = await Promise.all([
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
        ...(!isComputedSort ? { skip: parsedOffset, take: parsedLimit } : {}),
      }),
      prisma.car.count({ where }),
    ]);

    let sorted = allCars;
    if (isComputedSort) {
      const dir = sortOrder === 'asc' ? 1 : -1;
      sorted = [...allCars].sort((a, b) => dir * ((a.bestLap || Infinity) - (b.bestLap || Infinity)));
    }
    const cars = isComputedSort ? sorted.slice(parsedOffset, parsedOffset + parsedLimit) : sorted;

    res.json({
      success: true,
      data: cars.map(c => withImageUrl(c)),
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
      data: withNestedImageUrls({ ...car, records }),
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
    const {
      brand,
      model,
      year,
      img,
      color,
      maxSpeed,
      brakeForce,
      fuelCapacity,
    } = req.body;

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

    const car = await prisma.car.create({
      data: {
        brand: brand.trim(),
        model: model.trim(),
        year: year || null,
        img: img || null,
        color: color || '#3B82F6',
        maxSpeed: maxSpeed !== undefined ? maxSpeed : 100,
        brakeForce: brakeForce !== undefined ? brakeForce : 50,
        fuelCapacity: fuelCapacity !== undefined ? fuelCapacity : 100,
      },
    });

    res.status(201).json({
      success: true,
      data: withImageUrl(car),
    });
  } catch (error) {
    console.error('Error creating car:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create car',
    });
  }
});

// PUT /api/cars/:id - Update car
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      brand,
      model,
      year,
      img,
      color,
      maxSpeed,
      brakeForce,
      fuelCapacity,
    } = req.body;

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
    if (year !== undefined) updateData.year = year;
    if (img !== undefined) updateData.img = img;
    if (color !== undefined) updateData.color = color;
    if (maxSpeed !== undefined) updateData.maxSpeed = maxSpeed;
    if (brakeForce !== undefined) updateData.brakeForce = brakeForce;
    if (fuelCapacity !== undefined) updateData.fuelCapacity = fuelCapacity;

    const car = await prisma.car.update({
      where: { id },
      data: updateData,
    });

    res.json({
      success: true,
      data: withImageUrl(car),
    });
  } catch (error) {
    console.error('Error updating car:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update car',
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
      await prisma.car.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
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

    await prisma.car.update({
      where: { id },
      data: { deletedAt: null },
    });

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
      data: withImageUrl(car),
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
