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
        phases: true,
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
        phases: true,
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

    // Calculer la phase courante et son status pour le frontend
    const runningPhase = session.phases?.find(p => p.status === 'running');
    const pausedPhase = session.phases?.find(p => p.status === 'paused');
    const activePhase = runningPhase || pausedPhase || session.phases?.[0];

    const enrichedSession = {
      ...session,
      currentPhase: activePhase?.phase || 'practice',
      phaseStatus: activePhase?.status || 'waiting',
      phaseStartedAt: activePhase?.startedAt,
      phaseFinishedAt: activePhase?.finishedAt
    };

    res.json({
      success: true,
      data: enrichedSession
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
 * Crée une nouvelle session
 */
router.post('/', async (req, res) => {
  try {
    const { name, type, trackId, championshipId, fuelMode, drivers, phases } = req.body;

    // Validation
    if (!type || !trackId) {
      return res.status(400).json({
        success: false,
        error: 'type and trackId are required'
      });
    }

    // Créer les phases par défaut si non fournies
    const defaultPhases = phases || [
      { phase: 'practice', duration: null, maxLaps: null },
      { phase: 'qualifying', duration: null, maxLaps: null },
      { phase: 'race', duration: null, maxLaps: null }
    ];

    const session = await sessionManager.createSession({
      name,
      type,
      trackId,
      championshipId,
      fuelMode,
      drivers,
      phases: defaultPhases
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
        },
        phases: true
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
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await sessionManager.prisma.session.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Session deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting session:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/sessions/:id/phases/:phaseId
 * Met à jour une phase (duration, maxLaps)
 */
router.put('/:id/phases/:phaseId', async (req, res) => {
  try {
    const { phaseId } = req.params;
    const { duration, maxLaps } = req.body;

    const updateData = {};
    if (duration !== undefined) updateData.duration = duration || null;
    if (maxLaps !== undefined) updateData.maxLaps = maxLaps || null;

    const phase = await sessionManager.prisma.sessionPhase.update({
      where: { id: phaseId },
      data: updateData
    });

    res.json({
      success: true,
      data: phase
    });
  } catch (error) {
    console.error('Error updating phase:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
