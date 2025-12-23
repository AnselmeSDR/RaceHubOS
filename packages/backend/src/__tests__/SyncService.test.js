import { PrismaClient } from '@prisma/client';
import { SyncService } from '../services/SyncService.js';
import EventEmitter from 'events';

const prisma = new PrismaClient();

// Mock event source (simulates CU or Simulator)
class MockEventSource extends EventEmitter {
  isConnected() {
    return true;
  }
}

// Mock Socket.io
function createMockIo() {
  const emitted = [];
  return {
    emit: (event, data) => {
      emitted.push({ event, data });
    },
    getEmitted: () => emitted,
    clear: () => emitted.length = 0,
  };
}

describe('SyncService.handleTimerEvent', () => {
  let syncService;
  let mockSource;
  let mockIo;
  let testSession;
  let testTrack;
  let testDrivers;
  let testCars;

  beforeEach(async () => {
    // Create test data
    testTrack = await prisma.track.create({
      data: {
        name: `Test Track ${Date.now()}`,
      },
    });

    testDrivers = await Promise.all([
      prisma.driver.create({ data: { name: 'Driver 1', color: '#FF0000' } }),
      prisma.driver.create({ data: { name: 'Driver 2', color: '#00FF00' } }),
    ]);

    testCars = await Promise.all([
      prisma.car.create({ data: { brand: 'Ferrari', model: 'F40' } }),
      prisma.car.create({ data: { brand: 'Porsche', model: '911' } }),
    ]);

    testSession = await prisma.session.create({
      data: {
        name: `Test Session ${Date.now()}`,
        type: 'race',
        status: 'active',
        trackId: testTrack.id,
        drivers: {
          create: [
            {
              driverId: testDrivers[0].id,
              carId: testCars[0].id,
              controller: 0,
              position: 1,
              totalLaps: 0,
              totalTime: 0,
            },
            {
              driverId: testDrivers[1].id,
              carId: testCars[1].id,
              controller: 1,
              position: 2,
              totalLaps: 0,
              totalTime: 0,
            },
          ],
        },
      },
      include: {
        drivers: true,
      },
    });

    // Create SyncService with mocks
    mockSource = new MockEventSource();
    mockIo = createMockIo();
    syncService = new SyncService(mockSource, mockIo);

    // Load the test session
    await syncService.loadSession(testSession.id);
  });

  afterEach(async () => {
    // Cleanup test data
    await prisma.lap.deleteMany({ where: { sessionId: testSession.id } });
    await prisma.sessionDriver.deleteMany({ where: { sessionId: testSession.id } });
    await prisma.raceEvent.deleteMany({ where: { sessionId: testSession.id } });
    await prisma.session.delete({ where: { id: testSession.id } });
    await prisma.driver.deleteMany({ where: { id: { in: testDrivers.map(d => d.id) } } });
    await prisma.car.deleteMany({ where: { id: { in: testCars.map(c => c.id) } } });
    await prisma.track.delete({ where: { id: testTrack.id } });

    await syncService.close();
  });

  describe('emit events', () => {
    it('should emit cu:timer event with lap time', async () => {
      // First crossing (sets timestamp, no lap recorded)
      mockSource.emit('timer', { controller: 0, timestamp: 10000, sector: 1 });
      await new Promise(r => setTimeout(r, 50));

      mockIo.clear();

      // Second crossing (completes lap)
      mockSource.emit('timer', { controller: 0, timestamp: 35000, sector: 1 });
      await new Promise(r => setTimeout(r, 50));

      const timerEvents = mockIo.getEmitted().filter(e => e.event === 'cu:timer');
      expect(timerEvents.length).toBe(1);
      expect(timerEvents[0].data).toMatchObject({
        controller: 0,
        timestamp: 35000,
        lapTime: 25000, // 35000 - 10000
        sector: 1,
      });
    });

    it('should emit leaderboard event after lap completion', async () => {
      // First crossing
      mockSource.emit('timer', { controller: 0, timestamp: 10000, sector: 1 });
      await new Promise(r => setTimeout(r, 50));

      mockIo.clear();

      // Second crossing (completes lap)
      mockSource.emit('timer', { controller: 0, timestamp: 35000, sector: 1 });
      await new Promise(r => setTimeout(r, 50));

      const leaderboardEvents = mockIo.getEmitted().filter(e => e.event === 'leaderboard');
      expect(leaderboardEvents.length).toBe(1);

      const leaderboard = leaderboardEvents[0].data;
      expect(leaderboard).toBeInstanceOf(Array);
      expect(leaderboard.length).toBe(2);

      // Driver 0 completed a lap, should have updated stats
      const driver0 = leaderboard.find(d => d.controller === 0);
      expect(driver0).toMatchObject({
        controller: 0,
        totalLaps: 1,
        totalTime: 25000,
        bestLapTime: 25000,
        lastLapTime: 25000,
      });
    });

    it('should not emit leaderboard for first crossing (lapTime = 0)', async () => {
      mockIo.clear();

      // First crossing only
      mockSource.emit('timer', { controller: 0, timestamp: 10000, sector: 1 });
      await new Promise(r => setTimeout(r, 50));

      const leaderboardEvents = mockIo.getEmitted().filter(e => e.event === 'leaderboard');
      expect(leaderboardEvents.length).toBe(0);
    });

    it('should not emit leaderboard for non-finish sectors', async () => {
      mockIo.clear();

      // Sector 2 crossing
      mockSource.emit('timer', { controller: 0, timestamp: 10000, sector: 2 });
      await new Promise(r => setTimeout(r, 50));

      const leaderboardEvents = mockIo.getEmitted().filter(e => e.event === 'leaderboard');
      expect(leaderboardEvents.length).toBe(0);
    });
  });

  describe('database writes', () => {
    it('should create Lap record in database', async () => {
      // First crossing
      mockSource.emit('timer', { controller: 0, timestamp: 10000, sector: 1 });
      await new Promise(r => setTimeout(r, 50));

      // Second crossing
      mockSource.emit('timer', { controller: 0, timestamp: 35000, sector: 1 });
      await new Promise(r => setTimeout(r, 100));

      const laps = await prisma.lap.findMany({
        where: { sessionId: testSession.id },
      });

      expect(laps.length).toBe(1);
      expect(laps[0]).toMatchObject({
        sessionId: testSession.id,
        trackId: testTrack.id,
        driverId: testDrivers[0].id,
        carId: testCars[0].id,
        controller: 0,
        phase: 'race',
        lapNumber: 1,
        lapTime: 25000,
      });
    });

    it('should update SessionDriver in database', async () => {
      // First crossing
      mockSource.emit('timer', { controller: 0, timestamp: 10000, sector: 1 });
      await new Promise(r => setTimeout(r, 50));

      // Second crossing
      mockSource.emit('timer', { controller: 0, timestamp: 35000, sector: 1 });
      await new Promise(r => setTimeout(r, 100));

      const sessionDriver = await prisma.sessionDriver.findFirst({
        where: {
          sessionId: testSession.id,
          controller: 0,
        },
      });

      expect(sessionDriver).toMatchObject({
        totalLaps: 1,
        totalTime: 25000,
        bestLapTime: 25000,
        lastLapTime: 25000,
        position: 1,
      });
    });

    it('should update bestLapTime when faster lap is set', async () => {
      // Lap 1: 30s
      mockSource.emit('timer', { controller: 0, timestamp: 10000, sector: 1 });
      await new Promise(r => setTimeout(r, 50));
      mockSource.emit('timer', { controller: 0, timestamp: 40000, sector: 1 });
      await new Promise(r => setTimeout(r, 100));

      // Lap 2: 25s (faster)
      mockSource.emit('timer', { controller: 0, timestamp: 65000, sector: 1 });
      await new Promise(r => setTimeout(r, 100));

      const sessionDriver = await prisma.sessionDriver.findFirst({
        where: {
          sessionId: testSession.id,
          controller: 0,
        },
      });

      expect(sessionDriver.totalLaps).toBe(2);
      expect(sessionDriver.bestLapTime).toBe(25000); // Faster lap
      expect(sessionDriver.lastLapTime).toBe(25000);
      expect(sessionDriver.totalTime).toBe(55000); // 30000 + 25000
    });

    it('should keep bestLapTime when slower lap is set', async () => {
      // Lap 1: 25s
      mockSource.emit('timer', { controller: 0, timestamp: 10000, sector: 1 });
      await new Promise(r => setTimeout(r, 50));
      mockSource.emit('timer', { controller: 0, timestamp: 35000, sector: 1 });
      await new Promise(r => setTimeout(r, 100));

      // Lap 2: 30s (slower)
      mockSource.emit('timer', { controller: 0, timestamp: 65000, sector: 1 });
      await new Promise(r => setTimeout(r, 100));

      const sessionDriver = await prisma.sessionDriver.findFirst({
        where: {
          sessionId: testSession.id,
          controller: 0,
        },
      });

      expect(sessionDriver.totalLaps).toBe(2);
      expect(sessionDriver.bestLapTime).toBe(25000); // Still the first lap
      expect(sessionDriver.lastLapTime).toBe(30000); // Last lap was slower
    });
  });

  describe('leaderboard data structure', () => {
    it('should return correct leaderboard structure', async () => {
      // Complete one lap for driver 0
      mockSource.emit('timer', { controller: 0, timestamp: 10000, sector: 1 });
      await new Promise(r => setTimeout(r, 50));
      mockSource.emit('timer', { controller: 0, timestamp: 35000, sector: 1 });
      await new Promise(r => setTimeout(r, 100));

      const leaderboard = syncService.getLeaderboard();

      expect(leaderboard.length).toBe(2);

      // Check structure of each entry
      for (const entry of leaderboard) {
        expect(entry).toHaveProperty('id');
        expect(entry).toHaveProperty('controller');
        expect(entry).toHaveProperty('driverId');
        expect(entry).toHaveProperty('carId');
        expect(entry).toHaveProperty('position');
        expect(entry).toHaveProperty('totalLaps');
        expect(entry).toHaveProperty('totalTime');
        expect(entry).toHaveProperty('bestLapTime');
        expect(entry).toHaveProperty('lastLapTime');
        expect(entry).toHaveProperty('gap');
      }
    });

    it('should calculate positions correctly in race mode', async () => {
      // Driver 0: 1 lap in 25s
      mockSource.emit('timer', { controller: 0, timestamp: 10000, sector: 1 });
      await new Promise(r => setTimeout(r, 50));
      mockSource.emit('timer', { controller: 0, timestamp: 35000, sector: 1 });
      await new Promise(r => setTimeout(r, 100));

      // Driver 1: 2 laps
      mockSource.emit('timer', { controller: 1, timestamp: 10000, sector: 1 });
      await new Promise(r => setTimeout(r, 50));
      mockSource.emit('timer', { controller: 1, timestamp: 30000, sector: 1 });
      await new Promise(r => setTimeout(r, 100));
      mockSource.emit('timer', { controller: 1, timestamp: 52000, sector: 1 });
      await new Promise(r => setTimeout(r, 100));

      const leaderboard = syncService.getLeaderboard();

      // Driver 1 should be P1 (more laps)
      expect(leaderboard[0].controller).toBe(1);
      expect(leaderboard[0].position).toBe(1);
      expect(leaderboard[0].totalLaps).toBe(2);

      // Driver 0 should be P2
      expect(leaderboard[1].controller).toBe(0);
      expect(leaderboard[1].position).toBe(2);
      expect(leaderboard[1].totalLaps).toBe(1);
    });

    it('should calculate gap correctly', async () => {
      // Driver 0: 1 lap in 25s
      mockSource.emit('timer', { controller: 0, timestamp: 10000, sector: 1 });
      await new Promise(r => setTimeout(r, 50));
      mockSource.emit('timer', { controller: 0, timestamp: 35000, sector: 1 });
      await new Promise(r => setTimeout(r, 100));

      // Driver 1: 1 lap in 27s
      mockSource.emit('timer', { controller: 1, timestamp: 10000, sector: 1 });
      await new Promise(r => setTimeout(r, 50));
      mockSource.emit('timer', { controller: 1, timestamp: 37000, sector: 1 });
      await new Promise(r => setTimeout(r, 100));

      const leaderboard = syncService.getLeaderboard();

      // Same laps, so sorted by totalTime
      // Driver 0: 25s total, Driver 1: 27s total
      expect(leaderboard[0].controller).toBe(0);
      expect(leaderboard[0].gap).toBeNull(); // Leader has no gap

      expect(leaderboard[1].controller).toBe(1);
      expect(leaderboard[1].gap).toBe(2000); // 2s behind
    });

    it('should show lap gap when drivers have different lap counts', async () => {
      // Driver 1: 2 laps
      mockSource.emit('timer', { controller: 1, timestamp: 10000, sector: 1 });
      await new Promise(r => setTimeout(r, 50));
      mockSource.emit('timer', { controller: 1, timestamp: 30000, sector: 1 });
      await new Promise(r => setTimeout(r, 100));
      mockSource.emit('timer', { controller: 1, timestamp: 52000, sector: 1 });
      await new Promise(r => setTimeout(r, 100));

      // Driver 0: 1 lap
      mockSource.emit('timer', { controller: 0, timestamp: 10000, sector: 1 });
      await new Promise(r => setTimeout(r, 50));
      mockSource.emit('timer', { controller: 0, timestamp: 35000, sector: 1 });
      await new Promise(r => setTimeout(r, 100));

      const leaderboard = syncService.getLeaderboard();

      // Driver 1 is leader with 2 laps
      expect(leaderboard[0].controller).toBe(1);
      expect(leaderboard[0].gap).toBeNull();

      // Driver 0 is 1 lap behind
      expect(leaderboard[1].controller).toBe(0);
      expect(leaderboard[1].gap).toBe(1); // 1 lap behind (number = laps)
    });
  });

  describe('practice mode positioning', () => {
    beforeEach(async () => {
      // Change session type to practice
      await prisma.session.update({
        where: { id: testSession.id },
        data: { type: 'practice' },
      });
      // Reload session to update currentPhase
      await syncService.loadSession(testSession.id);
    });

    it('should sort by best lap time in practice mode', async () => {
      // Driver 0: best lap 30s
      mockSource.emit('timer', { controller: 0, timestamp: 10000, sector: 1 });
      await new Promise(r => setTimeout(r, 50));
      mockSource.emit('timer', { controller: 0, timestamp: 40000, sector: 1 }); // 30s lap
      await new Promise(r => setTimeout(r, 100));

      // Driver 1: best lap 25s (faster)
      mockSource.emit('timer', { controller: 1, timestamp: 10000, sector: 1 });
      await new Promise(r => setTimeout(r, 50));
      mockSource.emit('timer', { controller: 1, timestamp: 35000, sector: 1 }); // 25s lap
      await new Promise(r => setTimeout(r, 100));

      const leaderboard = syncService.getLeaderboard();

      // Driver 1 should be P1 (faster best lap)
      expect(leaderboard[0].controller).toBe(1);
      expect(leaderboard[0].position).toBe(1);
      expect(leaderboard[0].bestLapTime).toBe(25000);

      // Driver 0 should be P2
      expect(leaderboard[1].controller).toBe(0);
      expect(leaderboard[1].position).toBe(2);
      expect(leaderboard[1].bestLapTime).toBe(30000);
    });

    it('should calculate gap as time difference in practice mode', async () => {
      // Driver 0: best lap 30s
      mockSource.emit('timer', { controller: 0, timestamp: 10000, sector: 1 });
      await new Promise(r => setTimeout(r, 50));
      mockSource.emit('timer', { controller: 0, timestamp: 40000, sector: 1 });
      await new Promise(r => setTimeout(r, 100));

      // Driver 1: best lap 25s
      mockSource.emit('timer', { controller: 1, timestamp: 10000, sector: 1 });
      await new Promise(r => setTimeout(r, 50));
      mockSource.emit('timer', { controller: 1, timestamp: 35000, sector: 1 });
      await new Promise(r => setTimeout(r, 100));

      const leaderboard = syncService.getLeaderboard();

      // Leader has no gap
      expect(leaderboard[0].gap).toBeNull();

      // Driver 0 is 5s behind (30s - 25s)
      expect(leaderboard[1].gap).toBe(5000);
    });

    it('should ignore lap count in practice mode', async () => {
      // Driver 0: 3 laps, best 30s
      mockSource.emit('timer', { controller: 0, timestamp: 10000, sector: 1 });
      await new Promise(r => setTimeout(r, 50));
      mockSource.emit('timer', { controller: 0, timestamp: 40000, sector: 1 }); // 30s
      await new Promise(r => setTimeout(r, 50));
      mockSource.emit('timer', { controller: 0, timestamp: 72000, sector: 1 }); // 32s
      await new Promise(r => setTimeout(r, 50));
      mockSource.emit('timer', { controller: 0, timestamp: 103000, sector: 1 }); // 31s
      await new Promise(r => setTimeout(r, 100));

      // Driver 1: 1 lap, best 25s
      mockSource.emit('timer', { controller: 1, timestamp: 10000, sector: 1 });
      await new Promise(r => setTimeout(r, 50));
      mockSource.emit('timer', { controller: 1, timestamp: 35000, sector: 1 }); // 25s
      await new Promise(r => setTimeout(r, 100));

      const leaderboard = syncService.getLeaderboard();

      // Driver 1 should be P1 despite fewer laps (faster best lap)
      expect(leaderboard[0].controller).toBe(1);
      expect(leaderboard[0].totalLaps).toBe(1);
      expect(leaderboard[0].bestLapTime).toBe(25000);

      // Driver 0 should be P2 despite more laps
      expect(leaderboard[1].controller).toBe(0);
      expect(leaderboard[1].totalLaps).toBe(3);
      expect(leaderboard[1].bestLapTime).toBe(30000);
    });
  });

  describe('adaptive polling', () => {
    it('should start with default 500ms poll interval', () => {
      expect(syncService.pollInterval).toBe(500);
    });

    it('should switch to 100ms during lights sequence', () => {
      // STOPPED -> LIGHTS_1
      mockSource.emit('status', { start: 9 }); // STOPPED
      expect(syncService.pollInterval).toBe(500);

      mockSource.emit('status', { start: 1 }); // LIGHTS_1
      expect(syncService.pollInterval).toBe(100);
    });

    it('should stay at 100ms through all light stages', () => {
      mockSource.emit('status', { start: 1 }); // LIGHTS_1
      expect(syncService.pollInterval).toBe(100);

      mockSource.emit('status', { start: 2 }); // LIGHTS_2
      expect(syncService.pollInterval).toBe(100);

      mockSource.emit('status', { start: 5 }); // LIGHTS_5
      expect(syncService.pollInterval).toBe(100);

      mockSource.emit('status', { start: 6 }); // FALSE_START
      expect(syncService.pollInterval).toBe(100);

      mockSource.emit('status', { start: 7 }); // GO
      expect(syncService.pollInterval).toBe(100);
    });

    it('should switch back to 500ms when race starts', () => {
      mockSource.emit('status', { start: 1 }); // LIGHTS_1
      expect(syncService.pollInterval).toBe(100);

      mockSource.emit('status', { start: 0 }); // RACING
      expect(syncService.pollInterval).toBe(500);
    });

    it('should emit cu:status to frontend', () => {
      mockIo.clear();
      mockSource.emit('status', { start: 5, fuel: 1 });

      const statusEvents = mockIo.getEmitted().filter(e => e.event === 'cu:status');
      expect(statusEvents.length).toBe(1);
      expect(statusEvents[0].data).toEqual({ start: 5, fuel: 1 });
    });

    it('should store cuStatus', () => {
      expect(syncService.getCuStatus()).toBeNull();

      mockSource.emit('status', { start: 3, mode: 0 });
      expect(syncService.getCuStatus()).toEqual({ start: 3, mode: 0 });
    });
  });

  describe('edge cases', () => {
    it('should ignore timer events for unknown controllers', async () => {
      mockIo.clear();

      // Controller 5 is not in the session
      mockSource.emit('timer', { controller: 5, timestamp: 10000, sector: 1 });
      await new Promise(r => setTimeout(r, 50));
      mockSource.emit('timer', { controller: 5, timestamp: 35000, sector: 1 });
      await new Promise(r => setTimeout(r, 100));

      const leaderboardEvents = mockIo.getEmitted().filter(e => e.event === 'leaderboard');
      expect(leaderboardEvents.length).toBe(0);

      const laps = await prisma.lap.findMany({
        where: { sessionId: testSession.id },
      });
      expect(laps.length).toBe(0);
    });

    it('should handle multiple drivers completing laps concurrently', async () => {
      // Both drivers cross start line
      mockSource.emit('timer', { controller: 0, timestamp: 10000, sector: 1 });
      mockSource.emit('timer', { controller: 1, timestamp: 10500, sector: 1 });
      await new Promise(r => setTimeout(r, 50));

      mockIo.clear();

      // Both complete lap at similar times
      mockSource.emit('timer', { controller: 0, timestamp: 35000, sector: 1 });
      mockSource.emit('timer', { controller: 1, timestamp: 35500, sector: 1 });
      await new Promise(r => setTimeout(r, 200));

      const leaderboardEvents = mockIo.getEmitted().filter(e => e.event === 'leaderboard');
      expect(leaderboardEvents.length).toBe(2);

      const laps = await prisma.lap.findMany({
        where: { sessionId: testSession.id },
        orderBy: { controller: 'asc' },
      });

      expect(laps.length).toBe(2);
      expect(laps[0].controller).toBe(0);
      expect(laps[0].lapTime).toBe(25000);
      expect(laps[1].controller).toBe(1);
      expect(laps[1].lapTime).toBe(25000);
    });
  });
});
