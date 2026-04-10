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

      // For race type, get totalTime from SessionDriver
      let raceStatsMap = new Map();
      if (type === 'race') {
        const sessionIds = [...new Set(laps.map(l => l.sessionId))];
        const sessionDrivers = await prisma.sessionDriver.findMany({
          where: { sessionId: { in: sessionIds } },
        });
        // Keep best totalTime per driver+car
        for (const sd of sessionDrivers) {
          const key = `${sd.driverId}-${sd.carId}`;
          const existing = raceStatsMap.get(key);
          if (!existing || (sd.totalTime && sd.totalTime > (existing.totalTime || 0))) {
            raceStatsMap.set(key, { totalTime: sd.totalTime, totalLaps: sd.totalLaps });
          }
        }
      }

      return laps.map(lap => {
        const key = `${lap.driverId}-${lap.carId}`;
        const raceStats = raceStatsMap.get(key);
        return {
          ...lap,
          driver: withImageUrl(lap.driver),
          car: withImageUrl(lap.car),
          laps: countMap.get(key) || 0,
          ...(raceStats ? { totalTime: raceStats.totalTime, totalLaps: raceStats.totalLaps } : {}),
        };
      });
    };

    // Best lap per car (not per driver+car) for balancing sessions
    const getBalancingBestByCar = async () => {
      const laps = await prisma.lap.findMany({
        where: {
          trackId,
          deletedAt: null,
          session: { type: 'balancing', ...sessionFilter }
        },
        orderBy: { lapTime: 'asc' },
        distinct: ['carId'],
        include: {
          car: true,
          driver: true,
          session: { select: { id: true, type: true, name: true } }
        }
      });

      const lapCounts = await prisma.lap.groupBy({
        by: ['carId'],
        where: {
          trackId,
          deletedAt: null,
          session: { type: 'balancing', ...sessionFilter }
        },
        _count: { id: true }
      });

      const countMap = new Map(lapCounts.map(c => [c.carId, c._count.id]));

      // Compute best median (per 5 laps) for each car, excluding first lap of each session
      const allLapsByCar = await prisma.lap.findMany({
        where: {
          trackId,
          deletedAt: null,
          session: { type: 'balancing', ...sessionFilter },
          lapNumber: { gt: 1 }, // Exclude first lap (pit exit)
        },
        orderBy: { lapTime: 'asc' },
        select: { carId: true, lapTime: true }
      });

      const carTimesMap = new Map();
      for (const l of allLapsByCar) {
        if (!carTimesMap.has(l.carId)) carTimesMap.set(l.carId, []);
        carTimesMap.get(l.carId).push(l.lapTime);
      }

      const bestMedianMap = new Map();
      for (const [carId, times] of carTimesMap) {
        const sorted = [...times].sort((a, b) => a - b);
        let bestMed = null;
        for (let i = 5; i <= sorted.length; i += 5) {
          const slice = sorted.slice(0, i);
          const mid = Math.floor(slice.length / 2);
          const med = slice.length % 2 !== 0 ? slice[mid] : (slice[mid - 1] + slice[mid]) / 2;
          if (bestMed === null || med < bestMed) bestMed = med;
        }
        bestMedianMap.set(carId, bestMed);
      }

      return laps.map(lap => ({
        ...lap,
        car: withImageUrl(lap.car),
        driver: withImageUrl(lap.driver),
        laps: countMap.get(lap.carId) || 0,
        bestMedian: bestMedianMap.get(lap.carId) || null,
      }));
    };

    const [practiceLaps, qualifLaps, raceLaps, balancingLaps, track] = await Promise.all([
      getBestByType('practice'),
      getBestByType('qualif'),
      getBestByType('race'),
      getBalancingBestByCar(),
      prisma.track.findUnique({ where: { id: trackId } })
    ]);

    res.json({
      success: true,
      data: {
        track: withImageUrl(track),
        practice: practiceLaps,
        qualif: qualifLaps,
        race: raceLaps,
        balancing: balancingLaps
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
