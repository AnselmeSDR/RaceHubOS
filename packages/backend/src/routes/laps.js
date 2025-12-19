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
    console.error('Error deleting laps by phase:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
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
    console.error('Error fetching laps by phase:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
