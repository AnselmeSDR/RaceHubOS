import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// Delete laps by phase
router.delete('/by-phase', async (req, res) => {
  try {
    const { sessionId, phase } = req.body;

    if (!sessionId || !phase) {
      return res.status(400).json({
        success: false,
        error: 'sessionId and phase are required'
      });
    }

    // Delete all laps for this session and phase
    const result = await prisma.lap.deleteMany({
      where: {
        sessionId,
        phase
      }
    });

    res.json({
      success: true,
      message: `${result.count} laps deleted`,
      count: result.count
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/laps/free
 * Save a free practice lap - upserts based on trackId/driverId/carId
 * Only keeps the best time per driver/car/track combo
 */
router.post('/free', async (req, res) => {
  try {
    const { trackId, driverId, carId, controller, lapTime } = req.body;

    if (!trackId || !driverId || !carId || !controller || !lapTime) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: trackId, driverId, carId, controller, lapTime'
      });
    }

    // Find existing free practice lap for this combo
    const existing = await prisma.lap.findFirst({
      where: {
        trackId,
        driverId,
        carId,
        phase: 'free',
        sessionId: null
      }
    });

    let lap;
    let isNewRecord = false;

    if (existing) {
      // Only update if new time is better
      if (lapTime < existing.lapTime) {
        lap = await prisma.lap.update({
          where: { id: existing.id },
          data: {
            lapTime,
            controller,
            timestamp: new Date()
          },
          include: { driver: true, car: true }
        });
        isNewRecord = true;
      } else {
        lap = existing;
      }
    } else {
      // Create new record
      lap = await prisma.lap.create({
        data: {
          trackId,
          driverId,
          carId,
          controller,
          phase: 'free',
          lapNumber: 1,
          lapTime
        },
        include: { driver: true, car: true }
      });
      isNewRecord = true;
    }

    res.json({ success: true, data: lap, isNewRecord });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get laps by session and phase
router.get('/by-phase', async (req, res) => {
  try {
    const { sessionId, phase } = req.query;

    if (!sessionId || !phase) {
      return res.status(400).json({
        success: false,
        error: 'sessionId and phase are required'
      });
    }

    const laps = await prisma.lap.findMany({
      where: {
        sessionId,
        phase
      },
      include: {
        driver: true,
        car: true
      },
      orderBy: {
        timestamp: 'asc'
      }
    });

    res.json({
      success: true,
      data: laps
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
