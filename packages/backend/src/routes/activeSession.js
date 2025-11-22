import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// Store active session state in memory (reset on server restart)
let activeSession = null;
let sessionLogs = [];
const MAX_LOGS = 1000;

// Get active session
router.get('/', async (req, res) => {
  try {
    if (!activeSession) {
      // Try to get the last session configuration
      const lastSession = await prisma.session.findFirst({
        orderBy: { createdAt: 'desc' },
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

      if (lastSession) {
        // Create a practice session based on last config
        activeSession = {
          type: 'practice',
          sessionId: null,
          name: 'Essais libres',
          track: lastSession.track,
          drivers: lastSession.drivers,
          startTime: new Date().toISOString(),
          status: 'waiting', // waiting, running, paused, stopped
          laps: [],
          currentDrivers: {} // controller -> driver/car mapping
        };
      }
    }

    res.json({
      success: true,
      data: activeSession,
      logs: sessionLogs.slice(-50) // Last 50 logs
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Start/Create active session
router.post('/start', async (req, res) => {
  try {
    const { sessionId, trackId, drivers } = req.body;

    if (sessionId) {
      // Load existing session
      const session = await prisma.session.findUnique({
        where: { id: sessionId },
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

      if (!session) {
        return res.status(404).json({ success: false, error: 'Session not found' });
      }

      activeSession = {
        type: 'session',
        sessionId: session.id,
        name: session.name || `Session #${session.id}`,
        track: session.track,
        championship: session.championship,
        drivers: session.drivers,
        startTime: new Date().toISOString(),
        status: 'running',
        laps: [],
        currentDrivers: {}
      };

      // Map drivers to controllers
      session.drivers.forEach(sd => {
        activeSession.currentDrivers[sd.controller] = {
          driver: sd.driver,
          car: sd.car,
          controller: sd.controller,
          bestLap: null,
          lastLap: null,
          lapCount: 0,
          totalTime: 0,
          status: 'waiting' // waiting, on_track, pit
        };
      });

      // Update session in database
      await prisma.session.update({
        where: { id: sessionId },
        data: { startTime: new Date() }
      });

    } else {
      // Create practice session
      const track = await prisma.track.findUnique({
        where: { id: trackId }
      });

      if (!track) {
        return res.status(404).json({ success: false, error: 'Track not found' });
      }

      // Prepare drivers data
      const driversData = [];
      for (const d of drivers) {
        const driver = await prisma.driver.findUnique({
          where: { id: d.driverId }
        });
        const car = await prisma.car.findUnique({
          where: { id: d.carId }
        });

        if (driver && car) {
          driversData.push({
            driver,
            car,
            controller: d.controller
          });
        }
      }

      activeSession = {
        type: 'practice',
        sessionId: null,
        name: 'Essais libres',
        track,
        drivers: driversData,
        startTime: new Date().toISOString(),
        status: 'running',
        laps: [],
        currentDrivers: {}
      };

      // Map drivers to controllers
      driversData.forEach(d => {
        activeSession.currentDrivers[d.controller] = {
          driver: d.driver,
          car: d.car,
          controller: d.controller,
          bestLap: null,
          lastLap: null,
          lapCount: 0,
          totalTime: 0,
          status: 'waiting'
        };
      });
    }

    // Log session start
    addLog('session_start', {
      type: activeSession.type,
      name: activeSession.name,
      track: activeSession.track.name,
      drivers: Object.values(activeSession.currentDrivers).map(d => ({
        controller: d.controller,
        driver: d.driver.name,
        car: `${d.car.brand} ${d.car.model}`
      }))
    });

    res.json({ success: true, data: activeSession });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Stop active session
router.post('/stop', async (req, res) => {
  try {
    if (!activeSession) {
      return res.status(400).json({ success: false, error: 'No active session' });
    }

    activeSession.status = 'stopped';
    activeSession.endTime = new Date().toISOString();

    // If it's a real session, update database
    if (activeSession.sessionId) {
      await prisma.session.update({
        where: { id: activeSession.sessionId },
        data: { endTime: new Date() }
      });
    }

    addLog('session_stop', {
      type: activeSession.type,
      name: activeSession.name,
      duration: Math.floor((new Date(activeSession.endTime) - new Date(activeSession.startTime)) / 1000)
    });

    res.json({ success: true, data: activeSession });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Pause/Resume active session
router.post('/pause', async (req, res) => {
  try {
    if (!activeSession) {
      return res.status(400).json({ success: false, error: 'No active session' });
    }

    activeSession.status = activeSession.status === 'running' ? 'paused' : 'running';

    addLog('session_pause', {
      status: activeSession.status,
      name: activeSession.name
    });

    res.json({ success: true, data: activeSession });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Record lap time
router.post('/lap', async (req, res) => {
  try {
    const { controller, time, speed } = req.body;

    if (!activeSession || activeSession.status !== 'running') {
      return res.status(400).json({ success: false, error: 'No running session' });
    }

    const driverData = activeSession.currentDrivers[controller];
    if (!driverData) {
      return res.status(400).json({ success: false, error: 'Unknown controller' });
    }

    const lapData = {
      controller,
      driverId: driverData.driver.id,
      carId: driverData.car.id,
      time: parseFloat(time),
      speed: speed || null,
      timestamp: new Date().toISOString(),
      lapNumber: driverData.lapCount + 1
    };

    // Update driver stats
    driverData.lapCount++;
    driverData.lastLap = lapData.time;
    driverData.totalTime += lapData.time;
    if (!driverData.bestLap || lapData.time < driverData.bestLap) {
      driverData.bestLap = lapData.time;
    }
    driverData.status = 'on_track';

    // Add to session laps
    activeSession.laps.push(lapData);

    // Save to database if real session
    if (activeSession.sessionId) {
      await prisma.lap.create({
        data: {
          sessionId: activeSession.sessionId,
          driverId: driverData.driver.id,
          carId: driverData.car.id,
          controller,
          lapTime: lapData.time,
          speed: lapData.speed,
          lapNumber: lapData.lapNumber
        }
      });
    }

    addLog('lap_completed', {
      driver: driverData.driver.name,
      car: `${driverData.car.brand} ${driverData.car.model}`,
      controller,
      time: lapData.time,
      lapNumber: lapData.lapNumber,
      bestLap: driverData.bestLap
    });

    res.json({
      success: true,
      data: {
        lap: lapData,
        driverStats: driverData
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Record race event (pit stop, penalty, etc.)
router.post('/event', async (req, res) => {
  try {
    const { controller, type, data } = req.body;

    if (!activeSession || activeSession.status !== 'running') {
      return res.status(400).json({ success: false, error: 'No running session' });
    }

    const driverData = activeSession.currentDrivers[controller];
    if (!driverData) {
      return res.status(400).json({ success: false, error: 'Unknown controller' });
    }

    const eventData = {
      controller,
      driverId: driverData.driver.id,
      type,
      data,
      timestamp: new Date().toISOString()
    };

    // Update driver status based on event
    if (type === 'pit_entry') {
      driverData.status = 'pit';
    } else if (type === 'pit_exit') {
      driverData.status = 'on_track';
    }

    // Save to database if real session
    if (activeSession.sessionId) {
      await prisma.raceEvent.create({
        data: {
          sessionId: activeSession.sessionId,
          driverId: driverData.driver.id,
          eventType: type,
          eventData: JSON.stringify(data),
          timestamp: new Date()
        }
      });
    }

    addLog('race_event', {
      driver: driverData.driver.name,
      controller,
      type,
      data
    });

    res.json({
      success: true,
      data: {
        event: eventData,
        driverStats: driverData
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get session logs
router.get('/logs', async (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  res.json({
    success: true,
    data: sessionLogs.slice(-limit),
    total: sessionLogs.length
  });
});

// Clear logs
router.delete('/logs', async (req, res) => {
  sessionLogs = [];
  res.json({ success: true, message: 'Logs cleared' });
});

// Helper function to add log
function addLog(type, data) {
  const log = {
    id: Date.now().toString(),
    type,
    data,
    timestamp: new Date().toISOString()
  };

  sessionLogs.push(log);

  // Limit logs size
  if (sessionLogs.length > MAX_LOGS) {
    sessionLogs = sessionLogs.slice(-MAX_LOGS);
  }

  return log;
}

// Set io instance when available
let ioInstance = null;
export function setIo(io) {
  ioInstance = io;
}

// Emit to WebSocket clients
export function emitToClients(event, data) {
  if (ioInstance) {
    ioInstance.emit(event, data);
  }
}

// Export functions for use in other modules
export function getActiveSession() {
  return activeSession;
}

export { addLog };

export default router;