import request from 'supertest';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { Server } from 'socket.io';
import { createServer } from 'http';
import sessionsRouter, { setSessionManager } from '../routes/sessions-simple.js';
import { SessionManager } from '../services/SessionManager.js';

const prisma = new PrismaClient();
let app;
let httpServer;
let io;
let sessionManager;
let testTrack;

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
  app.use('/api/sessions', sessionsRouter);

  // Create test track
  testTrack = await prisma.track.create({
    data: {
      name: 'Test Track',
      length: 25.5,
      corners: 8
    }
  });
});

afterAll(async () => {
  await prisma.lap.deleteMany();
  await prisma.sessionDriver.deleteMany();
  await prisma.session.deleteMany();
  await prisma.track.deleteMany();
  await prisma.$disconnect();
  io.close();
  httpServer.close();
});

describe('Sessions CRUD API', () => {
  describe('POST /api/sessions', () => {
    it('should create a new session with default phases', async () => {
      const response = await request(app)
        .post('/api/sessions')
        .send({
          name: 'Test Session 1',
          type: 'race',
          trackId: testTrack.id
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.name).toBe('Test Session 1');
      expect(response.body.data.type).toBe('race');
      expect(response.body.data.status).toBe('draft');
      expect(response.body.data.fuelMode).toBe('OFF');
      expect(response.body.data.phases).toHaveLength(3);

      // Check default phases
      const phaseNames = response.body.data.phases.map(p => p.phase);
      expect(phaseNames).toContain('practice');
      expect(phaseNames).toContain('qualif');
      expect(phaseNames).toContain('race');

      // Check phase status
      response.body.data.phases.forEach(phase => {
        expect(phase.status).toBe('waiting');
      });
    });

    it('should create session with custom phases', async () => {
      const response = await request(app)
        .post('/api/sessions')
        .send({
          name: 'Custom Phases Session',
          type: 'race',
          trackId: testTrack.id,
          phases: [
            { phase: 'practice', duration: 10, maxLaps: null },
            { phase: 'race', duration: null, maxLaps: 50 }
          ]
        });

      expect(response.status).toBe(201);
      expect(response.body.data.phases).toHaveLength(2);

      const practicePhase = response.body.data.phases.find(p => p.phase === 'practice');
      expect(practicePhase.duration).toBe(10);
      expect(practicePhase.maxLaps).toBeNull();

      const racePhase = response.body.data.phases.find(p => p.phase === 'race');
      expect(racePhase.duration).toBeNull();
      expect(racePhase.maxLaps).toBe(50);
    });

    it('should fail without required fields', async () => {
      const response = await request(app)
        .post('/api/sessions')
        .send({
          name: 'Invalid Session'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('type and trackId are required');
    });
  });

  describe('GET /api/sessions', () => {
    it('should list all sessions', async () => {
      const response = await request(app).get('/api/sessions');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.count).toBeGreaterThan(0);
    });

    it('should filter sessions by status', async () => {
      const response = await request(app).get('/api/sessions?status=draft');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      response.body.data.forEach(session => {
        expect(session.status).toBe('draft');
      });
    });
  });

  describe('GET /api/sessions/:id', () => {
    let sessionId;

    beforeAll(async () => {
      const session = await prisma.session.create({
        data: {
          name: 'Session for GET',
          type: 'practice',
          trackId: testTrack.id,
          status: 'draft',
          phases: {
            create: [
              { phase: 'practice', status: 'waiting' }
            ]
          }
        }
      });
      sessionId = session.id;
    });

    it('should get session by id with full details', async () => {
      const response = await request(app).get(`/api/sessions/${sessionId}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(sessionId);
      expect(response.body.data).toHaveProperty('track');
      expect(response.body.data).toHaveProperty('phases');
      expect(response.body.data).toHaveProperty('drivers');
      expect(response.body.data).toHaveProperty('laps');
      expect(response.body.data).toHaveProperty('events');
    });

    it('should return 404 for non-existent session', async () => {
      const response = await request(app).get('/api/sessions/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Session not found');
    });
  });

  describe('PUT /api/sessions/:id', () => {
    let sessionId;

    beforeEach(async () => {
      const session = await prisma.session.create({
        data: {
          name: 'Session for PUT',
          type: 'race',
          trackId: testTrack.id,
          status: 'draft'
        }
      });
      sessionId = session.id;
    });

    it('should update session name', async () => {
      const response = await request(app)
        .put(`/api/sessions/${sessionId}`)
        .send({
          name: 'Updated Session Name'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Updated Session Name');
    });

    it('should update session type and fuelMode', async () => {
      const response = await request(app)
        .put(`/api/sessions/${sessionId}`)
        .send({
          type: 'qualif',
          fuelMode: 'ON'
        });

      expect(response.status).toBe(200);
      expect(response.body.data.type).toBe('qualif');
      expect(response.body.data.fuelMode).toBe('ON');
    });

    it('should handle empty championshipId as null', async () => {
      const response = await request(app)
        .put(`/api/sessions/${sessionId}`)
        .send({
          championshipId: ''
        });

      expect(response.status).toBe(200);
      expect(response.body.data.championshipId).toBeNull();
    });

    it('should return 400 for invalid foreign key', async () => {
      const response = await request(app)
        .put(`/api/sessions/${sessionId}`)
        .send({
          trackId: 'invalid-track-id'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid reference');
    });
  });

  describe('DELETE /api/sessions/:id', () => {
    it('should delete a session', async () => {
      const session = await prisma.session.create({
        data: {
          name: 'Session to Delete',
          type: 'practice',
          trackId: testTrack.id
        }
      });

      const response = await request(app).delete(`/api/sessions/${session.id}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted successfully');

      // Verify deletion
      const deleted = await prisma.session.findUnique({
        where: { id: session.id }
      });
      expect(deleted).toBeNull();
    });
  });
});
