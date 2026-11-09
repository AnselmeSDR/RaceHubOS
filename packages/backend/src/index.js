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
const rootDir = path.join(__dirname, '../../..');
const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf-8'));
const APP_VERSION = pkg.version;
import { createPrismaClient } from './lib/prisma.js';
import { mirrorEmits } from './addons/events.js';
import { loadAddons } from './addons/loader.js';
import { getDatabasePath } from './lib/database-url.js';

// Import routes
import driversRouter from './routes/drivers.js';
import carsRouter from './routes/cars.js';
import tracksRouter from './routes/tracks.js';
import teamsRouter from './routes/teams.js';
import championshipsRouter from './routes/championships.js';
import statsRouter from './routes/stats.js';
import settingsRouter from './routes/settings.js';
import bluetoothRouter from './routes/bluetooth.js';
import sessionsRouter from './routes/sessions.js';
import configRouter from './routes/config.js';
import recordsRouter from './routes/records.js';
import uploadRouter from './routes/upload.js';
import devicesRouter from './routes/devices.js';
import preferencesRouter from './routes/preferences.js';
import updateRouter from './routes/update.js';
import { createAddonManagerRouter } from './routes/addonManager.js';
import { createAddonManager } from './addons/manager.js';

import { autoConnect } from './server/autoConnect.js';
import { addCoreRoutes } from './server/coreRoutes.js';
import { createSimulatorRouter, createSyncRouter } from './server/deviceRoutes.js';
import { createServices } from './server/services.js';
import { handleSockets } from './server/sockets.js';

const app = express();
const httpServer = createServer(app);
const prisma = createPrismaClient();

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

// Everything the core sends to the browsers also reaches the add-ons (ctx.events)
const coreEvents = mirrorEmits(io);

const { sessionService, configService, championshipService, controlUnit, simulator, syncService } = createServices(io);
console.log('🔌 Hardware initialized: ControlUnit + Simulator available');
console.log('   Connect via POST /api/bluetooth/connect { address: "SIMULATOR" | "<CU_ADDRESS>" }');

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

addCoreRoutes(app, { version: APP_VERSION, uploadsDir: path.join(__dirname, '../public/uploads') });

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
app.use('/api/update', updateRouter);
app.use(
  '/api/addon-manager',
  createAddonManagerRouter({ manager: createAddonManager({ rootDir, prisma }), io }).router
);

app.use('/api/sync', createSyncRouter({ syncService, sessionService }));
app.use('/api/simulator', createSimulatorRouter({ simulator, syncService }));
handleSockets(io, { syncService, simulator, controlUnit });

// Add-ons: after the core routes, before the SPA fallback — docs/ADDONS.md
const addons = await loadAddons({
  rootDir,
  app,
  io,
  events: coreEvents,
  prisma,
  services: {
    session: sessionService,
    championship: championshipService,
    config: configService,
    sync: syncService,
    controlUnit,
    simulator,
  },
  version: APP_VERSION,
  coreDatabasePath: getDatabasePath(),
});

// An unknown API route answers 404 in JSON, never the app's page: a removed add-on,
// a typo or an old client must get an error it can read
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, error: `Not found: ${req.method} ${req.originalUrl}` });
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

httpServer.listen(PORT, async () => {
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

  await autoConnect({ prisma, syncService, controlUnit });
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
    addons.unload().catch(() => {});
    syncService.close();
    simulator.disconnect();
    controlUnit.disconnect();
    io.close();
  } catch {
    // Ignore errors
  }

  httpServer.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });

  // Force exit after 3s if close hangs
  setTimeout(() => process.exit(1), 3000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
