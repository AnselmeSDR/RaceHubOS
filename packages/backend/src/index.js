import 'dotenv/config';
if (!process.env.DATABASE_URL) process.env.DATABASE_URL = 'file:./dev.db';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { PrismaClient } from '@prisma/client';
import { CarreraSimulator } from './services/simulator.js';
import { SyncService } from './services/SyncService.js';
import { ControlUnit } from './services/controlUnit.js';

// Import routes
import driversRouter from './routes/drivers.js';
import carsRouter from './routes/cars.js';
import tracksRouter from './routes/tracks.js';
import teamsRouter from './routes/teams.js';
import championshipsRouter, { setChampionshipService } from './routes/championships.js';
import statsRouter from './routes/stats.js';
import settingsRouter, { setSettingsIo } from './routes/settings.js';
import bluetoothRouter, { setControlUnit, setSimulator, setSyncService } from './routes/bluetooth.js';
import sessionsRouter, { setSessionService } from './routes/sessions.js';
import configRouter, { setConfigService } from './routes/config.js';
import recordsRouter from './routes/records.js';
import uploadRouter from './routes/upload.js';
import devicesRouter from './routes/devices.js';
import preferencesRouter from './routes/preferences.js';

// Import services
import { SessionService } from './services/SessionService.js';
import { ConfigService } from './services/ConfigService.js';
import { ChampionshipService } from './services/ChampionshipService.js';

const app = express();
const httpServer = createServer(app);
const prisma = new PrismaClient();

// Configure SQLite for performance (WAL mode)
async function configureSQLite() {
  await prisma.$queryRawUnsafe('PRAGMA journal_mode = WAL');
  await prisma.$queryRawUnsafe('PRAGMA synchronous = NORMAL');
  await prisma.$queryRawUnsafe('PRAGMA cache_size = -8000');
  await prisma.$queryRawUnsafe('PRAGMA temp_store = MEMORY');
  console.log('✅ SQLite configured: WAL mode enabled');
}
configureSQLite().catch(console.error);

const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:3001'],
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Initialize services
const sessionService = new SessionService(io);
const configService = new ConfigService(io);
const championshipService = new ChampionshipService(io);

// Initialize hardware (both always available, user chooses which to connect)
const controlUnit = new ControlUnit();
const simulator = new CarreraSimulator(io);
const syncService = new SyncService(io);

// Pass references to bluetooth router
setControlUnit(controlUnit);
setSimulator(simulator);
setSyncService(syncService);

console.log('🔌 Hardware initialized: ControlUnit + Simulator available');
console.log('   Connect via POST /api/bluetooth/connect { address: "SIMULATOR" | "<CU_ADDRESS>" }');

// Connect services
syncService.setSessionService(sessionService);
sessionService.setSyncService(syncService);

// SessionService -> ChampionshipService (event-based)
sessionService.on('sessionFinished', ({ sessionId, championshipId }) => {
  championshipService.onSessionFinished(sessionId, championshipId);
});

sessionService.on('sessionReset', ({ sessionId, championshipId }) => {
  championshipService.onStandingsChanged(championshipId, sessionId, 'session_reset');
});

sessionService.on('sessionDeleted', ({ sessionId, championshipId }) => {
  championshipService.onStandingsChanged(championshipId, sessionId, 'session_deleted');
});

// Pass io to settings
setSettingsIo(io);

// Connect services
championshipService.setSessionService(sessionService);

// Pass services to routes
setSessionService(sessionService);
setChampionshipService(championshipService);
setConfigService(configService);

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// Serve images via API endpoint (avoids port issues)
app.get('/api/img/:type/:filename', (req, res) => {
  const { type, filename } = req.params;
  const validTypes = ['drivers', 'cars', 'tracks', 'teams'];
  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: 'Invalid image type' });
  }
  const filePath = path.join(__dirname, '../public/uploads', type, filename);
  res.sendFile(filePath, (err) => {
    if (err) {
      res.status(404).json({ error: 'Image not found' });
    }
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.8.0'
  });
});

// API info
app.get('/api', (req, res) => {
  res.json({
    name: 'RaceHubOS API',
    version: '1.8.0',
    endpoints: {
      drivers: '/api/drivers',
      cars: '/api/cars',
      tracks: '/api/tracks',
      teams: '/api/teams',
      championships: '/api/championships',
      sessions: '/api/sessions',
      config: '/api/config',
      records: '/api/records',
      stats: '/api/stats',
      bluetooth: '/api/bluetooth',
      settings: '/api/settings',
      sync: '/api/sync',
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
app.use('/api/settings', settingsRouter);
app.use('/api/bluetooth', bluetoothRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/config', configRouter);
app.use('/api/records', recordsRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/devices', devicesRouter);
app.use('/api/preferences', preferencesRouter);

// SyncService endpoints (hardware control)
app.get('/api/sync/state', (req, res) => {
  res.json({
    ...syncService.getState(),
    session: sessionService.getState(),
  });
});

app.get('/api/sync/leaderboard', (req, res) => {
  res.json(sessionService.getLeaderboard());
});

app.post('/api/sync/load-session/:sessionId', async (req, res) => {
  try {
    const session = await sessionService.loadSession(req.params.sessionId);
    res.json({ success: true, session: { id: session.id, type: session.type } });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/sync/reset', async (req, res) => {
  await sessionService.resetForNewSession();
  res.json({ success: true });
});

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

// Simulator control endpoints (for direct simulator control)
app.get('/api/simulator', (req, res) => {
  const currentDevice = syncService.getDevice();
  const isSimulatorConnected = currentDevice === simulator;
  res.json({
    ...simulator.getState(),
    isConnected: isSimulatorConnected,
  });
});

app.post('/api/simulator/start', (req, res) => {
  if (!simulator.isConnected()) {
    return res.status(400).json({ error: 'Simulator not connected' });
  }
  simulator.start();
  res.json({ status: 'started' });
});

app.post('/api/simulator/stop', (req, res) => {
  if (!simulator.isConnected()) {
    return res.status(400).json({ error: 'Simulator not connected' });
  }
  simulator.stop();
  res.json({ status: 'stopped' });
});

app.post('/api/simulator/pause', (req, res) => {
  if (!simulator.isConnected()) {
    return res.status(400).json({ error: 'Simulator not connected' });
  }
  simulator.togglePause();
  res.json({ status: 'toggled' });
});

// WebSocket connection
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  // Send current device state on connection
  const currentDevice = syncService.getDevice();
  if (currentDevice === simulator && simulator.isConnected()) {
    socket.emit('race:status', {
      running: simulator.isRunning,
      active: simulator.raceActive,
      raceTime: simulator.raceTime,
      carCount: simulator.cars.length,
      deviceType: 'simulator'
    });
  } else if (currentDevice === controlUnit && controlUnit.isConnected()) {
    socket.emit('cu:status', {
      connected: true,
      deviceType: 'controlUnit'
    });
  } else {
    socket.emit('cu:status', { connected: false, deviceType: null });
  }

  socket.on('disconnect', () => {
    console.log(`❌ Client disconnected: ${socket.id}`);
  });

  // Race control events (use SyncService for device-agnostic control)
  socket.on('race:start', async (data) => {
    console.log('▶️  Race start requested:', data);
    await syncService.startRace();
  });

  socket.on('race:pause', async () => {
    console.log('⏸️  Race pause requested');
    if (simulator.isConnected()) {
      simulator.togglePause();
    }
  });

  socket.on('race:stop', async () => {
    console.log('⏹️  Race stop requested');
    await syncService.stopRace();
  });

  socket.on('car:setSpeed', (data) => {
    console.log('🏎️  Set speed:', data);
    if (simulator.isConnected()) {
      simulator.setCarSpeed(data.carId, data.speed);
    }
  });

  // Direct simulator control (legacy, prefer using SyncService)
  socket.on('simulator:start', () => {
    if (simulator.isConnected()) simulator.start();
  });

  socket.on('simulator:stop', () => {
    if (simulator.isConnected()) simulator.stop();
  });

  socket.on('simulator:pause', () => {
    if (simulator.isConnected()) simulator.togglePause();
  });

  socket.on('simulator:getState', () => {
    const device = syncService.getDevice();
    if (device === simulator) {
      socket.emit('simulator:state', simulator.getState());
    } else if (device === controlUnit) {
      socket.emit('cu:state', { connected: controlUnit.isConnected() });
    } else {
      socket.emit('cu:state', { connected: false });
    }
  });
});

// Serve frontend build (production mode)
const frontendDist = path.join(__dirname, '../../frontend/dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  // SPA fallback: non-API routes serve index.html
  app.get('{*path}', (req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

const PORT = process.env.PORT || 3000;
const hasFrontend = fs.existsSync(frontendDist);

httpServer.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════╗
║         🏁 RaceHubOS                 ║
╠═══════════════════════════════════════╣
║  HTTP: http://localhost:${PORT}       ║
║  WebSocket: Ready                     ║
║  Frontend: ${hasFrontend ? 'Serving build        ' : 'Not built (dev mode) '}║
║  Devices: Simulator + Control Unit    ║
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

  try {
    io.close();
    syncService.close();
    simulator.disconnect();
    controlUnit.disconnect();
    httpServer.close();
  } catch (error) {
    // Ignore errors
  }

  console.log('✅ Server closed');
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
