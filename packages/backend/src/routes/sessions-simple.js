import express from 'express';
import { SessionManager } from '../services/SessionManager.js';

const router = express.Router();
let sessionManager;
let championshipSessionManager;

export function setSessionManager(manager) {
  sessionManager = manager;
}

export function setChampionshipSessionManager(manager) {
  championshipSessionManager = manager;
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
    const { name, type, trackId, championshipId, fuelMode, drivers, duration, maxLaps } = req.body;

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
      drivers,
      duration,
      maxLaps
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
    const { name, type, trackId, championshipId, fuelMode, duration, maxLaps, order } = req.body;

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
    if (order !== undefined) updateData.order = order;

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
 * Gère automatiquement le CU/Simulateur et le ChampionshipSessionManager
 */
router.post('/:id/start', async (req, res) => {
  try {
    const { id } = req.params;

    // Get session with drivers
    const session = await sessionManager.prisma.session.findUnique({
      where: { id },
      include: {
        track: true,
        championship: true,
        drivers: { include: { driver: true, car: true } }
      }
    });

    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    if (session.status !== 'ready') {
      return res.status(400).json({
        success: false,
        error: `Session must be in 'ready' status to start, current: ${session.status}`
      });
    }

    let updatedSession;

    // Use ChampionshipSessionManager for championship sessions
    if (championshipSessionManager && session.championshipId) {
      updatedSession = await championshipSessionManager.startSession(id);
    } else {
      // Direct update for non-championship sessions
      updatedSession = await sessionManager.prisma.session.update({
        where: { id },
        data: { status: 'active', startedAt: new Date() },
        include: {
          track: true,
          championship: true,
          drivers: { include: { driver: true, car: true } }
        }
      });
    }

    // Reset, configure and start CU/Simulator via wrapper
    await sessionManager.resetForNewSession();
    sessionManager.configureActiveSession(updatedSession);
    sessionManager.startRace();

    sessionManager.io?.emit('session:started', { session: updatedSession });

    res.json({
      success: true,
      data: updatedSession,
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
 * Gère automatiquement le CU/Simulateur et le ChampionshipSessionManager
 */
router.post('/:id/stop', async (req, res) => {
  try {
    const { id } = req.params;

    // Get session
    const session = await sessionManager.prisma.session.findUnique({
      where: { id },
      include: { championship: true }
    });

    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    if (session.status !== 'active' && session.status !== 'finishing') {
      return res.status(400).json({
        success: false,
        error: `Session must be 'active' or 'finishing' to stop, current: ${session.status}`
      });
    }

    let updatedSession;

    // Use ChampionshipSessionManager for championship sessions
    if (championshipSessionManager && session.championshipId) {
      await championshipSessionManager.forceFinish(id);
      updatedSession = await sessionManager.prisma.session.findUnique({
        where: { id },
        include: {
          track: true,
          championship: true,
          drivers: { include: { driver: true, car: true } }
        }
      });
    } else {
      // Direct update for non-championship sessions
      updatedSession = await sessionManager.prisma.session.update({
        where: { id },
        data: { status: 'finished', finishedAt: new Date() },
        include: {
          track: true,
          championship: true,
          drivers: { include: { driver: true, car: true } }
        }
      });

      // Notify frontend to refetch standings
      if (session.championshipId) {
        sessionManager.io?.emit('standings_changed', {
          event: 'standings_changed',
          data: {
            championshipId: session.championshipId,
            types: [session.type === 'qualif' ? 'qualif' : session.type]
          }
        });
      }
    }

    // Stop and clear CU/Simulator via wrapper
    sessionManager.stopRace();
    sessionManager.clearActiveSession();

    sessionManager.io?.emit('session:stopped', { session: updatedSession });

    res.json({
      success: true,
      data: updatedSession,
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
 * POST /api/sessions/:id/restart
 * Redémarre une session (supprime laps, events, reset status)
 */
router.post('/:id/restart', async (req, res) => {
  try {
    const { id } = req.params;

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

    // Delete all laps for this session
    await sessionManager.prisma.lap.deleteMany({
      where: { sessionId: id }
    });

    // Delete all events for this session
    await sessionManager.prisma.raceEvent.deleteMany({
      where: { sessionId: id }
    });

    // Reset session driver stats
    await sessionManager.prisma.sessionDriver.updateMany({
      where: { sessionId: id },
      data: {
        position: null,
        finalPos: null,
        totalLaps: 0,
        totalTime: 0,
        bestLapTime: null,
        lastLapTime: null,
        isDNF: false,
        lapsAtFinishing: null
      }
    });

    // Reset session status to 'ready' (ready to start again)
    const updatedSession = await sessionManager.prisma.session.update({
      where: { id },
      data: {
        status: 'ready',
        startedAt: null,
        finishingAt: null,
        finishedAt: null
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

    // Reset CU/Simulator
    if (sessionManager.trackSync?.resetForNewSession) {
      await sessionManager.trackSync.resetForNewSession();
    }
    if (sessionManager.simulatorSync?.resetForNewSession) {
      await sessionManager.simulatorSync.resetForNewSession();
    }

    // Re-configure TrackSync for the session
    if (sessionManager.trackSync) {
      sessionManager.trackSync.activeSessionId = id;
      sessionManager.trackSync.activeTrackId = updatedSession.trackId;
      sessionManager.trackSync.currentPhase = updatedSession.type === 'qualif' ? 'qualif' : 'race';
      for (const sd of updatedSession.drivers) {
        sessionManager.trackSync.mapDriverByController.set(sd.controller, {
          sessionDriverId: sd.id,
          driverId: sd.driverId,
          carId: sd.carId,
          driver: sd.driver,
          car: sd.car,
          lapCount: 0,
          lastLapTime: null,
          position: sd.gridPos || 0,
        });
      }
    }

    // Re-configure SimulatorSync for the session
    if (sessionManager.simulatorSync) {
      sessionManager.simulatorSync.activeSessionId = id;
      sessionManager.simulatorSync.activeTrackId = updatedSession.trackId;
      sessionManager.simulatorSync.currentPhase = updatedSession.type === 'qualif' ? 'qualif' : 'race';
      for (const sd of updatedSession.drivers) {
        // controller is now 0-indexed int, use directly as map key
        sessionManager.simulatorSync.mapDriverByController.set(sd.controller, {
          sessionDriverId: sd.id,
          driverId: sd.driverId,
          carId: sd.carId,
          controller: sd.controller,
          driver: sd.driver,
          car: sd.car,
          lapCount: 0,
          lastLapTime: null,
          bestLapTime: null,
        });
      }
    }

    sessionManager.io?.emit('session:restarted', { session: updatedSession });

    res.json({
      success: true,
      data: updatedSession,
      message: 'Session redémarrée, résultats supprimés'
    });
  } catch (error) {
    console.error('Error restarting session:', error);
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
          controller: Number(d.controller), // 0-indexed int
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
 * PATCH /api/sessions/:id/status
 * Change session status with validation
 * Body: { status: "draft" | "ready" | "active" | "finishing" | "finished" }
 * Transitions:
 *   - draft <-> ready (bidirectional)
 *   - ready -> active
 *   - active -> finishing -> finished
 *   - active -> finished (force stop)
 *   - finished -> draft (reset for re-run)
 */
router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status: newStatus } = req.body;

    if (!newStatus) {
      return res.status(400).json({
        success: false,
        error: 'status is required'
      });
    }

    const validStatuses = ['draft', 'ready', 'active', 'finishing', 'finished'];
    if (!validStatuses.includes(newStatus)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    // Get current session
    const session = await sessionManager.prisma.session.findUnique({
      where: { id },
      include: {
        drivers: {
          include: { driver: true, car: true }
        },
        championship: true,
        track: true
      }
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    const currentStatus = session.status;

    // Validate transition
    const allowedTransitions = {
      'draft': ['ready'],
      'ready': ['draft', 'active'],
      'active': ['finishing', 'finished'],
      'finishing': ['finished'],
      'finished': ['draft']
    };

    if (!allowedTransitions[currentStatus]?.includes(newStatus)) {
      return res.status(400).json({
        success: false,
        error: `Invalid transition from '${currentStatus}' to '${newStatus}'. Allowed: ${allowedTransitions[currentStatus]?.join(', ') || 'none'}`
      });
    }

    // Use ChampionshipSessionManager for championship sessions if available
    if (championshipSessionManager && session.championshipId) {
      try {
        let updatedSession;

        if (newStatus === 'active' && currentStatus === 'ready') {
          // Start session via ChampionshipSessionManager (handles heartbeat, etc.)
          updatedSession = await championshipSessionManager.startSession(id);

          // Configure and start CU/Simulator via SessionManager wrapper
          sessionManager.configureActiveSession(updatedSession);
          sessionManager.startRace();
        } else if (newStatus === 'finished' && (currentStatus === 'active' || currentStatus === 'finishing')) {
          // Force finish session
          await championshipSessionManager.forceFinish(id);
          updatedSession = await sessionManager.prisma.session.findUnique({
            where: { id },
            include: {
              track: true,
              championship: true,
              drivers: { include: { driver: true, car: true } }
            }
          });

          // Stop and clear CU/Simulator
          sessionManager.stopRace();
          sessionManager.clearActiveSession();
        } else if (newStatus === 'draft' || newStatus === 'ready') {
          // Status change via ChampionshipSessionManager
          updatedSession = await championshipSessionManager.changeSessionStatus(id, newStatus);
        } else {
          // Fallback to direct update
          updatedSession = await sessionManager.prisma.session.update({
            where: { id },
            data: { status: newStatus },
            include: {
              track: true,
              championship: true,
              drivers: { include: { driver: true, car: true } }
            }
          });
        }

        return res.json({
          success: true,
          data: updatedSession,
          message: `Session status changed from '${currentStatus}' to '${newStatus}'`
        });
      } catch (err) {
        console.error('Error via ChampionshipSessionManager:', err);
        return res.status(500).json({
          success: false,
          error: err.message
        });
      }
    }

    // Fallback: direct update for non-championship sessions
    const updateData = { status: newStatus };

    if (newStatus === 'active') {
      updateData.startedAt = new Date();
    } else if (newStatus === 'finishing') {
      updateData.finishingAt = new Date();
    } else if (newStatus === 'finished') {
      updateData.finishedAt = new Date();
    } else if (newStatus === 'draft' && currentStatus === 'finished') {
      // Reset for re-run
      updateData.startedAt = null;
      updateData.finishingAt = null;
      updateData.finishedAt = null;
    }

    // Update session
    const updatedSession = await sessionManager.prisma.session.update({
      where: { id },
      data: updateData,
      include: {
        track: true,
        championship: true,
        drivers: {
          include: { driver: true, car: true },
          orderBy: { controller: 'asc' }
        }
      }
    });

    // Handle side effects for status changes
    if (newStatus === 'active') {
      // Configure TrackSync with active session
      if (sessionManager.trackSync) {
        sessionManager.trackSync.activeSessionId = id;
        sessionManager.trackSync.mapDriverByController.clear();
        for (const sd of updatedSession.drivers) {
          sessionManager.trackSync.mapDriverByController.set(sd.controller, {
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
        sessionManager.trackSync.currentPhase = updatedSession.type === 'qualif' ? 'qualif' :
                                                  updatedSession.type === 'practice' ? 'free' : 'race';
      }

      // Configure SimulatorSync
      if (sessionManager.simulatorSync) {
        sessionManager.simulatorSync.activeSessionId = id;
        sessionManager.simulatorSync.activeTrackId = updatedSession.trackId;
        sessionManager.simulatorSync.mapDriverByController.clear();
        sessionManager.simulatorSync.currentPhase = updatedSession.type === 'qualif' ? 'qualif' :
                                                     updatedSession.type === 'practice' ? 'free' : 'race';
        for (const sd of updatedSession.drivers) {
          // controller is now 0-indexed int, use directly as map key
          sessionManager.simulatorSync.mapDriverByController.set(sd.controller, {
            sessionDriverId: sd.id,
            driverId: sd.driverId,
            carId: sd.carId,
            controller: sd.controller,
            driver: sd.driver,
            car: sd.car,
          });
        }

        if (sessionManager.simulator) {
          sessionManager.simulator.start();
        }
      }

      sessionManager.io?.emit('session:started', { session: updatedSession });
      sessionManager.io?.emit('session_status_changed', {
        event: 'session_status_changed',
        data: {
          sessionId: id,
          championshipId: updatedSession.championshipId,
          previousStatus: currentStatus,
          status: newStatus,
          timestamp: new Date().toISOString()
        }
      });
    } else if (newStatus === 'finished') {
      // Clear TrackSync
      if (sessionManager.trackSync) {
        sessionManager.trackSync.activeSessionId = null;
        sessionManager.trackSync.mapDriverByController.clear();
        sessionManager.trackSync.currentPhase = 'free';
      }

      // Clear SimulatorSync
      if (sessionManager.simulatorSync) {
        sessionManager.simulatorSync.activeSessionId = null;
        sessionManager.simulatorSync.activeTrackId = null;
        sessionManager.simulatorSync.mapDriverByController.clear();
        sessionManager.simulatorSync.currentPhase = 'free';
        sessionManager.simulator?.stop();
      }

      sessionManager.io?.emit('session:stopped', { session: updatedSession });
      sessionManager.io?.emit('session_status_changed', {
        event: 'session_status_changed',
        data: {
          sessionId: id,
          championshipId: updatedSession.championshipId,
          previousStatus: currentStatus,
          status: newStatus,
          timestamp: new Date().toISOString()
        }
      });

      // Notify frontend to refetch standings
      if (updatedSession.championshipId) {
        sessionManager.io?.emit('standings_changed', {
          event: 'standings_changed',
          data: {
            championshipId: updatedSession.championshipId,
            types: [updatedSession.type === 'qualif' ? 'qualif' : updatedSession.type]
          }
        });
      }
    } else {
      // draft <-> ready transitions
      sessionManager.io?.emit('session_status_changed', {
        event: 'session_status_changed',
        data: {
          sessionId: id,
          championshipId: updatedSession.championshipId,
          previousStatus: currentStatus,
          status: newStatus,
          timestamp: new Date().toISOString()
        }
      });
    }

    res.json({
      success: true,
      data: updatedSession,
      message: `Session status changed from '${currentStatus}' to '${newStatus}'`
    });
  } catch (error) {
    console.error('Error changing session status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/sessions/:id/leaderboard
 * Get live leaderboard for a session
 */
router.get('/:id/leaderboard', async (req, res) => {
  try {
    const { id } = req.params;

    if (championshipSessionManager) {
      const leaderboard = await championshipSessionManager.getSessionLeaderboard(id);
      return res.json({
        success: true,
        data: leaderboard
      });
    }

    // Fallback: basic leaderboard calculation
    const session = await sessionManager.prisma.session.findUnique({
      where: { id },
      include: {
        drivers: { include: { driver: true, car: true } }
      }
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    const entries = [];
    for (const sd of session.drivers) {
      const laps = await sessionManager.prisma.lap.findMany({
        where: {
          sessionId: id,
          controller: sd.controller,
          softDeletedAt: null
        },
        orderBy: { timestamp: 'desc' }
      });

      const totalLaps = laps.length;
      const totalTime = laps.reduce((sum, lap) => sum + Math.round(lap.lapTime), 0);
      const bestLap = laps.length > 0 ? Math.min(...laps.map(l => l.lapTime)) : null;
      const lastLap = laps.length > 0 ? laps[0].lapTime : null;

      entries.push({
        controller: sd.controller,
        driverId: sd.driverId,
        driver: sd.driver,
        car: sd.car,
        totalLaps,
        totalTime,
        bestLap,
        lastLap,
        position: 0,
        gap: null
      });
    }

    // Sort entries
    if (session.type === 'qualif') {
      entries.sort((a, b) => {
        if (a.bestLap === null && b.bestLap === null) return 0;
        if (a.bestLap === null) return 1;
        if (b.bestLap === null) return -1;
        return a.bestLap - b.bestLap;
      });
    } else {
      entries.sort((a, b) => {
        if (a.totalLaps !== b.totalLaps) return b.totalLaps - a.totalLaps;
        return a.totalTime - b.totalTime;
      });
    }

    // Calculate positions
    for (let i = 0; i < entries.length; i++) {
      entries[i].position = i + 1;
    }

    res.json({
      success: true,
      data: entries
    });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/sessions/:id/reset
 * Reset a session - behavior depends on session type:
 * - practice: soft delete laps (keeps history)
 * - qualifying/race: hard delete laps + reset stats + status to 'ready'
 */
router.post('/:id/reset', async (req, res) => {
  try {
    const { id } = req.params;

    const session = await sessionManager.prisma.session.findUnique({
      where: { id },
      include: { championship: true }
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    if (session.type === 'practice') {
      // Practice: soft delete laps
      if (championshipSessionManager) {
        await championshipSessionManager.resetPractice(id);
      } else {
        await sessionManager.prisma.lap.updateMany({
          where: { sessionId: id, softDeletedAt: null },
          data: { softDeletedAt: new Date() }
        });

        sessionManager.io?.emit('practice_reset', {
          event: 'practice_reset',
          data: {
            sessionId: id,
            championshipId: session.championshipId,
            timestamp: new Date().toISOString()
          }
        });
      }

      if (session.championshipId) {
        sessionManager.io?.emit('standings_changed', {
          event: 'standings_changed',
          data: { championshipId: session.championshipId, types: ['practice'] }
        });
      }

      return res.json({ success: true, message: 'Practice session reset' });
    }

    // Qualifying/Race: hard delete + full reset
    await sessionManager.prisma.lap.deleteMany({ where: { sessionId: id } });
    await sessionManager.prisma.raceEvent.deleteMany({ where: { sessionId: id } });

    await sessionManager.prisma.sessionDriver.updateMany({
      where: { sessionId: id },
      data: {
        position: null,
        finalPos: null,
        totalLaps: 0,
        totalTime: 0,
        bestLapTime: null,
        lastLapTime: null,
        isDNF: false,
        lapsAtFinishing: null
      }
    });

    const updatedSession = await sessionManager.prisma.session.update({
      where: { id },
      data: {
        status: 'ready',
        startedAt: null,
        finishingAt: null,
        finishedAt: null
      },
      include: {
        track: true,
        championship: true,
        drivers: { include: { driver: true, car: true } }
      }
    });

    // Emit status change
    sessionManager.io?.emit('session_status_changed', {
      event: 'session_status_changed',
      data: {
        sessionId: id,
        championshipId: session.championshipId,
        previousStatus: session.status,
        status: 'ready',
        timestamp: new Date().toISOString()
      }
    });

    if (session.championshipId) {
      // Recalculate standings
      if (championshipSessionManager) {
        await championshipSessionManager.recalculateStandings(session.championshipId);
      }

      sessionManager.io?.emit('standings_changed', {
        event: 'standings_changed',
        data: {
          championshipId: session.championshipId,
          types: [session.type === 'qualif' ? 'qualif' : 'race']
        }
      });
    }

    res.json({
      success: true,
      message: `Session reset to ready`,
      data: updatedSession
    });
  } catch (error) {
    console.error('Error resetting session:', error);
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

    // Get session info for standings update
    const session = await sessionManager.prisma.session.findUnique({
      where: { id },
      include: { championship: true }
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    // Use ChampionshipSessionManager for championship sessions
    if (championshipSessionManager && session.championshipId && keepLaps !== 'true') {
      await championshipSessionManager.deleteSession(id);
      return res.json({
        success: true,
        message: 'Session deleted successfully'
      });
    }

    // Fallback: manual deletion
    // If keepLaps=true, update laps to remove session reference before deleting
    if (keepLaps === 'true') {
      await sessionManager.prisma.lap.updateMany({
        where: { sessionId: id },
        data: { sessionId: null }
      });
    }

    // Clear TrackRecord references (no cascade on this relation)
    await sessionManager.prisma.trackRecord.updateMany({
      where: { sessionId: id },
      data: { sessionId: null }
    });

    // Clear sync services if this was the active session
    if (sessionManager.trackSync?.activeSessionId === id) {
      sessionManager.trackSync.activeSessionId = null;
      sessionManager.trackSync.mapDriverByController.clear();
      sessionManager.trackSync.currentPhase = 'free';
    }
    if (sessionManager.simulatorSync?.activeSessionId === id) {
      sessionManager.simulatorSync.activeSessionId = null;
      sessionManager.simulatorSync.mapDriverByController.clear();
      sessionManager.simulatorSync.currentPhase = 'free';
      sessionManager.simulator?.stop();
    }

    await sessionManager.prisma.session.delete({
      where: { id }
    });

    // Emit session_deleted event
    sessionManager.io?.emit('session_deleted', {
      event: 'session_deleted',
      data: {
        sessionId: id,
        championshipId: session.championshipId,
        type: session.type
      }
    });

    // Notify frontend to refetch standings
    if (session.championshipId) {
      sessionManager.io?.emit('standings_changed', {
        event: 'standings_changed',
        data: {
          championshipId: session.championshipId,
          types: [session.type === 'qualif' ? 'qualif' : session.type]
        }
      });
    }

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
