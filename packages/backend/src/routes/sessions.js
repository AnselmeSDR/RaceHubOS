import express from 'express';

const router = express.Router();
let sessionManager;
let championshipSessionManager;

export function setSessionManager(manager) {
  sessionManager = manager;
}

export function setChampionshipSessionManager(manager) {
  championshipSessionManager = manager;
}

// Helper: get prisma instance
const prisma = () => sessionManager.prisma;

/**
 * GET /api/sessions
 * List all sessions
 */
router.get('/', async (req, res) => {
  try {
    const { status, championshipId } = req.query;
    const where = {};
    if (status && status !== 'all') where.status = status;
    if (championshipId) where.championshipId = championshipId;

    const sessions = await prisma().session.findMany({
      where,
      include: {
        track: true,
        championship: true,
        drivers: { include: { driver: true, car: true } },
        _count: { select: { laps: true, events: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ success: true, data: sessions, count: sessions.length });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/sessions/:id
 * Get session by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const session = await prisma().session.findUnique({
      where: { id: req.params.id },
      include: {
        track: true,
        championship: true,
        drivers: {
          include: { driver: true, car: true },
          orderBy: { controller: 'asc' }
        },
        laps: {
          include: { driver: true },
          orderBy: { timestamp: 'asc' }
        },
        events: { orderBy: { timestamp: 'asc' } }
      }
    });

    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    res.json({ success: true, data: session });
  } catch (error) {
    console.error('Error fetching session:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/sessions
 * Create a new session
 */
router.post('/', async (req, res) => {
  try {
    const { name, type, trackId, championshipId, fuelMode, drivers, duration, maxLaps } = req.body;

    if (!type || !trackId) {
      return res.status(400).json({ success: false, error: 'type and trackId are required' });
    }

    const session = await prisma().session.create({
      data: {
        name,
        type,
        trackId,
        championshipId: championshipId || null,
        fuelMode: fuelMode || 'OFF',
        duration: duration || null,
        maxLaps: maxLaps || null,
        status: 'draft',
        drivers: {
          create: drivers?.map((d, idx) => ({
            driverId: d.driverId,
            carId: d.carId,
            controller: Number(d.controller),
            gridPos: d.gridPos || idx + 1
          })) || []
        }
      },
      include: {
        track: true,
        championship: true,
        drivers: { include: { driver: true, car: true } }
      }
    });

    res.status(201).json({ success: true, data: session });
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/sessions/:id
 * Update a session
 */
router.put('/:id', async (req, res) => {
  try {
    const { name, type, trackId, championshipId, fuelMode, duration, maxLaps, order } = req.body;

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (type !== undefined) updateData.type = type;
    if (trackId !== undefined) updateData.trackId = trackId;
    if (championshipId !== undefined) updateData.championshipId = championshipId === '' ? null : championshipId;
    if (fuelMode !== undefined) updateData.fuelMode = fuelMode;
    if (duration !== undefined) updateData.duration = duration || null;
    if (maxLaps !== undefined) updateData.maxLaps = maxLaps || null;
    if (order !== undefined) updateData.order = order;

    const session = await prisma().session.update({
      where: { id: req.params.id },
      data: updateData,
      include: {
        track: true,
        championship: true,
        drivers: { include: { driver: true, car: true } }
      }
    });

    res.json({ success: true, data: session });
  } catch (error) {
    console.error('Error updating session:', error);
    if (error.code === 'P2003') {
      return res.status(400).json({ success: false, error: 'Invalid trackId or championshipId' });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/sessions/:id
 * Delete a session
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const session = await prisma().session.findUnique({
      where: { id },
      include: { championship: true }
    });

    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    // Use ChampionshipSessionManager for championship sessions
    if (championshipSessionManager && session.championshipId) {
      await championshipSessionManager.deleteSession(id);
    } else {
      // Clear TrackRecord references
      await prisma().trackRecord.updateMany({
        where: { sessionId: id },
        data: { sessionId: null }
      });

      await prisma().session.delete({ where: { id } });
    }

    // Clear active session if needed
    if (sessionManager.syncService?.activeSessionId === id) {
      sessionManager.clearActiveSession();
    }

    sessionManager.io?.emit('session_deleted', {
      event: 'session_deleted',
      data: { sessionId: id, championshipId: session.championshipId, type: session.type }
    });

    if (session.championshipId) {
      sessionManager.io?.emit('standings_changed', {
        event: 'standings_changed',
        data: { championshipId: session.championshipId, types: [session.type] }
      });
    }

    res.json({ success: true, message: 'Session deleted' });
  } catch (error) {
    console.error('Error deleting session:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/sessions/:id/drivers
 * Update session drivers
 */
router.put('/:id/drivers', async (req, res) => {
  try {
    const { id } = req.params;
    const { drivers } = req.body;

    if (!Array.isArray(drivers)) {
      return res.status(400).json({ success: false, error: 'drivers must be an array' });
    }

    const session = await prisma().session.findUnique({ where: { id } });
    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    // Replace all drivers
    await prisma().sessionDriver.deleteMany({ where: { sessionId: id } });

    const validDrivers = drivers.filter(d => d.driverId && d.carId && d.controller !== undefined);
    if (validDrivers.length > 0) {
      await prisma().sessionDriver.createMany({
        data: validDrivers.map((d, idx) => ({
          sessionId: id,
          driverId: d.driverId,
          carId: d.carId,
          controller: Number(d.controller),
          gridPos: idx + 1
        }))
      });
    }

    const updatedSession = await prisma().session.findUnique({
      where: { id },
      include: {
        track: true,
        championship: true,
        drivers: { include: { driver: true, car: true }, orderBy: { controller: 'asc' } }
      }
    });

    res.json({ success: true, data: updatedSession });
  } catch (error) {
    console.error('Error updating drivers:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/sessions/:id/status
 * Change session status with validation
 */
router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status: newStatus } = req.body;

    const validStatuses = ['draft', 'ready', 'active', 'paused', 'finishing', 'finished'];
    if (!newStatus || !validStatuses.includes(newStatus)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const session = await prisma().session.findUnique({
      where: { id },
      include: { drivers: { include: { driver: true, car: true } }, championship: true, track: true }
    });

    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    const currentStatus = session.status;
    const allowedTransitions = {
      'draft': ['ready'],
      'ready': ['draft', 'active'],
      'active': ['paused', 'finishing', 'finished'],
      'paused': ['active', 'finished'],
      'finishing': ['finished'],
      'finished': ['draft']
    };

    if (!allowedTransitions[currentStatus]?.includes(newStatus)) {
      return res.status(400).json({
        success: false,
        error: `Cannot transition from '${currentStatus}' to '${newStatus}'`
      });
    }

    // Use ChampionshipSessionManager for championship sessions
    if (championshipSessionManager && session.championshipId) {
      let updatedSession;

      if (newStatus === 'active' && currentStatus === 'ready') {
        updatedSession = await championshipSessionManager.startSession(id);
        sessionManager.configureActiveSession(updatedSession);
        sessionManager.startRace();
      } else if (newStatus === 'finished' && ['active', 'finishing'].includes(currentStatus)) {
        await championshipSessionManager.forceFinish(id);
        updatedSession = await prisma().session.findUnique({
          where: { id },
          include: { track: true, championship: true, drivers: { include: { driver: true, car: true } } }
        });
        sessionManager.stopRace();
        sessionManager.clearActiveSession();
      } else {
        updatedSession = await championshipSessionManager.changeSessionStatus(id, newStatus);
      }

      return res.json({
        success: true,
        data: updatedSession,
        message: `Status changed from '${currentStatus}' to '${newStatus}'`
      });
    }

    // Direct update for non-championship sessions
    const updateData = { status: newStatus };
    if (newStatus === 'active') updateData.startedAt = new Date();
    else if (newStatus === 'finishing') updateData.finishingAt = new Date();
    else if (newStatus === 'finished') updateData.finishedAt = new Date();
    else if (newStatus === 'draft' && currentStatus === 'finished') {
      updateData.startedAt = null;
      updateData.finishingAt = null;
      updateData.finishedAt = null;
    }

    const updatedSession = await prisma().session.update({
      where: { id },
      data: updateData,
      include: { track: true, championship: true, drivers: { include: { driver: true, car: true } } }
    });

    // Handle side effects
    if (newStatus === 'active') {
      sessionManager.configureActiveSession(updatedSession);
      sessionManager.startRace();
      sessionManager.io?.emit('session:started', { session: updatedSession });
    } else if (newStatus === 'finished') {
      sessionManager.stopRace();
      sessionManager.clearActiveSession();
      sessionManager.io?.emit('session:stopped', { session: updatedSession });
    }

    sessionManager.io?.emit('session_status_changed', {
      event: 'session_status_changed',
      data: { sessionId: id, championshipId: updatedSession.championshipId, previousStatus: currentStatus, status: newStatus }
    });

    res.json({ success: true, data: updatedSession, message: `Status changed to '${newStatus}'` });
  } catch (error) {
    console.error('Error changing status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/sessions/:id/start
 * Start a session
 */
router.post('/:id/start', async (req, res) => {
  try {
    const { id } = req.params;

    const session = await prisma().session.findUnique({
      where: { id },
      include: { track: true, championship: true, drivers: { include: { driver: true, car: true } } }
    });

    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    if (session.status !== 'ready') {
      return res.status(400).json({
        success: false,
        error: `Session must be 'ready' to start, current: ${session.status}`
      });
    }

    let updatedSession;

    if (championshipSessionManager && session.championshipId) {
      updatedSession = await championshipSessionManager.startSession(id);
    } else {
      updatedSession = await prisma().session.update({
        where: { id },
        data: { status: 'active', startedAt: new Date() },
        include: { track: true, championship: true, drivers: { include: { driver: true, car: true } } }
      });
    }

    await sessionManager.resetForNewSession();
    sessionManager.configureActiveSession(updatedSession);
    sessionManager.startRace();

    sessionManager.io?.emit('session:started', { session: updatedSession });

    res.json({ success: true, data: updatedSession, message: 'Session started' });
  } catch (error) {
    console.error('Error starting session:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/sessions/:id/pause
 * Pause an active session
 */
router.post('/:id/pause', async (req, res) => {
  try {
    const { id } = req.params;

    const session = await prisma().session.findUnique({ where: { id } });

    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    if (session.status !== 'active') {
      return res.status(400).json({
        success: false,
        error: `Session must be 'active' to pause, current: ${session.status}`
      });
    }

    const updatedSession = await prisma().session.update({
      where: { id },
      data: { status: 'paused' },
      include: { track: true, championship: true, drivers: { include: { driver: true, car: true } } }
    });

    sessionManager.stopRace();

    sessionManager.io?.emit('session:paused', { session: updatedSession });
    sessionManager.io?.emit('session_status_changed', {
      event: 'session_status_changed',
      data: { sessionId: id, status: 'paused', previousStatus: 'active' }
    });

    res.json({ success: true, data: updatedSession, message: 'Session paused' });
  } catch (error) {
    console.error('Error pausing session:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/sessions/:id/resume
 * Resume a paused session
 */
router.post('/:id/resume', async (req, res) => {
  try {
    const { id } = req.params;

    const session = await prisma().session.findUnique({
      where: { id },
      include: { drivers: { include: { driver: true, car: true } } }
    });

    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    if (session.status !== 'paused') {
      return res.status(400).json({
        success: false,
        error: `Session must be 'paused' to resume, current: ${session.status}`
      });
    }

    const updatedSession = await prisma().session.update({
      where: { id },
      data: { status: 'active' },
      include: { track: true, championship: true, drivers: { include: { driver: true, car: true } } }
    });

    sessionManager.startRace();

    sessionManager.io?.emit('session:resumed', { session: updatedSession });
    sessionManager.io?.emit('session_status_changed', {
      event: 'session_status_changed',
      data: { sessionId: id, status: 'active', previousStatus: 'paused' }
    });

    res.json({ success: true, data: updatedSession, message: 'Session resumed' });
  } catch (error) {
    console.error('Error resuming session:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/sessions/:id/stop
 * Stop a session (finish it)
 */
router.post('/:id/stop', async (req, res) => {
  try {
    const { id } = req.params;

    const session = await prisma().session.findUnique({
      where: { id },
      include: { championship: true }
    });

    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    if (!['active', 'paused', 'finishing'].includes(session.status)) {
      return res.status(400).json({
        success: false,
        error: `Session must be active/paused/finishing to stop, current: ${session.status}`
      });
    }

    let updatedSession;

    if (championshipSessionManager && session.championshipId) {
      await championshipSessionManager.forceFinish(id);
      updatedSession = await prisma().session.findUnique({
        where: { id },
        include: { track: true, championship: true, drivers: { include: { driver: true, car: true } } }
      });
    } else {
      updatedSession = await prisma().session.update({
        where: { id },
        data: { status: 'finished', finishedAt: new Date() },
        include: { track: true, championship: true, drivers: { include: { driver: true, car: true } } }
      });
    }

    sessionManager.stopRace();
    sessionManager.clearActiveSession();

    sessionManager.io?.emit('session:stopped', { session: updatedSession });

    if (session.championshipId) {
      sessionManager.io?.emit('standings_changed', {
        event: 'standings_changed',
        data: { championshipId: session.championshipId, types: [session.type] }
      });
    }

    res.json({ success: true, data: updatedSession, message: 'Session stopped' });
  } catch (error) {
    console.error('Error stopping session:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/sessions/:id/restart
 * Restart a session (delete laps/events, reset to ready)
 */
router.post('/:id/restart', async (req, res) => {
  try {
    const { id } = req.params;

    const session = await prisma().session.findUnique({ where: { id } });
    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    // Delete laps and events
    await prisma().lap.deleteMany({ where: { sessionId: id } });
    await prisma().raceEvent.deleteMany({ where: { sessionId: id } });

    // Reset driver stats
    await prisma().sessionDriver.updateMany({
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

    // Reset session
    const updatedSession = await prisma().session.update({
      where: { id },
      data: { status: 'ready', startedAt: null, finishingAt: null, finishedAt: null },
      include: { track: true, championship: true, drivers: { include: { driver: true, car: true } } }
    });

    await sessionManager.resetForNewSession();

    sessionManager.io?.emit('session:restarted', { session: updatedSession });

    res.json({ success: true, data: updatedSession, message: 'Session restarted' });
  } catch (error) {
    console.error('Error restarting session:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/sessions/:id/reset
 * Reset a session (soft delete laps, reset to draft)
 */
router.post('/:id/reset', async (req, res) => {
  try {
    const { id } = req.params;

    const session = await prisma().session.findUnique({
      where: { id },
      include: { championship: true }
    });

    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    // Soft delete laps
    await prisma().lap.updateMany({
      where: { sessionId: id, softDeletedAt: null },
      data: { softDeletedAt: new Date() }
    });

    // Delete events
    await prisma().raceEvent.deleteMany({ where: { sessionId: id } });

    // Reset driver stats
    await prisma().sessionDriver.updateMany({
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

    // Reset to draft
    const updatedSession = await prisma().session.update({
      where: { id },
      data: { status: 'draft', startedAt: null, finishingAt: null, finishedAt: null },
      include: { track: true, championship: true, drivers: { include: { driver: true, car: true } } }
    });

    sessionManager.io?.emit('session_reset', {
      event: 'session_reset',
      data: { sessionId: id, championshipId: session.championshipId, type: session.type }
    });

    sessionManager.io?.emit('session_status_changed', {
      event: 'session_status_changed',
      data: { sessionId: id, previousStatus: session.status, status: 'draft' }
    });

    if (session.championshipId) {
      sessionManager.io?.emit('standings_changed', {
        event: 'standings_changed',
        data: { championshipId: session.championshipId, types: [session.type] }
      });
    }

    res.json({ success: true, data: updatedSession, message: 'Session reset to draft' });
  } catch (error) {
    console.error('Error resetting session:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/sessions/:id/leaderboard
 * Get live leaderboard
 */
router.get('/:id/leaderboard', async (req, res) => {
  try {
    const { id } = req.params;

    if (championshipSessionManager) {
      const leaderboard = await championshipSessionManager.getSessionLeaderboard(id);
      return res.json({ success: true, data: leaderboard });
    }

    // Fallback: basic calculation
    const session = await prisma().session.findUnique({
      where: { id },
      include: { drivers: { include: { driver: true, car: true } } }
    });

    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    const entries = [];
    for (const sd of session.drivers) {
      const laps = await prisma().lap.findMany({
        where: { sessionId: id, controller: sd.controller, softDeletedAt: null },
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

    // Sort
    if (session.type === 'qualif') {
      entries.sort((a, b) => {
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

    // Positions
    entries.forEach((e, i) => { e.position = i + 1; });

    res.json({ success: true, data: entries });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
