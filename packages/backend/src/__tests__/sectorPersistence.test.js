import { test } from '@jest/globals';
import assert from 'node:assert/strict';
import { SessionService } from '../services/SessionService.js';
test('completed sectors reach the database write; missing splits remain null', async () => {
  const service = new SessionService({ emit() {} }),
    writes = [];
  const client = service.prisma;
  service.prisma = { lap: { create: async (query) => writes.push(query.data) } };
  service.activeSessionId = 'test-only';
  service.activeTrackId = 'test-track';
  service.currentPhase = 'race';
  const driver = { driverId: 'test-driver', carId: 'test-car', controller: 0, totalLaps: 1 };
  await service.saveLap(driver, 8000, { sector1: 3500, sector2: 4500, sector3: null, completed: true });
  assert.equal(writes[0].sector1 + writes[0].sector2, writes[0].lapTime);
  await service.saveLap(driver, 9000, null);
  assert.equal(writes[1].sector1, null);
  assert.equal(writes[1].sector2, null);
  await client.$disconnect();
});
