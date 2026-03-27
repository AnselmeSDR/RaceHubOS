import express from 'express';
import { PrismaClient } from '@prisma/client';
import { withImageUrl } from '../utils/imageUrl.js';

const router = express.Router();
const prisma = new PrismaClient();

/**
 * GET /api/records/track/:trackId
 * Get best laps for a specific track, grouped by session type
 * Query params:
 *   - championshipId=null: Only include sessions without championship (free mode)
 *   - championshipId=<id>: Filter by specific championship
 */
router.get('/track/:trackId', async (req, res) => {
  try {
    const { trackId } = req.params;
    const { championshipId } = req.query;

    // Build session filter
    const sessionFilter = {};
    if (championshipId === 'null') {
      sessionFilter.championshipId = null;
    } else if (championshipId) {
      sessionFilter.championshipId = championshipId;
    }

    // Get best laps by session type (practice, qualif, race) with lap counts
    const getBestByType = async (type) => {
      // Get best lap per driver+car combination
      const laps = await prisma.lap.findMany({
        where: {
          trackId,
          deletedAt: null,
          session: { type, ...sessionFilter }
        },
        orderBy: { lapTime: 'asc' },
        take: 5,
        distinct: ['driverId', 'carId'],
        include: {
          driver: true,
          car: true,
          session: { select: { id: true, type: true, name: true } }
        }
      });

      // Get lap counts per driver+car
      const lapCounts = await prisma.lap.groupBy({
        by: ['driverId', 'carId'],
        where: {
          trackId,
          deletedAt: null,
          session: { type, ...sessionFilter }
        },
        _count: { id: true }
      });

      const countMap = new Map(lapCounts.map(c => [`${c.driverId}-${c.carId}`, c._count.id]));

      return laps.map(lap => ({
        ...lap,
        driver: withImageUrl(lap.driver),
        car: withImageUrl(lap.car),
        laps: countMap.get(`${lap.driverId}-${lap.carId}`) || 0
      }));
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
        track: withImageUrl(track),
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
