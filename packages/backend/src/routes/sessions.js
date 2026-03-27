import express from 'express';
import SessionService from '../services/SessionService.js';

const router = express.Router();
let sessionService;

export function setSessionService(service) {
  sessionService = service;
}

// Helper: get prisma instance
const prisma = () => sessionService.prisma;

/**
 * GET /api/sessions
 */
router.get('/', async (req, res) => {
  try {
    const { status, championshipId, trackId, type, deleted, limit = '50', offset = '0', sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    const where = deleted === 'true' ? { deletedAt: { not: null } } : { deletedAt: null };
    if (status && status !== 'all') where.status = status.includes(',') ? { in: status.split(',') } : status;
    if (trackId) where.trackId = trackId.includes(',') ? { in: trackId.split(',') } : trackId;
    if (type) where.type = type.includes(',') ? { in: type.split(',') } : type;
    // Handle championshipId=null explicitly (free sessions)
    if (championshipId) {
      const ids = championshipId.split(',');
      const hasNull = ids.includes('null');
      const realIds = ids.filter(id => id !== 'null');
      if (hasNull && realIds.length) {
        where.OR = [{ championshipId: null }, { championshipId: { in: realIds } }];
      } else if (hasNull) {
        where.championshipId = null;
      } else {
        where.championshipId = realIds.length > 1 ? { in: realIds } : realIds[0];
      }
    }

    const parsedLimit = parseInt(limit);
    const parsedOffset = parseInt(offset);

    const [sessions, total] = await Promise.all([
      prisma().session.findMany({
        where,
        include: {
          track: true,
          championship: true,
          drivers: { where: { deletedAt: null }, include: { driver: true, car: true } },
          _count: { select: { laps: { where: { deletedAt: null } } } }
        },
        orderBy: { [sortBy]: sortOrder },
        skip: parsedOffset,
        take: parsedLimit,
      }),
      prisma().session.count({ where }),
    ]);

    res.json({ success: true, data: sessions, total, hasMore: parsedOffset + parsedLimit < total });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/sessions/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const session = await prisma().session.findUnique({
      where: { id: req.params.id, deletedAt: null },
      include: {
        track: true,
        championship: true,
        drivers: {
          where: { deletedAt: null },
          include: { driver: true, car: true },
          orderBy: { controller: 'asc' }
        },
        laps: {
          where: { deletedAt: null },
          include: { driver: true },
          orderBy: { timestamp: 'asc' }
        }
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
 * Create a standalone session (without championship)
 */
router.post('/', async (req, res) => {
  try {
    const session = await sessionService.createSession(req.body);
    res.status(201).json({ success: true, data: session });
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});


/**
 * PUT /api/sessions/:id
 */
router.put('/:id', async (req, res) => {
  try {
    const { name, type, trackId, championshipId, fuelMode, maxDuration, maxLaps, gracePeriod, order } = req.body;

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (type !== undefined) updateData.type = type;
    if (trackId !== undefined) updateData.trackId = trackId;
    if (championshipId !== undefined) updateData.championshipId = championshipId === '' ? null : championshipId;
    if (fuelMode !== undefined) updateData.fuelMode = fuelMode;
    if (maxDuration !== undefined) updateData.maxDuration = maxDuration || null;
    if (maxLaps !== undefined) updateData.maxLaps = maxLaps || null;
    if (gracePeriod !== undefined) updateData.gracePeriod = gracePeriod || null;
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
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await sessionService.deleteSession(id);

    res.json({ success: true, message: 'Session deleted' });
  } catch (error) {
    console.error('Error deleting session:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/sessions/:id/drivers
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

    await prisma().sessionDriver.deleteMany({ where: { sessionId: id } });

    // Accept partial configs (driver OR car) for draft sessions
    const validDrivers = drivers.filter(d => (d.driverId || d.carId) && d.controller !== undefined);
    if (validDrivers.length > 0) {
      await prisma().sessionDriver.createMany({
        data: validDrivers.map((d, idx) => ({
          sessionId: id,
          driverId: d.driverId || null,
          carId: d.carId || null,
          controller: Number(d.controller),
          gridPos: d.gridPos ?? idx + 1
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
      include: { drivers: { include: { driver: true, car: true } } }
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

    // Delegate to SessionService for lifecycle transitions
    if (newStatus === 'active' && currentStatus === 'ready') {
      await sessionService.startSession(id);
    } else if (newStatus === 'paused' && currentStatus === 'active') {
      await sessionService.pauseSession();
    } else if (newStatus === 'active' && currentStatus === 'paused') {
      await sessionService.resumeSession();
    } else if (newStatus === 'finished') {
      await sessionService.stopSession();
    } else {
      // Simple status update (draft <-> ready, finished -> draft)
      const updateData = { status: newStatus };
      if (newStatus === 'draft' && currentStatus === 'finished') {
        updateData.startedAt = null;
        updateData.finishingAt = null;
        updateData.finishedAt = null;
      }
      await prisma().session.update({ where: { id }, data: updateData });
    }

    const updatedSession = await prisma().session.findUnique({
      where: { id },
      include: { track: true, championship: true, drivers: { include: { driver: true, car: true } } }
    });

    res.json({ success: true, data: updatedSession, message: `Status changed to '${newStatus}'` });
  } catch (error) {
    console.error('Error changing status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/sessions/:id/start
 */
router.post('/:id/start', async (req, res) => {
  try {
    const { id } = req.params;

    const session = await prisma().session.findUnique({ where: { id } });
    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    if (session.status !== 'ready') {
      return res.status(400).json({
        success: false,
        error: `Session must be 'ready' to start, current: ${session.status}`
      });
    }

    await sessionService.startSession(id);

    const updatedSession = await prisma().session.findUnique({
      where: { id },
      include: { track: true, championship: true, drivers: { include: { driver: true, car: true } } }
    });

    res.json({ success: true, data: updatedSession, message: 'Session started' });
  } catch (error) {
    console.error('Error starting session:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/sessions/:id/pause
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

    await sessionService.pauseSession();

    const updatedSession = await prisma().session.findUnique({
      where: { id },
      include: { track: true, championship: true, drivers: { include: { driver: true, car: true } } }
    });

    res.json({ success: true, data: updatedSession, message: 'Session paused' });
  } catch (error) {
    console.error('Error pausing session:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/sessions/:id/resume
 */
router.post('/:id/resume', async (req, res) => {
  try {
    const { id } = req.params;

    const session = await prisma().session.findUnique({ where: { id } });
    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    if (session.status !== 'paused') {
      return res.status(400).json({
        success: false,
        error: `Session must be 'paused' to resume, current: ${session.status}`
      });
    }

    await sessionService.resumeSession();

    const updatedSession = await prisma().session.findUnique({
      where: { id },
      include: { track: true, championship: true, drivers: { include: { driver: true, car: true } } }
    });

    res.json({ success: true, data: updatedSession, message: 'Session resumed' });
  } catch (error) {
    console.error('Error resuming session:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/sessions/:id/stop
 */
router.post('/:id/stop', async (req, res) => {
  try {
    const { id } = req.params;

    const session = await prisma().session.findUnique({ where: { id } });
    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    if (!['active', 'paused', 'finishing'].includes(session.status)) {
      return res.status(400).json({
        success: false,
        error: `Session must be active/paused/finishing to stop, current: ${session.status}`
      });
    }

    await sessionService.stopSession();

    const updatedSession = await prisma().session.findUnique({
      where: { id },
      include: { track: true, championship: true, drivers: { include: { driver: true, car: true } } }
    });

    res.json({ success: true, data: updatedSession, message: 'Session stopped' });
  } catch (error) {
    console.error('Error stopping session:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/sessions/:id/reset
 * Reset session to ready
 * - Practice: soft delete laps (for stats)
 * - Qualif/Race: hard delete laps
 */
router.post('/:id/reset', async (req, res) => {
  try {
    const { id } = req.params;

    await sessionService.resetSession(id);

    const updatedSession = await prisma().session.findUnique({
      where: { id },
      include: { track: true, championship: true, drivers: { include: { driver: true, car: true } } }
    });

    res.json({ success: true, data: updatedSession, message: 'Session reset' });
  } catch (error) {
    console.error('Error resetting session:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/sessions/:id/leaderboard
 */
router.get('/:id/leaderboard', async (req, res) => {
  try {
    const { id } = req.params;

    // If this is the active session, return live data
    if (sessionService.activeSessionId === id) {
      return res.json({ success: true, data: sessionService.getLeaderboard() });
    }

    // Otherwise calculate from DB
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
        where: { sessionId: id, controller: sd.controller, deletedAt: null },
        orderBy: { timestamp: 'desc' }
      });

      entries.push({
        controller: sd.controller,
        driverId: sd.driverId,
        driver: sd.driver,
        car: sd.car,
        totalLaps: laps.length,
        totalTime: laps.reduce((sum, lap) => sum + Math.round(lap.lapTime), 0),
        bestLapTime: laps.length > 0 ? Math.min(...laps.map(l => l.lapTime)) : null,
        lastLapTime: laps.length > 0 ? laps[0].lapTime : null,
      });
    }

    // Calculate gaps and positions
    const sortedEntries = SessionService.calculateDriverGaps(entries, session.type);

    res.json({ success: true, data: sortedEntries });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
