import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import { CarreraSimulator } from './services/simulator.js';

// Import routes
import driversRouter from './routes/drivers.js';
import carsRouter from './routes/cars.js';
import tracksRouter from './routes/tracks.js';
import teamsRouter from './routes/teams.js';
import sessionsRouter from './routes/sessions.js';
import championshipsRouter from './routes/championships.js';
import statsRouter from './routes/stats.js';
import activeSessionRouter, { setIo, emitToClients } from './routes/activeSession.js';
import settingsRouter, { setSettingsIo } from './routes/settings.js';

const app = express();
const httpServer = createServer(app);
const prisma = new PrismaClient();

const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

// Initialize simulator
const simulator = new CarreraSimulator(io);
simulator.init(6); // 6 cars by default

// Pass io to activeSession and settings
setIo(io);
setSettingsIo(io);

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
      races: '/api/races',
      championships: '/api/championships',
      stats: '/api/stats',
      simulator: '/api/simulator',
      activeSession: '/api/active-session',
    },
  });
});

// Mount API routes
app.use('/api/drivers', driversRouter);
app.use('/api/cars', carsRouter);
app.use('/api/tracks', tracksRouter);
app.use('/api/teams', teamsRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/championships', championshipsRouter);
app.use('/api/stats', statsRouter);
app.use('/api/active-session', activeSessionRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/bluetooth', settingsRouter);

// Simulator control endpoints
app.get('/api/simulator', (req, res) => {
  const state = simulator.getState();
  const isMockDevice = process.env.USE_MOCK_DEVICE === 'true';

  // If not using mock device, don't return simulated cars
  res.json({
    ...state,
    cars: isMockDevice ? state.cars : [],
    isMockDevice: isMockDevice
  });
});

app.post('/api/simulator/start', (req, res) => {
  simulator.start();
  res.json({ status: 'started' });
});

app.post('/api/simulator/stop', (req, res) => {
  simulator.stop();
  res.json({ status: 'stopped' });
});

app.post('/api/simulator/pause', (req, res) => {
  simulator.togglePause();
  res.json({ status: 'toggled' });
});

// WebSocket connection
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  // Send current simulator state on connection
  const isMockDevice = process.env.USE_MOCK_DEVICE === 'true';
  socket.emit('race:status', {
    running: simulator.isRunning,
    active: simulator.raceActive,
    raceTime: simulator.raceTime,
    carCount: isMockDevice ? simulator.cars.length : 0,
    isMockDevice: isMockDevice
  });

  socket.on('disconnect', () => {
    console.log(`❌ Client disconnected: ${socket.id}`);
  });

  // Race control events
  socket.on('race:start', (data) => {
    console.log('▶️  Race start requested:', data);
    simulator.start();
  });

  socket.on('race:pause', () => {
    console.log('⏸️  Race pause requested');
    simulator.togglePause();
  });

  socket.on('race:stop', () => {
    console.log('⏹️  Race stop requested');
    simulator.stop();
  });

  socket.on('car:setSpeed', (data) => {
    console.log('🏎️  Set speed:', data);
    simulator.setCarSpeed(data.carId, data.speed);
  });

  // Simulator control via WebSocket
  socket.on('simulator:start', () => {
    simulator.start();
  });

  socket.on('simulator:stop', () => {
    simulator.stop();
  });

  socket.on('simulator:pause', () => {
    simulator.togglePause();
  });

  socket.on('simulator:getState', () => {
    socket.emit('simulator:state', simulator.getState());
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
process.on('SIGTERM', async () => {
  console.log('⚠️  SIGTERM received, closing server...');
  await prisma.$disconnect();
  httpServer.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});
