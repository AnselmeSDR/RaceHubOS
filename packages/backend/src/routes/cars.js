import express from 'express';
import { PrismaClient } from '@prisma/client';
import { withImageUrl, withNestedImageUrls } from '../utils/imageUrl.js';

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/cars - List all cars
router.get('/', async (req, res) => {
  try {
    const cars = await prisma.car.findMany({
      include: {
        _count: {
          select: {
            sessions: true,
          },
        },
      },
      orderBy: [
        { brand: 'asc' },
        { model: 'asc' },
      ],
    });

    res.json({
      success: true,
      data: cars.map(c => withImageUrl(c)),
      count: cars.length,
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
          take: 10, // Last 10 sessions
        },
      },
    });

    if (!car) {
      return res.status(404).json({
        success: false,
        error: 'Car not found',
      });
    }

    res.json({
      success: true,
      data: withNestedImageUrls(car),
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

// DELETE /api/cars/:id - Delete car
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

    await prisma.car.delete({
      where: { id },
    });

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

export default router;
