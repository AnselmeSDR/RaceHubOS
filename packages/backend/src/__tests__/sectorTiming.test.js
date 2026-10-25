import { test } from '@jest/globals';
import assert from 'node:assert/strict';
import { SectorTiming } from '../lib/sectorTiming.js';
import { SyncService } from '../services/SyncService.js';
const event = (timestamp, sector, controller = 0) => ({ timestamp, sector, controller });
test('one checkpoint: two sections sum exactly to full lap; cars stay independent', () => {
  const s = new SectorTiming();
  assert.equal(s.push(event(500, 2)), null);
  assert.equal(s.push(event(1000, 1)), null);
  assert.equal(s.push(event(2000, 1, 1)), null);
  assert.equal(s.push(event(4500, 2)).sector1, 3500);
  const result = s.push(event(9000, 1));
  assert.deepEqual(result, { sector1: 3500, sector2: 4500, sector3: null, completed: true });
  assert.equal(s.push(event(10000, 1, 1)), null);
});
test('two checkpoints produce three durations; missing/duplicate/reordered points never invent sectors', () => {
  const s = new SectorTiming();
  s.push(event(1000, 1));
  s.push(event(3000, 2));
  s.push(event(6000, 3));
  assert.deepEqual(s.push(event(10000, 1)), { sector1: 2000, sector2: 3000, sector3: 4000, completed: true });
  assert.equal(s.push(event(20000, 1)), null);
  s.push(event(23000, 2));
  s.push(event(23001, 2));
  assert.equal(s.push(event(30000, 1)), null);
  s.push(event(35000, 3));
  assert.equal(s.push(event(40000, 1)), null);
  s.push(event(45000, 2));
  s.reset();
  assert.equal(s.push(event(50000, 1)), null);
});
test('SyncService forwards measured sectors only in the same active session; clock resets recover', async () => {
  const sync = new SyncService({ emit() {} }),
    laps = [],
    sectors = [];
  const session = {
    activeSessionId: 'a',
    currentPhase: 'race',
    sessionStatus: 'active',
    isActive: () => session.sessionStatus === 'active',
    handleLap: (d) => laps.push(d),
    handleSector: (c, s) => sectors.push(s),
  };
  sync.setSessionService(session);
  for (const e of [event(1000, 1), event(4000, 2), event(10000, 1)]) await sync.handleTimerEvent(e);
  assert.equal(laps.at(-1).sectors.sector2, 6000);
  assert.equal(sectors.length, 1);
  session.sessionStatus = 'paused';
  sync.resetSectorTiming();
  await sync.handleTimerEvent(event(14000, 2));
  session.sessionStatus = 'active';
  await sync.handleTimerEvent(event(20000, 1));
  assert.equal(laps.at(-1).sectors, null);
  await sync.handleTimerEvent(event(100, 1));
  assert.equal(laps.at(-1).lapTime, 0);
  await sync.handleTimerEvent(event(2100, 2));
  await sync.handleTimerEvent(event(6100, 1));
  assert.equal(laps.at(-1).lapTime, 6000);
  assert.equal(laps.at(-1).sectors.sector1, 2000);
  sync.close();
});

test('finishing transition retains another driver’s sections; paused clocks cannot add laps', async () => {
  const sync = new SyncService({ emit() {} }),
    laps = [];
  const session = {
    activeSessionId: 'a',
    currentPhase: 'race',
    sessionStatus: 'active',
    isActive: () => true,
    handleLap: (d) => laps.push(d),
  };
  sync.setSessionService(session);
  await sync.handleTimerEvent(event(1000, 1));
  await sync.handleTimerEvent(event(4000, 2));
  session.sessionStatus = 'finishing';
  await sync.handleTimerEvent(event(9000, 1));
  assert.equal(laps.at(-1).sectors.sector2, 5000);
  const count = laps.length;
  session.sessionStatus = 'paused';
  sync.resetSectorTiming();
  await sync.handleTimerEvent(event(10000, 1));
  assert.equal(laps.length, count);
  session.sessionStatus = 'active';
  await sync.handleTimerEvent(event(18000, 1));
  assert.equal(laps.at(-1).sectors, null);
  sync.close();
});
test('pause/resume, session changes, malformed events and global CU clock resets cannot bridge lap baselines', async () => {
  const sync = new SyncService({ emit() {} }),
    laps = [];
  const session = {
    activeSessionId: 'one',
    currentPhase: 'race',
    sessionStatus: 'active',
    isActive: () => true,
    handleLap: (d) => laps.push(d),
  };
  sync.setSessionService(session);
  for (const e of [event(1000, 1), event(3000, 2), event(8000, 1)]) await sync.handleTimerEvent(e);
  assert.equal(laps.at(-1).lapTime, 7000);
  session.sessionStatus = 'paused';
  await sync.handleTimerEvent(event(12000, 1));
  session.sessionStatus = 'active';
  await sync.handleTimerEvent(event(16000, 1));
  assert.equal(laps.at(-1).lapTime, 0);
  assert.equal(laps.at(-1).sectors, null);
  session.activeSessionId = 'two';
  await sync.handleTimerEvent(event(22000, 1));
  assert.equal(laps.at(-1).lapTime, 0);
  await sync.handleTimerEvent(event(23000, 1, 1));
  await sync.handleTimerEvent(event(100, 1));
  await sync.handleTimerEvent(event(200, 1, 1));
  assert.equal(laps.at(-1).lapTime, 0);
  const count = laps.length;
  for (const e of [event(Infinity, 1), event(NaN, 1), event(-1, 1), event(500, 1, 7), event(500, 4)])
    await sync.handleTimerEvent(e);
  assert.equal(laps.length, count);
  sync.close();
});
