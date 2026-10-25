import { test, expect } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { SessionService } from '../services/SessionService.js';
import sessionsRouter, { setSessionService } from '../routes/sessions.js';

test('measured sectors persist, reload and reach the leaderboard API without inventing missing splits', async () => {
  const service = new SessionService({ emit() {} }),
    p = service.prisma;
  try {
    const track = await p.track.create({ data: { name: 'Sector fixture track' } });
    const driver = await p.driver.create({ data: { name: 'Sector fixture driver' } });
    const car = await p.car.create({ data: { brand: 'Fixture', model: 'Sector car' } });
    const session = await p.session.create({
      data: { name: 'Sector fixture race', type: 'race', status: 'active', trackId: track.id },
    });
    await p.sessionDriver.create({
      data: { sessionId: session.id, driverId: driver.id, carId: car.id, controller: 0, totalLaps: 1, totalTime: 8000 },
    });
    Object.assign(service, { activeSessionId: session.id, activeTrackId: track.id, currentPhase: 'race' });
    const row = { driverId: driver.id, carId: car.id, controller: 0, totalLaps: 1 };
    await service.saveLap(row, 8000, { sector1: 3500, sector2: 4500, sector3: null, completed: true });
    const saved = await p.lap.findFirst({ where: { sessionId: session.id } });
    expect(saved.sector1 + saved.sector2).toBe(saved.lapTime);
    await service.loadSession(session.id);
    expect(service.sessionDrivers[0].sectors).toEqual({ sector1: 3500, sector2: 4500, sector3: null, completed: true });
    setSessionService(service);
    const app = express();
    app.use('/api/sessions', sessionsRouter);
    service.activeSessionId = null;
    const response = await request(app).get(`/api/sessions/${session.id}/leaderboard`);
    expect(response.status).toBe(200);
    expect(response.body.data[0].sectors.sector2).toBe(4500);
    service.activeSessionId = session.id;
    row.totalLaps = 2;
    await service.saveLap(row, 9000, null);
    await service.loadSession(session.id);
    expect(service.sessionDrivers[0].sectors).toBeNull();
    expect(await p.lap.count({ where: { sessionId: session.id } })).toBe(2);
  } finally {
    await service.close();
  }
});
