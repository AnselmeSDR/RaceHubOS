import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/sessions - Liste toutes les sessions
router.get('/', async (req, res) => {
  try {
    const sessions = await prisma.session.findMany({
      include: {
        track: true,
        championship: true,
        drivers: {
          include: {
            driver: true,
            car: true,
          },
        },
        _count: {
          select: {
            laps: true,
            events: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json({
      success: true,
      data: sessions,
      count: sessions.length,
    });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sessions',
    });
  }
});

// GET /api/sessions/:id - Récupère une session par ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const session = await prisma.session.findUnique({
      where: { id },
      include: {
        track: true,
        championship: true,
        drivers: {
          include: {
            driver: true,
            car: true,
          },
          orderBy: {
            controller: 'asc',
          },
        },
        laps: {
          include: {
            driver: true,
          },
          orderBy: {
            timestamp: 'asc',
          },
        },
        events: {
          orderBy: {
            timestamp: 'asc',
          },
        },
      },
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found',
      });
    }

    res.json({
      success: true,
      data: session,
    });
  } catch (error) {
    console.error('Error fetching session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch session',
    });
  }
});

// POST /api/sessions - Crée une nouvelle session
router.post('/', async (req, res) => {
  try {
    const {
      name,
      type,
      trackId,
      championshipId,
      duration,
      maxLaps,
      fuelMode,
      drivers, // Array of {driverId, carId, controller, gridPos?}
    } = req.body;

    // Validation
    if (!type || !trackId) {
      return res.status(400).json({
        success: false,
        error: 'Type and trackId are required',
      });
    }

    if (!['practice', 'qualifying', 'race'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Type must be practice, qualifying, or race',
      });
    }

    // Créer la session avec drivers et cars
    const session = await prisma.session.create({
      data: {
        name: name?.trim() || null,
        type,
        trackId,
        championshipId: championshipId || null,
        duration: duration || null,
        maxLaps: maxLaps || null,
        fuelMode: fuelMode || 'OFF',
        status: 'setup',
        drivers: drivers ? {
          create: drivers.map(d => ({
            driverId: d.driverId,
            carId: d.carId,
            controller: d.controller,
            position: d.position || null,
            gridPos: d.gridPos || null,
          })),
        } : undefined,
      },
      include: {
        track: true,
        championship: true,
        drivers: {
          include: {
            driver: true,
            car: true,
          },
        },
      },
    });

    res.status(201).json({
      success: true,
      data: session,
    });
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create session',
    });
  }
});

// PUT /api/sessions/:id - Modifie une session
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      type,
      trackId,
      championshipId,
      duration,
      maxLaps,
      fuelMode,
      status,
      startedAt,
      finishedAt,
    } = req.body;

    // Vérifier que la session existe
    const exists = await prisma.session.findUnique({
      where: { id },
    });

    if (!exists) {
      return res.status(404).json({
        success: false,
        error: 'Session not found',
      });
    }

    // Construire les données de mise à jour
    const updateData = {};
    if (name !== undefined) updateData.name = name?.trim() || null;
    if (type !== undefined) updateData.type = type;
    if (trackId !== undefined) updateData.trackId = trackId;
    if (championshipId !== undefined) updateData.championshipId = championshipId;
    if (duration !== undefined) updateData.duration = duration;
    if (maxLaps !== undefined) updateData.maxLaps = maxLaps;
    if (fuelMode !== undefined) updateData.fuelMode = fuelMode;
    if (status !== undefined) updateData.status = status;
    if (startedAt !== undefined) updateData.startedAt = startedAt;
    if (finishedAt !== undefined) updateData.finishedAt = finishedAt;

    const session = await prisma.session.update({
      where: { id },
      data: updateData,
      include: {
        track: true,
        championship: true,
        drivers: {
          include: {
            driver: true,
            car: true,
          },
        },
      },
    });

    res.json({
      success: true,
      data: session,
    });
  } catch (error) {
    console.error('Error updating session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update session',
    });
  }
});

// DELETE /api/sessions/:id - Supprime une session
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const exists = await prisma.session.findUnique({
      where: { id },
    });

    if (!exists) {
      return res.status(404).json({
        success: false,
        error: 'Session not found',
      });
    }

    await prisma.session.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: 'Session deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete session',
    });
  }
});

// PUT /api/sessions/:id/drivers/:driverId - Met à jour un pilote dans une session
router.put('/:id/drivers/:driverId', async (req, res) => {
  try {
    const { id, driverId } = req.params;
    const { position, gridPos, finalPos } = req.body;

    const sessionDriver = await prisma.sessionDriver.update({
      where: {
        sessionId_driverId: {
          sessionId: id,
          driverId,
        },
      },
      data: {
        position: position !== undefined ? position : undefined,
        gridPos: gridPos !== undefined ? gridPos : undefined,
        finalPos: finalPos !== undefined ? finalPos : undefined,
      },
      include: {
        driver: true,
      },
    });

    res.json({
      success: true,
      data: sessionDriver,
    });
  } catch (error) {
    console.error('Error updating session driver:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update session driver',
    });
  }
});

export default router;
