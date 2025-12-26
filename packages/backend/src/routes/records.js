import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

/**
 * GET /api/records/track/:trackId
 * Get best laps for a specific track, grouped by session type
 */
router.get('/track/:trackId', async (req, res) => {
  try {
    const { trackId } = req.params;

    // Get best laps by session type (practice, qualif, race)
    const getBestByType = async (type) => {
      return prisma.lap.findMany({
        where: {
          trackId,
          softDeletedAt: null,
          session: { type }
        },
        orderBy: { lapTime: 'asc' },
        take: 5,
        distinct: ['driverId'],
        include: {
          driver: true,
          car: true,
          session: { select: { id: true, type: true, name: true } }
        }
      });
    };

    const [practiceLaps, qualifLaps, raceLaps, track] = await Promise.all([
      getBestByType('practice'),
      getBestByType('qualif'),
      getBestByType('race'),
      prisma.track.findUnique({ where: { id: trackId } })
    ]);

    res.json({
      success: true,
      data: {
        track,
        practice: practiceLaps,
        qualif: qualifLaps,
        race: raceLaps
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/records/driver/:driverId
 * Get all track records for a specific driver
 */
router.get('/driver/:driverId', async (req, res) => {
  try {
    const { driverId } = req.params;

    const records = await prisma.trackRecord.findMany({
      where: { driverId },
      orderBy: { lapTime: 'asc' },
      include: {
        track: true,
        car: true,
        session: { select: { id: true, type: true, name: true } }
      }
    });

    const driver = await prisma.driver.findUnique({
      where: { id: driverId }
    });

    res.json({
      success: true,
      data: { driver, records, count: records.length }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/records/car/:carId
 * Get all track records for a specific car
 */
router.get('/car/:carId', async (req, res) => {
  try {
    const { carId } = req.params;

    const records = await prisma.trackRecord.findMany({
      where: { carId },
      orderBy: { lapTime: 'asc' },
      include: {
        track: true,
        driver: true,
        session: { select: { id: true, type: true, name: true } }
      }
    });

    const car = await prisma.car.findUnique({
      where: { id: carId }
    });

    res.json({
      success: true,
      data: { car, records, count: records.length }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/records/leaderboard
 * Get global leaderboard of track records
 */
router.get('/leaderboard', async (req, res) => {
  try {
    const { limit = 50 } = req.query;

    const records = await prisma.trackRecord.findMany({
      orderBy: { lapTime: 'asc' },
      take: parseInt(limit),
      include: {
        track: true,
        driver: true,
        car: true
      }
    });

    res.json({ success: true, data: records });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/records/:id
 * Delete a specific track record
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.trackRecord.delete({ where: { id } });

    res.json({ success: true, message: 'Record deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
