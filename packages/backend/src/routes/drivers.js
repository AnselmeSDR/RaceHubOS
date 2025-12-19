import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/drivers - List all drivers
router.get('/', async (req, res) => {
  try {
    const drivers = await prisma.driver.findMany({
      include: {
        team: true,
        _count: {
          select: {
            laps: true,
            sessions: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    res.json({
      success: true,
      data: drivers,
      count: drivers.length,
    });
  } catch (error) {
    console.error('Error fetching drivers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch drivers',
    });
  }
});

// GET /api/drivers/:id - Get driver by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const driver = await prisma.driver.findUnique({
      where: { id },
      include: {
        team: true,
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
        laps: {
          orderBy: {
            lapTime: 'asc',
          },
          take: 5, // Top 5 best laps
        },
      },
    });

    if (!driver) {
      return res.status(404).json({
        success: false,
        error: 'Driver not found',
      });
    }

    res.json({
      success: true,
      data: driver,
    });
  } catch (error) {
    console.error('Error fetching driver:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch driver',
    });
  }
});

// POST /api/drivers - Create new driver
router.post('/', async (req, res) => {
  try {
    const { name, number, email, photo, color, teamId } = req.body;

    // Validation
    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Name is required',
      });
    }

    const driver = await prisma.driver.create({
      data: {
        name: name.trim(),
        number: number || null,
        email: email?.trim() || null,
        photo: photo || null,
        color: color || '#3B82F6',
        teamId: teamId || null,
      },
      include: {
        team: true,
      },
    });

    res.status(201).json({
      success: true,
      data: driver,
    });
  } catch (error) {
    console.error('Error creating driver:', error);

    // Handle unique constraint violation (email or number)
    if (error.code === 'P2002') {
      const field = error.meta?.target?.[0] || 'field';
      return res.status(400).json({
        success: false,
        error: `${field === 'number' ? 'Number' : 'Email'} already exists`,
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to create driver',
    });
  }
});

// PUT /api/drivers/:id - Update driver
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, number, email, photo, color, teamId } = req.body;

    // Check if driver exists
    const exists = await prisma.driver.findUnique({
      where: { id },
    });

    if (!exists) {
      return res.status(404).json({
        success: false,
        error: 'Driver not found',
      });
    }

    // Build update data
    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (number !== undefined) updateData.number = number || null;
    if (email !== undefined) updateData.email = email?.trim() || null;
    if (photo !== undefined) updateData.photo = photo;
    if (color !== undefined) updateData.color = color;
    if (teamId !== undefined) updateData.teamId = teamId || null;

    const driver = await prisma.driver.update({
      where: { id },
      data: updateData,
      include: {
        team: true,
      },
    });

    res.json({
      success: true,
      data: driver,
    });
  } catch (error) {
    console.error('Error updating driver:', error);

    // Handle unique constraint violation (email or number)
    if (error.code === 'P2002') {
      const field = error.meta?.target?.[0] || 'field';
      return res.status(400).json({
        success: false,
        error: `${field === 'number' ? 'Number' : 'Email'} already exists`,
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to update driver',
    });
  }
});

// DELETE /api/drivers/:id - Delete driver
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if driver exists
    const exists = await prisma.driver.findUnique({
      where: { id },
    });

    if (!exists) {
      return res.status(404).json({
        success: false,
        error: 'Driver not found',
      });
    }

    await prisma.driver.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: 'Driver deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting driver:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete driver',
    });
  }
});

// GET /api/drivers/:id/stats - Get driver statistics
router.get('/:id/stats', async (req, res) => {
  try {
    const { id } = req.params;

    const driver = await prisma.driver.findUnique({
      where: { id },
      include: {
        sessions: {
          include: {
            session: true,
          },
        },
        laps: {
          include: {
            session: true,
          },
        },
      },
    });

    if (!driver) {
      return res.status(404).json({
        success: false,
        error: 'Driver not found',
      });
    }

    // Calculate statistics
    const totalSessions = driver.sessions.length;
    const totalLaps = driver.laps.length;
    const bestLapTime = driver.bestLap;

    const avgLapTime = totalLaps > 0
      ? driver.laps.reduce((sum, lap) => sum + lap.lapTime, 0) / totalLaps
      : null;

    // Count wins (finalPos === 1)
    const wins = driver.sessions.filter(s => s.finalPos === 1).length;

    // Count podiums (finalPos <= 3)
    const podiums = driver.sessions.filter(s => s.finalPos && s.finalPos <= 3).length;

    res.json({
      success: true,
      data: {
        driver: {
          id: driver.id,
          name: driver.name,
        },
        stats: {
          totalSessions,
          totalLaps,
          wins,
          podiums,
          bestLapTime,
          avgLapTime,
          winRate: totalSessions > 0 ? (wins / totalSessions) * 100 : 0,
          podiumRate: totalSessions > 0 ? (podiums / totalSessions) * 100 : 0,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching driver stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch driver statistics',
    });
  }
});

export default router;
