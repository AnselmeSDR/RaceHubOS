import express from 'express';
import { SessionManager } from '../services/SessionManager.js';

const router = express.Router();
let sessionManager;

export function setSessionManager(manager) {
  sessionManager = manager;
}

/**
 * GET /api/sessions
 * Liste toutes les sessions
 */
router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    const where = status && status !== 'all' ? { status } : {};

    const sessions = await sessionManager.prisma.session.findMany({
      where,
      include: {
        track: true,
        championship: true,
        drivers: {
          include: {
            driver: true,
            car: true
          }
        },
        _count: {
          select: {
            laps: true,
            events: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json({
      success: true,
      data: sessions,
      count: sessions.length
    });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/sessions/:id
 * Récupère une session par ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const session = await sessionManager.prisma.session.findUnique({
      where: { id },
      include: {
        track: true,
        championship: true,
        drivers: {
          include: {
            driver: true,
            car: true
          },
          orderBy: {
            controller: 'asc'
          }
        },
        laps: {
          include: {
            driver: true
          },
          orderBy: {
            timestamp: 'asc'
          }
        },
        events: {
          orderBy: {
            timestamp: 'asc'
          }
        }
      }
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    res.json({
      success: true,
      data: session
    });
  } catch (error) {
    console.error('Error fetching session:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/sessions
 * Crée une nouvelle session (simple CRUD, no phases)
 */
router.post('/', async (req, res) => {
  try {
    const { name, type, trackId, championshipId, fuelMode, drivers } = req.body;

    // Validation
    if (!type || !trackId) {
      return res.status(400).json({
        success: false,
        error: 'type and trackId are required'
      });
    }

    const session = await sessionManager.createSession({
      name,
      type,
      trackId,
      championshipId,
      fuelMode,
      drivers
    });

    res.status(201).json({
      success: true,
      data: session
    });
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/sessions/:id
 * Modifie une session (CRUD simple, pas de logique métier)
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, trackId, championshipId, fuelMode, duration, maxLaps } = req.body;

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (type !== undefined) updateData.type = type;
    if (trackId !== undefined) updateData.trackId = trackId;

    // Handle championshipId: empty string becomes null
    if (championshipId !== undefined) {
      updateData.championshipId = championshipId === '' ? null : championshipId;
    }

    if (fuelMode !== undefined) updateData.fuelMode = fuelMode;
    if (duration !== undefined) updateData.duration = duration || null;
    if (maxLaps !== undefined) updateData.maxLaps = maxLaps || null;

    const session = await sessionManager.prisma.session.update({
      where: { id },
      data: updateData,
      include: {
        track: true,
        championship: true,
        drivers: {
          include: {
            driver: true,
            car: true
          }
        }
      }
    });

    res.json({
      success: true,
      data: session
    });
  } catch (error) {
    console.error('Error updating session:', error);

    // Provide more helpful error message for foreign key violations
    if (error.code === 'P2003') {
      return res.status(400).json({
        success: false,
        error: 'Invalid reference: trackId or championshipId does not exist'
      });
    }

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/sessions/:id
 * Supprime une session
 * Query param: ?keepLaps=true to preserve laps as free practice laps (sessionId = null)
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { keepLaps } = req.query;

    // If keepLaps=true, update laps to remove session reference before deleting
    if (keepLaps === 'true') {
      await sessionManager.prisma.lap.updateMany({
        where: { sessionId: id },
        data: { sessionId: null }
      });
    }

    await sessionManager.prisma.session.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: keepLaps === 'true'
        ? 'Session deleted, laps preserved as free practice'
        : 'Session deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting session:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
