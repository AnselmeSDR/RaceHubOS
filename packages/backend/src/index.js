import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import { CarreraSimulator } from './services/simulator.js';
import { TrackSyncService } from './services/trackSync.js';
import { SimulatorSyncService } from './services/simulatorSync.js';

// Import routes
import driversRouter from './routes/drivers.js';
import carsRouter from './routes/cars.js';
import tracksRouter from './routes/tracks.js';
import teamsRouter from './routes/teams.js';
import championshipsRouter from './routes/championships.js';
import statsRouter from './routes/stats.js';
import lapsRouter from './routes/laps.js';
import settingsRouter, { setSettingsIo } from './routes/settings.js';
import bluetoothRouter, { setTrackSync } from './routes/bluetooth.js';

// Import new simplified routes
import sessionsSimpleRouter, { setSessionManager as setSimpleSessionManager } from './routes/sessions-simple.js';
import sessionControlRouter, { setSessionManager as setControlSessionManager } from './routes/session-control.js';

// Import SessionManager service
import { SessionManager } from './services/SessionManager.js';

const app = express();
const httpServer = createServer(app);
const prisma = new PrismaClient();

const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

// Initialize SessionManager
const sessionManager = new SessionManager(io);

// Initialize services
const useMockDevice = process.env.USE_MOCK_DEVICE === 'true';
let trackSync = null;
let simulator = null;
let simulatorSync = null;

if (useMockDevice) {
  // Mode simulateur
  simulator = new CarreraSimulator(io);
  simulator.init(6); // 6 cars by default

  // Service de synchronisation avec la base de données
  simulatorSync = new SimulatorSyncService(simulator, io);

  // Callback pour enregistrer les tours
  simulator.onLapComplete = (car) => {
    simulatorSync.recordLap(car.id, car.lastLapTime, car.totalLaps);
  };

  // Charger la session active au démarrage
  simulatorSync.loadActiveSession();
} else {
  // Mode Control Unit réel
  trackSync = new TrackSyncService(io);
}

// Pass io to settings
setSettingsIo(io);

// Pass SessionManager to new routes
setSimpleSessionManager(sessionManager);
setControlSessionManager(sessionManager);

// Pass services to routes
if (trackSync) {
  setTrackSync(trackSync);
  // Connect SessionManager to TrackSync for CU control
  sessionManager.setTrackSync(trackSync);
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
    version: '0.1.0',
    endpoints: {
      drivers: '/api/drivers',
      cars: '/api/cars',
      tracks: '/api/tracks',
      teams: '/api/teams',
      sessions: '/api/sessions',
      sessionControl: '/api/session-control',
      championships: '/api/championships',
      stats: '/api/stats',
      simulator: '/api/simulator',
      activeSession: '/api/active-session (deprecated)',
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
    const state = trackSync.getState();
    socket.emit('cu:status', {
      connected: state.connected,
      activeSession: state.activeSessionId,
      isMockDevice: false
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
