import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { SyncService } from '../services/SyncService.js';
import { SessionService } from '../services/SessionService.js';
import { createSectorTimingRouter } from '../routes/sectorTiming.js';
import { prisma } from './setup.js';

test('disabled SyncService preserves the original finish-only payload and lap calculation', async () => {
  const sync = new SyncService({ emit() {} });
  const laps = [];
  sync.setSessionService({ isActive: () => true, handleLap: (value) => laps.push(value) });
  for (const value of [
    { controller: 0, timestamp: 1000, sector: 1 },
    { controller: 0, timestamp: 4000, sector: 2 },
    { controller: 0, timestamp: 9000, sector: 1 },
  ])
    await sync.handleTimerEvent(value);
  expect(sync.sectorTimingEnabled).toBe(false);
  expect(laps).toEqual([
    { controller: 0, timestamp: 1000, lapTime: 0, sector: 1 },
    { controller: 0, timestamp: 9000, lapTime: 8000, sector: 1 },
  ]);
  sync.close();
});
test('disabled SessionService saves the same lap fields even if a caller supplies sectors', async () => {
  const service = new SessionService({ emit() {} });
  const real = service.prisma;
  const create = jest.fn();
  service.prisma = { lap: { create } };
  service.activeSessionId = 'fixture';
  service.activeTrackId = 'track';
  try {
    await service.saveLap({ driverId: 'driver', carId: 'car', controller: 0, totalLaps: 1 }, 8000, {
      sector1: 3000,
      sector2: 5000,
      completed: true,
    });
    expect(create.mock.calls[0][0].data).not.toHaveProperty('sector1');
    expect(create.mock.calls[0][0].data).not.toHaveProperty('sector2');
  } finally {
    await real.$disconnect();
  }
});
test('option defaults off, persists explicit activation, and refuses changes during a session', async () => {
  await prisma.preference.deleteMany({ where: { key: 'sectorTiming:enabled' } });
  const sync = { setSectorTimingEnabled: jest.fn() };
  const session = { setSectorTimingEnabled: jest.fn(), isActive: jest.fn(() => false) };
  const app = express();
  app.use(express.json());
  app.use('/option', await createSectorTimingRouter({ prisma, syncService: sync, sessionService: session }));
  expect((await request(app).get('/option')).body.data.enabled).toBe(false);
  await request(app).put('/option').send({ enabled: 'true' }).expect(400);
  await request(app).put('/option').send({ enabled: true }).expect(200);
  expect(sync.setSectorTimingEnabled).toHaveBeenLastCalledWith(true);
  expect(JSON.parse((await prisma.preference.findUnique({ where: { key: 'sectorTiming:enabled' } })).value)).toBe(true);
  session.isActive.mockReturnValue(true);
  await request(app).put('/option').send({ enabled: false }).expect(409);
  expect((await request(app).get('/option')).body.data.enabled).toBe(true);
  await prisma.preference.deleteMany({ where: { key: 'sectorTiming:enabled' } });
});
