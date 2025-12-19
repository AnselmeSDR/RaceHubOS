import request from 'supertest';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { Server } from 'socket.io';
import { createServer } from 'http';
import sessionControlRouter, { setSessionManager } from '../routes/session-control.js';
import { SessionManager } from '../services/SessionManager.js';

const prisma = new PrismaClient();
let app;
let httpServer;
let io;
let sessionManager;
let testTrack;
let testDriver;
let testCar;

beforeAll(async () => {
  // Create Express app
  app = express();
  app.use(express.json());

  // Setup Socket.io
  httpServer = createServer(app);
  io = new Server(httpServer);

  // Initialize SessionManager
  sessionManager = new SessionManager(io);
  setSessionManager(sessionManager);

  // Mount router
  app.use('/api/session-control', sessionControlRouter);

  // Create test data
  testTrack = await prisma.track.create({
    data: {
      name: 'Control Test Track',
      length: 30.0,
      corners: 10
    }
  });

  testDriver = await prisma.driver.create({
    data: {
      name: 'Test Driver',
      number: 42
    }
  });

  testCar = await prisma.car.create({
    data: {
      brand: 'Ferrari',
      model: '488 GT3'
    }
  });
});

afterAll(async () => {
  await prisma.lap.deleteMany();
  await prisma.raceEvent.deleteMany();
  await prisma.sessionPhase.deleteMany();
  await prisma.sessionDriver.deleteMany();
  await prisma.session.deleteMany();
  await prisma.driver.deleteMany();
  await prisma.car.deleteMany();
  await prisma.track.deleteMany();
  await prisma.$disconnect();
  io.close();
  httpServer.close();
});

describe('Session Control API', () => {
  describe('POST /api/session-control/:id/sync', () => {
    let sessionId;

    beforeEach(async () => {
      const session = await prisma.session.create({
        data: {
          name: 'Sync Test Session',
          type: 'race',
          trackId: testTrack.id,
          status: 'draft',
          phases: {
            create: [
              { phase: 'practice', status: 'waiting' },
              { phase: 'race', status: 'waiting' }
            ]
          }
        }
      });
      sessionId = session.id;
    });

    it('should sync session with device info', async () => {
      const deviceInfo = {
        version: '1.2.3',
        fuelMode: true,
        realMode: false,
        pitLane: true,
        lapCounter: true,
        numCars: 6
      };

      const response = await request(app)
        .post(`/api/session-control/${sessionId}/sync`)
        .send({ deviceInfo });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('ready');
      expect(response.body.data.cuVersion).toBe('1.2.3');
      expect(response.body.data.cuFuelMode).toBe(true);
      expect(response.body.data.cuNumCars).toBe(6);
      expect(response.body.data.syncedAt).toBeTruthy();
    });

    it('should fail without deviceInfo', async () => {
      const response = await request(app)
        .post(`/api/session-control/${sessionId}/sync`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('deviceInfo is required');
    });
  });

  describe('Phase Management', () => {
    let sessionId;

    beforeEach(async () => {
      const session = await prisma.session.create({
        data: {
          name: 'Phase Test Session',
          type: 'race',
          trackId: testTrack.id,
          status: 'ready',
          phases: {
            create: [
              { phase: 'practice', status: 'waiting', duration: 10 },
              { phase: 'qualifying', status: 'waiting', maxLaps: 5 },
              { phase: 'race', status: 'waiting', maxLaps: 20 }
            ]
          }
        }
      });
      sessionId = session.id;
    });

    describe('GET /api/session-control/:id/phases/:phase', () => {
      it('should get phase info', async () => {
        const response = await request(app)
          .get(`/api/session-control/${sessionId}/phases/practice`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.phase).toBe('practice');
        expect(response.body.data.status).toBe('waiting');
        expect(response.body.data.duration).toBe(10);
      });

      it('should return 404 for non-existent phase', async () => {
        const response = await request(app)
          .get(`/api/session-control/${sessionId}/phases/invalid`);

        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
      });
    });

    describe('POST /api/session-control/:id/phases/:phase/start', () => {
      it('should start a phase', async () => {
        const response = await request(app)
          .post(`/api/session-control/${sessionId}/phases/practice/start`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.status).toBe('running');
        expect(response.body.data.startedAt).toBeTruthy();

        // Verify session became active
        const session = await prisma.session.findUnique({
          where: { id: sessionId }
        });
        expect(session.status).toBe('active');
        expect(session.startedAt).toBeTruthy();
      });
    });

    describe('POST /api/session-control/:id/phases/:phase/pause', () => {
      beforeEach(async () => {
        await sessionManager.startPhase(sessionId, 'practice');
      });

      it('should pause a running phase', async () => {
        const response = await request(app)
          .post(`/api/session-control/${sessionId}/phases/practice/pause`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.status).toBe('paused');
        expect(response.body.data.pausedAt).toBeTruthy();
      });
    });

    describe('POST /api/session-control/:id/phases/:phase/resume', () => {
      beforeEach(async () => {
        await sessionManager.startPhase(sessionId, 'practice');
        await sessionManager.pausePhase(sessionId, 'practice');
      });

      it('should resume a paused phase', async () => {
        const response = await request(app)
          .post(`/api/session-control/${sessionId}/phases/practice/resume`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.status).toBe('running');
        expect(response.body.data.pausedAt).toBeNull();
      });
    });

    describe('POST /api/session-control/:id/phases/:phase/finish', () => {
      beforeEach(async () => {
        await sessionManager.startPhase(sessionId, 'practice');
      });

      it('should finish a phase', async () => {
        const response = await request(app)
          .post(`/api/session-control/${sessionId}/phases/practice/finish`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.status).toBe('finished');
        expect(response.body.data.finishedAt).toBeTruthy();
      });

      it('should update driver stats when race phase finishes', async () => {
        // Add driver to session
        await prisma.sessionDriver.create({
          data: {
            sessionId,
            driverId: testDriver.id,
            carId: testCar.id,
            controller: '1',
            gridPos: 1
          }
        });

        // Record some laps
        await prisma.lap.createMany({
          data: [
            {
              sessionId,
              phase: 'race',
              driverId: testDriver.id,
              carId: testCar.id,
              controller: '1',
              lapNumber: 1,
              lapTime: 45000
            },
            {
              sessionId,
              phase: 'race',
              driverId: testDriver.id,
              carId: testCar.id,
              controller: '1',
              lapNumber: 2,
              lapTime: 43000
            }
          ]
        });

        // Start and finish race phase
        await sessionManager.startPhase(sessionId, 'race');
        const response = await request(app)
          .post(`/api/session-control/${sessionId}/phases/race/finish`);

        expect(response.status).toBe(200);

        // Check driver stats were updated
        const updatedDriver = await prisma.driver.findUnique({
          where: { id: testDriver.id }
        });
        expect(updatedDriver.totalRaces).toBe(1);
        expect(updatedDriver.wins).toBe(1);
        expect(updatedDriver.bestLap).toBe(43000);

        // Check session driver final position
        const sessionDriver = await prisma.sessionDriver.findUnique({
          where: {
            sessionId_driverId: {
              sessionId,
              driverId: testDriver.id
            }
          }
        });
        expect(sessionDriver.finalPos).toBe(1);
      });
    });
  });

  describe('POST /api/session-control/:id/phases/:phase/laps', () => {
    let sessionId;

    beforeEach(async () => {
      const session = await prisma.session.create({
        data: {
          name: 'Lap Recording Session',
          type: 'race',
          trackId: testTrack.id,
          status: 'active',
          phases: {
            create: [
              { phase: 'race', status: 'running', startedAt: new Date() }
            ]
          },
          drivers: {
            create: {
              driverId: testDriver.id,
              carId: testCar.id,
              controller: '1',
              gridPos: 1
            }
          }
        }
      });
      sessionId = session.id;
    });

    it('should record a lap', async () => {
      const response = await request(app)
        .post(`/api/session-control/${sessionId}/phases/race/laps`)
        .send({
          driverId: testDriver.id,
          carId: testCar.id,
          controller: '1',
          lapTime: 42500,
          lapNumber: 1,
          speed: 125.5
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.lapTime).toBe(42500);
      expect(response.body.data.lapNumber).toBe(1);
      expect(response.body.data.speed).toBe(125.5);
      expect(response.body.data.driver).toBeTruthy();
      expect(response.body.data.car).toBeTruthy();
    });
  });

  describe('POST /api/session-control/:id/finish', () => {
    let sessionId;

    beforeEach(async () => {
      const session = await prisma.session.create({
        data: {
          name: 'Finish Test Session',
          type: 'race',
          trackId: testTrack.id,
          status: 'active',
          phases: {
            create: [
              { phase: 'race', status: 'finished', finishedAt: new Date() }
            ]
          }
        }
      });
      sessionId = session.id;
    });

    it('should finish entire session', async () => {
      const response = await request(app)
        .post(`/api/session-control/${sessionId}/finish`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('finished');
      expect(response.body.data.finishedAt).toBeTruthy();
    });
  });

  describe('GET /api/session-control/active', () => {
    it('should get active session', async () => {
      const session = await prisma.session.create({
        data: {
          name: 'Active Session',
          type: 'race',
          trackId: testTrack.id,
          status: 'active',
          startedAt: new Date()
        }
      });

      const response = await request(app).get('/api/session-control/active');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(session.id);
      expect(response.body.data.status).toBe('active');
    });

    it('should return 404 when no active session', async () => {
      // Finish all active sessions
      await prisma.session.updateMany({
        where: { status: 'active' },
        data: { status: 'finished' }
      });

      const response = await request(app).get('/api/session-control/active');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('No active session');
    });
  });
});
