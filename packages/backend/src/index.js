import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import { CarreraSimulator } from './services/simulator.js';

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

// Middleware
app.use(cors());
app.use(express.json());
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
      races: '/api/races',
      championships: '/api/championships',
      simulator: '/api/simulator',
    },
  });
});

// Simulator control endpoints
app.get('/api/simulator', (req, res) => {
  res.json(simulator.getState());
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
  socket.emit('race:status', {
    running: simulator.isRunning,
    active: simulator.raceActive,
    raceTime: simulator.raceTime,
    carCount: simulator.cars.length,
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
