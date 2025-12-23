import request from 'supertest';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { Server } from 'socket.io';
import { createServer } from 'http';
import sessionsRouter, { setSessionManager as setSimpleSessionManager } from '../routes/sessions-simple.js';
import sessionControlRouter, { setSessionManager as setControlSessionManager } from '../routes/session-control.js';
import { SessionManager } from '../services/SessionManager.js';

const prisma = new PrismaClient();
let app;
let httpServer;
let io;
let sessionManager;

beforeAll(async () => {
  // Create Express app
  app = express();
  app.use(express.json());

  // Setup Socket.io
  httpServer = createServer(app);
  io = new Server(httpServer);

  // Initialize SessionManager
  sessionManager = new SessionManager(io);
  setSimpleSessionManager(sessionManager);
  setControlSessionManager(sessionManager);

  // Mount routers
  app.use('/api/sessions', sessionsRouter);
  app.use('/api/session-control', sessionControlRouter);
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

describe('Complete Session Workflow', () => {
  let trackId;
  let driver1Id, driver2Id, driver3Id;
  let car1Id, car2Id, car3Id;
  let sessionId;

  describe('Setup: Create test data', () => {
    it('should create a track', async () => {
      const track = await prisma.track.create({
        data: {
          name: 'Monaco Circuit',
          length: 28.5,
          corners: 12
        }
      });
      trackId = track.id;
      expect(trackId).toBeTruthy();
    });

    it('should create drivers', async () => {
      const driver1 = await prisma.driver.create({
        data: { name: 'Hamilton', number: 44 }
      });
      const driver2 = await prisma.driver.create({
        data: { name: 'Verstappen', number: 1 }
      });
      const driver3 = await prisma.driver.create({
        data: { name: 'Leclerc', number: 16 }
      });

      driver1Id = driver1.id;
      driver2Id = driver2.id;
      driver3Id = driver3.id;

      expect(driver1Id).toBeTruthy();
      expect(driver2Id).toBeTruthy();
      expect(driver3Id).toBeTruthy();
    });

    it('should create cars', async () => {
      const car1 = await prisma.car.create({
        data: { brand: 'Mercedes', model: 'W14' }
      });
      const car2 = await prisma.car.create({
        data: { brand: 'Red Bull', model: 'RB19' }
      });
      const car3 = await prisma.car.create({
        data: { brand: 'Ferrari', model: 'SF-23' }
      });

      car1Id = car1.id;
      car2Id = car2.id;
      car3Id = car3.id;

      expect(car1Id).toBeTruthy();
      expect(car2Id).toBeTruthy();
      expect(car3Id).toBeTruthy();
    });
  });

  describe('Step 1: Create session with drivers', () => {
    it('should create a race session with 3 drivers', async () => {
      const response = await request(app)
        .post('/api/sessions')
        .send({
          name: 'Monaco Grand Prix 2025',
          type: 'race',
          trackId: trackId,
          fuelMode: 'ON',
          drivers: [
            {
              driverId: driver1Id,
              carId: car1Id,
              controller: '1',
              gridPos: 1
            },
            {
              driverId: driver2Id,
              carId: car2Id,
              controller: '2',
              gridPos: 2
            },
            {
              driverId: driver3Id,
              carId: car3Id,
              controller: '3',
              gridPos: 3
            }
          ],
          phases: [
            { phase: 'practice', duration: 10, maxLaps: null },
            { phase: 'qualif', duration: 15, maxLaps: null },
            { phase: 'race', duration: null, maxLaps: 50 }
          ]
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('draft');
      expect(response.body.data.drivers).toHaveLength(3);
      expect(response.body.data.phases).toHaveLength(3);

      sessionId = response.body.data.id;
      console.log(`✅ Session created: ${sessionId}`);
    });
  });

  describe('Step 2: Sync session with Control Unit/Simulator', () => {
    it('should sync session and change status to ready', async () => {
      const response = await request(app)
        .post(`/api/session-control/${sessionId}/sync`)
        .send({
          deviceInfo: {
            version: '2.0.1',
            fuelMode: true,
            realMode: false,
            pitLane: true,
            lapCounter: true,
            numCars: 6
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('ready');
      expect(response.body.data.cuVersion).toBe('2.0.1');
      expect(response.body.data.syncedAt).toBeTruthy();

      console.log('✅ Session synced with device');
    });
  });

  describe('Step 3: Run Practice Phase', () => {
    it('should start practice phase', async () => {
      const response = await request(app)
        .post(`/api/session-control/${sessionId}/phases/practice/start`);

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('running');

      // Verify session is now active
      const session = await prisma.session.findUnique({
        where: { id: sessionId }
      });
      expect(session.status).toBe('active');

      console.log('✅ Practice phase started');
    });

    it('should record practice laps', async () => {
      const laps = [
        { driverId: driver1Id, carId: car1Id, controller: '1', lapTime: 48000, lapNumber: 1 },
        { driverId: driver2Id, carId: car2Id, controller: '2', lapTime: 47500, lapNumber: 1 },
        { driverId: driver3Id, carId: car3Id, controller: '3', lapTime: 49000, lapNumber: 1 },
        { driverId: driver1Id, carId: car1Id, controller: '1', lapTime: 46500, lapNumber: 2 },
        { driverId: driver2Id, carId: car2Id, controller: '2', lapTime: 46000, lapNumber: 2 }
      ];

      for (const lap of laps) {
        const response = await request(app)
          .post(`/api/session-control/${sessionId}/phases/practice/laps`)
          .send(lap);

        expect(response.status).toBe(200);
      }

      console.log('✅ Practice laps recorded');
    });

    it('should finish practice phase', async () => {
      const response = await request(app)
        .post(`/api/session-control/${sessionId}/phases/practice/finish`);

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('finished');
      expect(response.body.data.finishedAt).toBeTruthy();

      console.log('✅ Practice phase finished');
    });
  });

  describe('Step 4: Run Qualifying Phase', () => {
    it('should start qualifying phase', async () => {
      const response = await request(app)
        .post(`/api/session-control/${sessionId}/phases/qualif/start`);

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('running');

      console.log('✅ Qualifying phase started');
    });

    it('should record qualifying laps', async () => {
      const laps = [
        { driverId: driver1Id, carId: car1Id, controller: '1', lapTime: 45000, lapNumber: 1 },
        { driverId: driver2Id, carId: car2Id, controller: '2', lapTime: 44500, lapNumber: 1 },
        { driverId: driver3Id, carId: car3Id, controller: '3', lapTime: 46000, lapNumber: 1 }
      ];

      for (const lap of laps) {
        const response = await request(app)
          .post(`/api/session-control/${sessionId}/phases/qualif/laps`)
          .send(lap);

        expect(response.status).toBe(200);
      }

      console.log('✅ Qualifying laps recorded');
    });

    it('should finish qualifying phase', async () => {
      const response = await request(app)
        .post(`/api/session-control/${sessionId}/phases/qualif/finish`);

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('finished');

      console.log('✅ Qualifying phase finished');
    });
  });

  describe('Step 5: Run Race Phase', () => {
    it('should start race phase', async () => {
      const response = await request(app)
        .post(`/api/session-control/${sessionId}/phases/race/start`);

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('running');

      console.log('✅ Race phase started');
    });

    it('should record race laps (simplified - 5 laps per driver)', async () => {
      const lapTimes = {
        [driver1Id]: [45200, 45100, 44800, 45000, 44900],
        [driver2Id]: [44800, 44600, 44500, 44700, 44400],
        [driver3Id]: [46000, 45800, 45900, 46100, 45700]
      };

      let lapNumber = 0;
      for (let i = 0; i < 5; i++) {
        for (const [driverId, times] of Object.entries(lapTimes)) {
          lapNumber++;
          const carId = driverId === driver1Id ? car1Id : driverId === driver2Id ? car2Id : car3Id;
          const controller = driverId === driver1Id ? '1' : driverId === driver2Id ? '2' : '3';

          await request(app)
            .post(`/api/session-control/${sessionId}/phases/race/laps`)
            .send({
              driverId,
              carId,
              controller,
              lapTime: times[i],
              lapNumber: i + 1
            });
        }
      }

      console.log('✅ Race laps recorded');
    });

    it('should finish race phase and update driver stats', async () => {
      const response = await request(app)
        .post(`/api/session-control/${sessionId}/phases/race/finish`);

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('finished');

      // Check driver stats were updated
      const driver1 = await prisma.driver.findUnique({ where: { id: driver1Id } });
      const driver2 = await prisma.driver.findUnique({ where: { id: driver2Id } });
      const driver3 = await prisma.driver.findUnique({ where: { id: driver3Id } });

      // Driver 2 (Verstappen) had fastest laps, should win
      expect(driver1.totalRaces).toBe(1);
      expect(driver2.totalRaces).toBe(1);
      expect(driver3.totalRaces).toBe(1);

      expect(driver2.wins).toBe(1);
      expect(driver2.podiums).toBe(1);

      expect(driver1.podiums).toBe(1);
      expect(driver3.podiums).toBe(1);

      // Check best lap (driver2 had 44400)
      expect(driver2.bestLap).toBe(44400);

      console.log('✅ Race phase finished and stats updated');
      console.log(`   Winner: Verstappen (${driver2.wins} wins)`);
      console.log(`   Best lap: ${driver2.bestLap}ms`);
    });
  });

  describe('Step 6: Finish Session', () => {
    it('should finish entire session', async () => {
      const response = await request(app)
        .post(`/api/session-control/${sessionId}/finish`);

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('finished');
      expect(response.body.data.finishedAt).toBeTruthy();

      console.log('✅ Session finished');
    });
  });

  describe('Step 7: Verify complete session data', () => {
    it('should retrieve full session with all data', async () => {
      const response = await request(app)
        .get(`/api/sessions/${sessionId}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const session = response.body.data;

      // Session details
      expect(session.name).toBe('Monaco Grand Prix 2025');
      expect(session.status).toBe('finished');
      expect(session.fuelMode).toBe('ON');

      // Track
      expect(session.track.name).toBe('Monaco Circuit');

      // Drivers
      expect(session.drivers).toHaveLength(3);
      expect(session.drivers[0].finalPos).toBeTruthy();

      // Phases
      expect(session.phases).toHaveLength(3);
      session.phases.forEach(phase => {
        expect(phase.status).toBe('finished');
        expect(phase.finishedAt).toBeTruthy();
      });

      // Laps
      expect(session.laps.length).toBeGreaterThan(0);

      console.log('✅ Session data verified');
      console.log(`   Total laps: ${session.laps.length}`);
      console.log(`   All phases completed: ${session.phases.every(p => p.status === 'finished')}`);
    });

    it('should list session in finished sessions', async () => {
      const response = await request(app)
        .get('/api/sessions?status=finished');

      expect(response.status).toBe(200);
      const finishedSession = response.body.data.find(s => s.id === sessionId);
      expect(finishedSession).toBeTruthy();
      expect(finishedSession.status).toBe('finished');

      console.log('✅ Workflow complete - Session visible in finished sessions');
    });
  });
});
