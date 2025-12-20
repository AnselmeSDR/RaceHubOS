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
 * POST /api/sessions/:id/start
 * Démarre une session (passe en status 'active')
 */
router.post('/:id/start', async (req, res) => {
  try {
    const { id } = req.params;

    const session = await sessionManager.prisma.session.update({
      where: { id },
      data: {
        status: 'active',
        startedAt: new Date()
      },
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

    // Configure TrackSync with active session (for real CU)
    if (sessionManager.trackSync) {
      sessionManager.trackSync.activeSessionId = id;
      sessionManager.trackSync.sessionDrivers.clear();
      for (const sd of session.drivers) {
        sessionManager.trackSync.sessionDrivers.set(sd.controller, {
          sessionDriverId: sd.id,
          driverId: sd.driverId,
          carId: sd.carId,
          driver: sd.driver,
          car: sd.car,
          lapCount: 0,
          lastLapTime: null,
          position: sd.position || 0,
        });
      }
      // Set phase based on session type
      sessionManager.trackSync.currentPhase = session.type === 'qualifying' ? 'qualif' : 'race';
    }

    // Configure SimulatorSync with active session (for simulator)
    if (sessionManager.simulatorSync) {
      sessionManager.simulatorSync.activeSessionId = id;
      sessionManager.simulatorSync.activeTrackId = session.trackId;
      sessionManager.simulatorSync.sessionDrivers.clear();
      sessionManager.simulatorSync.currentPhase = session.type === 'qualifying' ? 'qualif' : 'race';
      for (const sd of session.drivers) {
        // Simulator uses carId (integer) as key
        const carId = parseInt(sd.controller);
        sessionManager.simulatorSync.sessionDrivers.set(carId, {
          sessionDriverId: sd.id,
          driverId: sd.driverId,
          carId: sd.carId,
          controller: sd.controller,
          driver: sd.driver,
          car: sd.car,
        });
      }

      // Start the simulator
      if (sessionManager.simulator) {
        console.log('🏎️ Starting simulator for session');
        sessionManager.simulator.start();
      }
    }

    sessionManager.io?.emit('session:started', { session });

    res.json({
      success: true,
      data: session,
      message: 'Session démarrée'
    });
  } catch (error) {
    console.error('Error starting session:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/sessions/:id/stop
 * Arrête une session (passe en status 'finished')
 */
router.post('/:id/stop', async (req, res) => {
  try {
    const { id } = req.params;

    const session = await sessionManager.prisma.session.update({
      where: { id },
      data: {
        status: 'finished',
        finishedAt: new Date()
      },
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

    // Clear TrackSync
    if (sessionManager.trackSync) {
      sessionManager.trackSync.activeSessionId = null;
      sessionManager.trackSync.sessionDrivers.clear();
      sessionManager.trackSync.currentPhase = 'free';
    }

    // Clear SimulatorSync and stop simulator
    if (sessionManager.simulatorSync) {
      sessionManager.simulatorSync.activeSessionId = null;
      sessionManager.simulatorSync.activeTrackId = null;
      sessionManager.simulatorSync.sessionDrivers.clear();
      sessionManager.simulatorSync.currentPhase = 'free';

      // Stop the simulator
      if (sessionManager.simulator) {
        console.log('🛑 Stopping simulator');
        sessionManager.simulator.stop();
      }
    }

    sessionManager.io?.emit('session:stopped', { session });

    res.json({
      success: true,
      data: session,
      message: 'Session terminée'
    });
  } catch (error) {
    console.error('Error stopping session:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/sessions/:id/drivers
 * Met à jour les pilotes d'une session
 * Body: { drivers: [{ controller, driverId, carId }] }
 */
router.put('/:id/drivers', async (req, res) => {
  try {
    const { id } = req.params;
    const { drivers } = req.body;

    if (!Array.isArray(drivers)) {
      return res.status(400).json({
        success: false,
        error: 'drivers must be an array'
      });
    }

    // Verify session exists
    const session = await sessionManager.prisma.session.findUnique({
      where: { id }
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    // Delete existing session drivers
    await sessionManager.prisma.sessionDriver.deleteMany({
      where: { sessionId: id }
    });

    // Create new session drivers
    const validDrivers = drivers.filter(d => d.driverId && d.carId && d.controller);

    if (validDrivers.length > 0) {
      await sessionManager.prisma.sessionDriver.createMany({
        data: validDrivers.map((d, idx) => ({
          sessionId: id,
          driverId: d.driverId,
          carId: d.carId,
          controller: String(d.controller),
          gridPos: idx + 1
        }))
      });
    }

    // Fetch updated session with drivers
    const updatedSession = await sessionManager.prisma.session.findUnique({
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
        }
      }
    });

    res.json({
      success: true,
      data: updatedSession
    });
  } catch (error) {
    console.error('Error updating session drivers:', error);
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
