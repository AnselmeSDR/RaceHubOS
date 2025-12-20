import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

/**
 * GET /api/records/track/:trackId
 * Get all records for a specific track
 */
router.get('/track/:trackId', async (req, res) => {
  try {
    const { trackId } = req.params;

    // Get best laps by phase (free, qualifying, race)
    const getBestByPhase = async (phase) => {
      return prisma.lap.findMany({
        where: { trackId, phase },
        orderBy: { lapTime: 'asc' },
        take: 5,
        distinct: ['driverId'],
        include: {
          driver: true,
          car: true
        }
      });
    };

    const [freeLaps, qualifyingLaps, raceLaps, track] = await Promise.all([
      getBestByPhase('free'),
      getBestByPhase('qualifying'),
      getBestByPhase('race'),
      prisma.track.findUnique({ where: { id: trackId } })
    ]);

    res.json({
      success: true,
      data: {
        track,
        free: freeLaps,
        qualifying: qualifyingLaps,
        race: raceLaps
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/records/driver/:driverId
 * Get all records for a specific driver across all tracks
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
        session: true
      }
    });

    const driver = await prisma.driver.findUnique({
      where: { id: driverId }
    });

    res.json({
      success: true,
      data: {
        driver,
        records,
        count: records.length
      }
    });
  } catch (error) {
    console.error('Error fetching driver records:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/records/car/:carId
 * Get all records for a specific car across all tracks
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
        session: true
      }
    });

    const car = await prisma.car.findUnique({
      where: { id: carId }
    });

    res.json({
      success: true,
      data: {
        car,
        records,
        count: records.length
      }
    });
  } catch (error) {
    console.error('Error fetching car records:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/records/leaderboard
 * Get global leaderboard of fastest laps across all tracks
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

    res.json({
      success: true,
      data: records
    });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/records/:id
 * Delete a specific record (admin only)
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.trackRecord.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Record deleted'
    });
  } catch (error) {
    console.error('Error deleting record:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
