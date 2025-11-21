import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';

const app = express();
const httpServer = createServer(app);
const prisma = new PrismaClient();

const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

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
    },
  });
});

// WebSocket connection
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`❌ Client disconnected: ${socket.id}`);
  });

  // Race control events
  socket.on('race:start', (data) => {
    console.log('▶️  Race start requested:', data);
    // TODO: Start race logic
    socket.broadcast.emit('race:started');
  });

  socket.on('race:pause', () => {
    console.log('⏸️  Race pause requested');
    // TODO: Pause race logic
    socket.broadcast.emit('race:paused');
  });

  socket.on('race:stop', () => {
    console.log('⏹️  Race stop requested');
    // TODO: Stop race logic
    socket.broadcast.emit('race:finished', { results: [] });
  });

  socket.on('car:setSpeed', (data) => {
    console.log('🏎️  Set speed:', data);
    // TODO: Set car speed
  });

  socket.on('car:setBrake', (data) => {
    console.log('🛑 Set brake:', data);
    // TODO: Set car brake
  });

  socket.on('car:setFuel', (data) => {
    console.log('⛽ Set fuel:', data);
    // TODO: Set car fuel
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
