import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import { CarreraSimulator } from './services/simulator.js';
import { TrackSyncService } from './services/trackSync.js';
import { SimulatorSyncService } from './services/simulatorSync.js';
import { SyncService } from './services/SyncService.js';
import { ControlUnit } from './services/controlUnit.js';

// Import routes
import driversRouter from './routes/drivers.js';
import carsRouter from './routes/cars.js';
import tracksRouter from './routes/tracks.js';
import teamsRouter from './routes/teams.js';
import championshipsRouter from './routes/championships.js';
import statsRouter from './routes/stats.js';
import lapsRouter from './routes/laps.js';
import settingsRouter, { setSettingsIo } from './routes/settings.js';
import bluetoothRouter, { setTrackSync, setSimulator } from './routes/bluetooth.js';

// Import new simplified routes
import sessionsSimpleRouter, { setSessionManager as setSimpleSessionManager, setChampionshipSessionManager as setSimpleChampionshipSessionManager } from './routes/sessions-simple.js';
import sessionControlRouter, { setSessionManager as setControlSessionManager } from './routes/session-control.js';

// Import new v2 routes
import configRouter, { setConfigService } from './routes/config.js';
import raceRouter, { setRaceController } from './routes/race.js';
import recordsRouter from './routes/records.js';
import uploadRouter from './routes/upload.js';

// Import SessionManager service (legacy)
import { SessionManager } from './services/SessionManager.js';

// Import new v2 services
import { ConfigService } from './services/ConfigService.js';
import { LeaderboardService } from './services/LeaderboardService.js';
import { RaceControllerService } from './services/RaceControllerService.js';
import { ChampionshipSessionManager } from './services/ChampionshipSessionManager.js';
// Note: LapRecorderService not needed - TrackSyncService handles lap recording directly

const app = express();
const httpServer = createServer(app);
const prisma = new PrismaClient();

// Configure SQLite for performance (WAL mode)
async function configureSQLite() {
  // Use $queryRawUnsafe for PRAGMA commands that return results
  await prisma.$queryRawUnsafe('PRAGMA journal_mode = WAL');
  await prisma.$queryRawUnsafe('PRAGMA synchronous = NORMAL');
  await prisma.$queryRawUnsafe('PRAGMA cache_size = -8000');   // 8MB cache
  await prisma.$queryRawUnsafe('PRAGMA temp_store = MEMORY');
  console.log('✅ SQLite configured: WAL mode enabled');
}
configureSQLite().catch(console.error);

const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,    // 60s before considering connection dead
  pingInterval: 25000,   // Send ping every 25s
});

// Initialize SessionManager (legacy)
const sessionManager = new SessionManager(io);

// Initialize new v2 services
const configService = new ConfigService(io);
const leaderboardService = new LeaderboardService();
const raceControllerService = new RaceControllerService(io, leaderboardService);
const championshipSessionManager = new ChampionshipSessionManager(io);
// Note: LapRecorderService not used - TrackSyncService handles lap recording

// Initialize services
const useMockDevice = process.env.USE_MOCK_DEVICE === 'true';
let trackSync = null;
let simulator = null;
let simulatorSync = null;
let syncService = null;
let eventSource = null; // CU or Simulator

if (useMockDevice) {
  // Mode simulateur
  simulator = new CarreraSimulator(io);
  simulator.init(6); // 6 cars by default
  eventSource = simulator;

  // Legacy: SimulatorSync (kept for backward compatibility)
  simulatorSync = new SimulatorSyncService(simulator, io);
  simulatorSync.loadActiveSession();

  // Connect SessionManager to SimulatorSync and Simulator
  sessionManager.setSimulatorSync(simulatorSync);
  sessionManager.setSimulator(simulator);
} else {
  // Mode Control Unit réel
  trackSync = new TrackSyncService(io);
  eventSource = trackSync.controlUnit; // CU instance from trackSync
}

// New unified SyncService (works with both CU and Simulator)
syncService = new SyncService(eventSource, io);
console.log(`🔄 SyncService initialized with ${useMockDevice ? 'Simulator' : 'ControlUnit'}`);

// Export syncService for routes
export { syncService };

// Pass io to settings
setSettingsIo(io);

// Pass SessionManager to new routes
setSimpleSessionManager(sessionManager);
setControlSessionManager(sessionManager);
setSimpleChampionshipSessionManager(championshipSessionManager);

// Pass v2 services to routes
setConfigService(configService);
setRaceController(raceControllerService);

// Pass services to routes
if (trackSync) {
  setTrackSync(trackSync);
  // Connect SessionManager to TrackSync for CU control (legacy)
  sessionManager.setTrackSync(trackSync);
  // Connect RaceControllerService to TrackSync for CU control (v2)
  raceControllerService.setTrackSync(trackSync);
  // Connect ChampionshipSessionManager to TrackSync
  championshipSessionManager.setTrackSync(trackSync);
  // Start SyncService polling for CU (adaptive: 500ms normal, 100ms during lights)
  syncService.startPolling();
  console.log('🔌 CU mode: SyncService polling started (adaptive)');
} else if (simulator) {
  // In simulator mode, use simulator for bluetooth routes
  setSimulator(simulator);
  // Start CU status polling to emit cu:status events
  simulator.startStatusPolling(200);
  console.log('🎮 Simulator mode: CU status polling started');
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Augmenté pour supporter les images base64
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static('public'));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '0.1.0'
  });
});

// API info
app.get('/api', (req, res) => {
  res.json({
    name: 'RaceHubOS API',
    version: '0.2.0',
    endpoints: {
      // Core CRUD
      drivers: '/api/drivers',
      cars: '/api/cars',
      tracks: '/api/tracks',
      teams: '/api/teams',
      championships: '/api/championships',
      sessions: '/api/sessions',
      // Race control v2
      race: '/api/race',
      config: '/api/config',
      records: '/api/records',
      // Utils
      stats: '/api/stats',
      laps: '/api/laps',
      bluetooth: '/api/bluetooth',
      settings: '/api/settings',
      // Legacy
      sessionControl: '/api/session-control (legacy)',
      simulator: '/api/simulator',
    },
  });
});

// Mount API routes
app.use('/api/drivers', driversRouter);
app.use('/api/cars', carsRouter);
app.use('/api/tracks', tracksRouter);
app.use('/api/teams', teamsRouter);
app.use('/api/championships', championshipsRouter);
app.use('/api/stats', statsRouter);
app.use('/api/laps', lapsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/bluetooth', bluetoothRouter);

// New simplified session routes
app.use('/api/sessions', sessionsSimpleRouter);
app.use('/api/session-control', sessionControlRouter);

// New v2 routes
app.use('/api/config', configRouter);
app.use('/api/race', raceRouter);
app.use('/api/records', recordsRouter);
app.use('/api/upload', uploadRouter);

// SyncService endpoints (new unified API)
app.get('/api/sync/state', (req, res) => {
  res.json(syncService.getState());
});

app.get('/api/sync/leaderboard', (req, res) => {
  res.json(syncService.getLeaderboard());
});

app.post('/api/sync/load-session/:sessionId', async (req, res) => {
  try {
    const session = await syncService.loadSession(req.params.sessionId);
    res.json({ success: true, session: { id: session.id, type: session.type } });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/sync/reset', async (req, res) => {
  await syncService.resetForNewSession();
  res.json({ success: true });
});

// CU control via SyncService
app.post('/api/sync/start', async (req, res) => {
  await syncService.startRace();
  res.json({ success: true });
});

app.post('/api/sync/stop', async (req, res) => {
  await syncService.stopRace();
  res.json({ success: true });
});

app.post('/api/sync/button/:button', async (req, res) => {
  const button = parseInt(req.params.button, 10);
  await syncService.pressButton(button);
  res.json({ success: true, button });
});

app.get('/api/sync/cu-status', (req, res) => {
  res.json(syncService.getCuStatus() || { error: 'No status yet' });
});

// Simulator control endpoints
app.get('/api/simulator', (req, res) => {
  if (useMockDevice && simulator) {
    const state = simulator.getState();
    res.json({
      ...state,
      isMockDevice: true
    });
  } else {
    res.json({
      isMockDevice: false,
      message: 'Using real Control Unit'
    });
  }
});

app.post('/api/simulator/start', (req, res) => {
  if (useMockDevice && simulator) {
    simulator.start();
    res.json({ status: 'started' });
  } else {
    res.status(400).json({ error: 'Not in simulator mode' });
  }
});

app.post('/api/simulator/stop', (req, res) => {
  if (useMockDevice && simulator) {
    simulator.stop();
    res.json({ status: 'stopped' });
  } else {
    res.status(400).json({ error: 'Not in simulator mode' });
  }
});

app.post('/api/simulator/pause', (req, res) => {
  if (useMockDevice && simulator) {
    simulator.togglePause();
    res.json({ status: 'toggled' });
  } else {
    res.status(400).json({ error: 'Not in simulator mode' });
  }
});

// WebSocket connection
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  // Send current state on connection
  if (useMockDevice && simulator) {
    socket.emit('race:status', {
      running: simulator.isRunning,
      active: simulator.raceActive,
      raceTime: simulator.raceTime,
      carCount: simulator.cars.length,
      isMockDevice: true
    });
  } else if (trackSync) {
    const cuState = trackSync.getState();
    socket.emit('cu:status', {
      connected: cuState.connected,
      activeSession: cuState.activeSessionId,
      isMockDevice: false
    });

    // Send race state for v2 pages
    raceControllerService.getState().then(raceState => {
      socket.emit('race:state', raceState);
    });
  }

  socket.on('disconnect', () => {
    console.log(`❌ Client disconnected: ${socket.id}`);
  });

  // Race control events
  socket.on('race:start', (data) => {
    console.log('▶️  Race start requested:', data);
    if (useMockDevice && simulator) {
      simulator.start();
    }
  });

  socket.on('race:pause', () => {
    console.log('⏸️  Race pause requested');
    if (useMockDevice && simulator) {
      simulator.togglePause();
    }
  });

  socket.on('race:stop', () => {
    console.log('⏹️  Race stop requested');
    if (useMockDevice && simulator) {
      simulator.stop();
    }
  });

  socket.on('car:setSpeed', (data) => {
    console.log('🏎️  Set speed:', data);
    if (useMockDevice && simulator) {
      simulator.setCarSpeed(data.carId, data.speed);
    }
  });

  // Simulator control via WebSocket
  socket.on('simulator:start', () => {
    if (useMockDevice && simulator) {
      simulator.start();
    }
  });

  socket.on('simulator:stop', () => {
    if (useMockDevice && simulator) {
      simulator.stop();
    }
  });

  socket.on('simulator:pause', () => {
    if (useMockDevice && simulator) {
      simulator.togglePause();
    }
  });

  socket.on('simulator:getState', () => {
    if (useMockDevice && simulator) {
      socket.emit('simulator:state', simulator.getState());
    } else if (trackSync) {
      socket.emit('cu:state', trackSync.getState());
    }
  });
});

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════╗
║         🏁 RaceHubOS Backend         ║
╠═══════════════════════════════════════╣
║  HTTP: http://localhost:${PORT}       ║
║  WebSocket: Ready                     ║
║  Database: SQLite (${process.env.USE_MOCK_DEVICE === 'true' ? 'Mock' : 'Real'})          ║
╚═══════════════════════════════════════╝
  `);
});

// Graceful shutdown
let isClosing = false;

function gracefulShutdown(signal) {
  if (isClosing) {
    console.log(`\n⚠️  ${signal} received again, forcing exit...`);
    process.exit(1);
  }

  isClosing = true;
  console.log(`\n⚠️  ${signal} received, closing server...`);

  // Fermer tout immédiatement sans attendre
  try {
    io.close();
    if (simulator) simulator.stop();
    httpServer.close();
  } catch (error) {
    // Ignorer les erreurs
  }

  // Exit immédiatement
  console.log('✅ Server closed');
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
