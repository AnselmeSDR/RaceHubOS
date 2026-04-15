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

      // Get all laps grouped by session+car for median calculations (excluding first lap)
      const allLaps = await prisma.lap.findMany({
        where: {
          trackId,
          deletedAt: null,
          session: { type: 'balancing', ...sessionFilter },
          lapNumber: { gt: 1 },
        },
        select: { carId: true, sessionId: true, lapTime: true },
        orderBy: { lapTime: 'asc' }
      });

      // Get session dates for ordering
      const sessionIds = [...new Set(allLaps.map(l => l.sessionId))];
      const sessions = await prisma.session.findMany({
        where: { id: { in: sessionIds } },
        select: { id: true, createdAt: true },
        orderBy: { createdAt: 'asc' }
      });
      const sessionOrder = new Map(sessions.map((s, i) => [s.id, i]));

      // Helper: compute best median from sorted times using sliding windows of 5
      const computeBestMedian = (times) => {
        const sorted = [...times].sort((a, b) => a - b);
        if (sorted.length < 5) return null;
        let bestMed = null;
        for (let i = 0; i + 5 <= sorted.length; i += 5) {
          const slice = sorted.slice(i, i + 5);
          const med = slice[2]; // median of 5 = middle element
          if (bestMed === null || med < bestMed) bestMed = med;
        }
        return bestMed;
      };

      // Helper: median of the best 60% of laps
      const computeMedian60 = (times) => {
        const sorted = [...times].sort((a, b) => a - b);
        const count = Math.ceil(sorted.length * 0.6);
        if (count < 3) return null;
        const best60 = sorted.slice(0, count);
        const mid = Math.floor(best60.length / 2);
        return best60.length % 2 !== 0 ? best60[mid] : (best60[mid - 1] + best60[mid]) / 2;
      };

      // Group by car -> all times (for global best median)
      // Group by car -> session -> times (for per-session history)
      const carTimesMap = new Map();
      const carSessionTimesMap = new Map(); // carId -> Map<sessionId, times[]>
      for (const l of allLaps) {
        if (!carTimesMap.has(l.carId)) carTimesMap.set(l.carId, []);
        carTimesMap.get(l.carId).push(l.lapTime);

        if (!carSessionTimesMap.has(l.carId)) carSessionTimesMap.set(l.carId, new Map());
        const sessionMap = carSessionTimesMap.get(l.carId);
        if (!sessionMap.has(l.sessionId)) sessionMap.set(l.sessionId, []);
        sessionMap.get(l.sessionId).push(l.lapTime);
      }

      // Compute global best median + median60 per car
      const bestMedianMap = new Map();
      const median60Map = new Map();
      for (const [carId, times] of carTimesMap) {
        bestMedianMap.set(carId, computeBestMedian(times));
        median60Map.set(carId, computeMedian60(times));
      }

      // Compute per-session best median history per car (ordered chronologically)
      const historyMap = new Map();
      for (const [carId, sessionMap] of carSessionTimesMap) {
        const history = [...sessionMap.entries()]
          .sort((a, b) => (sessionOrder.get(a[0]) ?? 0) - (sessionOrder.get(b[0]) ?? 0))
          .map(([sessionId, times]) => ({
            bestMedian: computeBestMedian(times),
            median60: computeMedian60(times),
            laps: times.length,
          }))
          .filter(h => h.bestMedian !== null || h.median60 !== null);
        historyMap.set(carId, history);
      }

      return laps.map(lap => ({
        ...lap,
        car: withImageUrl(lap.car),
        driver: withImageUrl(lap.driver),
        laps: countMap.get(lap.carId) || 0,
        bestMedian: bestMedianMap.get(lap.carId) || null,
        median60: median60Map.get(lap.carId) || null,
        history: historyMap.get(lap.carId) || [],
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
