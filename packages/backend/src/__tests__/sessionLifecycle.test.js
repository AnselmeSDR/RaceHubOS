import { jest } from '@jest/globals';
import { SessionStatus, SessionType } from '@racehubos/shared';
import { prisma } from './setup.js';
import { wipe } from './helpers/entityFixtures.js';
import { SessionService } from '../services/SessionService.js';

/**
 * The session service from load to finish, on the test database, with a fake device link:
 * what is stored, what is told to the clients, what is asked of the Control Unit.
 */

let service, io, sync, device, track, ana, ben, cid, gt, p911;

/** What the clients were sent under `name`. */
const sent = (name) => io.emit.mock.calls.filter(([event]) => event === name).map(([, data]) => data);
const statusChanges = () =>
  sent('session:status_changed').map(({ status, previousStatus }) => [previousStatus, status]);

/** Runs the pending immediate callbacks, and the promises they start. */
const settle = async () => {
  for (let i = 0; i < 20; i++) await new Promise((resolve) => setImmediate(resolve));
};

beforeEach(async () => {
  await wipe(prisma);
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  io = { emit: jest.fn() };
  device = { setSpeed: jest.fn(async () => {}), setBrake: jest.fn(async () => {}), setFuel: jest.fn(async () => {}) };
  sync = {
    connected: true,
    isConnected: jest.fn(() => sync.connected),
    getDevice: jest.fn(() => device),
    reset: jest.fn(async () => {}),
    startPolling: jest.fn(),
    stopPolling: jest.fn(),
    prepareRace: jest.fn(async () => {}),
    startRace: jest.fn(async () => {}),
    stopRace: jest.fn(async () => {}),
  };
  service = new SessionService(io);
  service.setSyncService(sync);

  track = await prisma.track.create({ data: { name: 'Ring' } });
  ana = await prisma.driver.create({ data: { name: 'Ana' } });
  ben = await prisma.driver.create({ data: { name: 'Ben' } });
  cid = await prisma.driver.create({ data: { name: 'Cid' } });
  gt = await prisma.car.create({
    data: { brand: 'Ford', model: 'GT', maxSpeed: 64, brakeForce: 20, fuelCapacity: 100 },
  });
  p911 = await prisma.car.create({ data: { brand: 'Porsche', model: '911', maxSpeed: 100, brakeForce: 3 } });
});
afterEach(async () => {
  jest.useRealTimers();
  await service.close();
  jest.restoreAllMocks();
});

/** A session on Ring with Ana (controller 0, GT) and Ben (controller 1, 911). */
async function newSession(data = {}, entries = [{}, {}]) {
  const session = await prisma.session.create({
    data: { type: SessionType.RACE, status: SessionStatus.DRAFT, trackId: track.id, ...data },
  });
  const people = [
    [ana, gt],
    [ben, p911],
  ];
  for (const [i, extra] of entries.entries()) {
    const [driver, car] = people[i];
    await prisma.sessionDriver.create({
      data: { sessionId: session.id, driverId: driver.id, carId: car.id, controller: i, ...extra },
    });
  }
  return session;
}

const lap = (controller, lapTime) => service.handleLap({ controller, lapTime, sector: 1, timestamp: 0 });
const entriesOf = (sessionId) =>
  prisma.sessionDriver.findMany({ where: { sessionId }, orderBy: { controller: 'asc' } });
const sessionRow = (id) => prisma.session.findUnique({ where: { id } });

describe('loading a session', () => {
  test('its drivers by controller, its settings and an empty leaderboard', async () => {
    const session = await newSession({ maxLaps: 5, pauses: JSON.stringify([{ start: 1, end: 2 }]) }, [
      { totalLaps: 2, totalTime: 20000, bestLapTime: 9000, lastLapTime: 11000, position: 1 },
      {},
    ]);
    const loaded = await service.loadSession(session.id);

    expect(loaded.id).toBe(session.id);
    expect(service).toMatchObject({ activeSessionId: session.id, activeTrackId: track.id, currentPhase: 'race' });
    expect(service.sessionConfig).toEqual({
      maxDuration: null,
      maxLaps: 5,
      gracePeriod: 30000,
      startedAt: null,
      championshipId: null,
      pauses: [{ start: 1, end: 2 }],
    });
    expect(
      service.sessionDrivers.map((d) => [d.controller, d.driver.name, d.totalLaps, d.crossings, d.position])
    ).toEqual([
      [0, 'Ana', 2, 2, 1],
      [1, 'Ben', 0, 0, 2],
    ]);
    expect(
      sent('session:leaderboard')
        .at(-1)
        .map((d) => d.controller)
    ).toEqual([0, 1]);
  });

  test('an unknown session fails; an unknown type is run as a race', async () => {
    await expect(service.loadSession('nope')).rejects.toThrow('Session nope not found');
    const session = await newSession({ type: 'endurance' });
    await service.loadSession(session.id);
    expect(service.currentPhase).toBe(SessionType.RACE);
  });

  test('a balancing session gets back the history of its laps, deleted ones left out', async () => {
    const session = await newSession({ type: SessionType.BALANCING });
    const stored = (controller, lapNumber, lapTime, data = {}) =>
      prisma.lap.create({
        data: {
          sessionId: session.id,
          trackId: track.id,
          carId: gt.id,
          controller,
          phase: 'balancing',
          lapNumber,
          lapTime,
          ...data,
        },
      });
    await stored(0, 2, 9100.4);
    await stored(0, 1, 9500);
    await stored(1, 1, 9900, { deletedAt: new Date() });
    await service.loadSession(session.id);

    expect(service.getLeaderboard().map((d) => [d.controller, d.laps])).toEqual([
      [
        0,
        [
          { lapNumber: 1, lapTime: 9500 },
          { lapNumber: 2, lapTime: 9100 },
        ],
      ],
      [1, []],
    ]);
  });

  test('a session caught finishing finishes once its grace period is over', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
    const session = await newSession({
      status: SessionStatus.FINISHING,
      finishingAt: new Date(Date.now() - 20000),
      gracePeriod: 25000,
    });
    await service.loadSession(session.id);
    expect(service.gracePeriodEndsAt).toBe(Date.now() + 5000);

    await jest.advanceTimersByTimeAsync(5000);
    await settle();
    expect((await sessionRow(session.id)).status).toBe(SessionStatus.FINISHED);
    expect(sent('session:finished')[0]).toMatchObject({ sessionId: session.id, reason: 'grace_period_elapsed' });
  });

  test('a session whose grace period is already over finishes at once', async () => {
    const session = await newSession({ status: SessionStatus.FINISHING, finishingAt: new Date(Date.now() - 60000) });
    await service.loadSession(session.id);
    await settle();
    expect((await sessionRow(session.id)).status).toBe(SessionStatus.FINISHED);
  });
});

describe('starting, pausing and resuming', () => {
  test('starting needs a connected device', async () => {
    const session = await newSession();
    sync.connected = false;
    await expect(service.startSession(session.id)).rejects.toThrow(
      'No device connected. Connect a CU or Simulator first.'
    );
    expect((await sessionRow(session.id)).status).toBe(SessionStatus.DRAFT);
  });

  test('starting resets the link, polls, lights the CU and sends each car its settings', async () => {
    const session = await newSession();
    const state = await service.startSession(session.id);

    expect((await sessionRow(session.id)).status).toBe(SessionStatus.ACTIVE);
    expect(state).toMatchObject({ activeSessionId: session.id, sessionStatus: 'active', currentPhase: 'race' });
    expect(sync.reset).toHaveBeenCalled();
    expect(sync.startPolling).toHaveBeenCalled();
    expect(sync.prepareRace).toHaveBeenCalled();
    // Levels 1-10 from the car's 0-100 values; free slots get the factory settings
    expect(device.setSpeed.mock.calls).toEqual([
      [0, 6],
      [1, 10],
      [2, 10],
      [3, 10],
      [4, 10],
      [5, 10],
    ]);
    expect(device.setBrake.mock.calls.slice(0, 2)).toEqual([
      [0, 2],
      [1, 1],
    ]);
    expect(device.setFuel.mock.calls.slice(0, 3)).toEqual([
      [0, 10],
      [1, 10],
      [2, 7],
    ]);
    expect(sent('session:started')).toEqual([{ sessionId: session.id }]);
    expect(statusChanges()).toEqual([['draft', 'active']]);
    expect(service.heartbeatInterval).not.toBeNull();
  });

  test('a device that fails one car setting still gets the others', async () => {
    const session = await newSession();
    device.setSpeed.mockRejectedValueOnce(new Error('busy'));
    delete device.setBrake;
    delete device.setFuel;
    await service.startSession(session.id);
    expect(device.setSpeed).toHaveBeenCalledTimes(6);
    expect(console.warn).toHaveBeenCalledWith('[SessionService] applyCarConfigs failed for addr', 0, ':', 'busy');
  });

  test('a device without car settings is left alone', async () => {
    const session = await newSession();
    device = {};
    await service.startSession(session.id);
    expect((await sessionRow(session.id)).status).toBe(SessionStatus.ACTIVE);
  });

  test('a pause is stored with its start, stops the race; a resume lights the CU again', async () => {
    const session = await newSession();
    expect(await service.pauseSession()).toBeNull();
    expect(await service.resumeSession()).toBeNull();
    await service.startSession(session.id);

    expect(await service.pauseSession()).toEqual({ sessionId: session.id });
    let row = await sessionRow(session.id);
    expect(row.status).toBe(SessionStatus.PAUSED);
    expect(JSON.parse(row.pauses)).toEqual([{ start: expect.any(Number), end: null }]);
    expect(sync.stopRace).toHaveBeenCalledTimes(1);
    expect(sent('session:paused')).toEqual([{ sessionId: session.id }]);

    sync.prepareRace.mockClear();
    expect(await service.resumeSession()).toEqual({ sessionId: session.id });
    row = await sessionRow(session.id);
    expect(row.status).toBe(SessionStatus.ACTIVE);
    expect(sync.prepareRace).toHaveBeenCalledTimes(1);
    expect(sent('session:resumed')).toEqual([{ sessionId: session.id }]);
    expect(statusChanges()).toEqual([
      ['draft', 'active'],
      ['active', 'paused'],
      ['paused', 'active'],
    ]);
    // Only an active session resumes
    expect(await service.resumeSession()).toBeNull();
  });

  test('GO! starts the clock once; after a pause, it closes the pause instead', async () => {
    const session = await newSession();
    await service.onRaceStart();
    expect(sent('session:race_started')).toEqual([]);

    await service.startSession(session.id);
    await service.onRaceStart();
    const { startedAt } = await sessionRow(session.id);
    expect(startedAt).not.toBeNull();
    expect(sent('session:race_started')).toEqual([{ sessionId: session.id, startedAt: startedAt.toISOString() }]);

    // Already started, no pause open: nothing changes
    await service.onRaceStart();
    expect(sent('session:race_started')).toHaveLength(1);

    await service.pauseSession();
    await service.resumeSession();
    await service.onRaceStart();
    const [pause] = JSON.parse((await sessionRow(session.id)).pauses);
    expect(pause.end).toBeGreaterThanOrEqual(pause.start);
    expect(sent('session:race_resumed')).toEqual([{ sessionId: session.id, resumedAt: expect.any(String) }]);
    expect((await sessionRow(session.id)).startedAt).toEqual(startedAt);
  });

  test('start, stop and the connection go through the device link', async () => {
    await service.startRace();
    await service.stopRace();
    expect(sync.startRace).toHaveBeenCalled();
    expect(sync.stopRace).toHaveBeenCalled();
    expect(service.isConnected()).toBe(true);
    service.syncService = null;
    expect(service.isConnected()).toBe(false);
  });
});

describe('laps', () => {
  test('a lap is stored, counted, ranked and told to the clients', async () => {
    const session = await newSession();
    await service.startSession(session.id);
    await lap(1, 9000.6);
    await lap(0, 9500);
    await lap(0, 8800);

    const laps = await prisma.lap.findMany({ where: { sessionId: session.id }, orderBy: { lapNumber: 'asc' } });
    expect(laps.map((l) => [l.controller, l.lapNumber, l.lapTime, l.phase, l.trackId])).toEqual([
      [1, 1, 9000.6, 'race', track.id],
      [0, 1, 9500, 'race', track.id],
      [0, 2, 8800, 'race', track.id],
    ]);
    // A stored position only moves with its own driver's lap: Ben's stays first until he laps again
    expect((await entriesOf(session.id)).map((e) => [e.totalLaps, e.totalTime, e.bestLapTime, e.position])).toEqual([
      [2, 18300, 8800, 1],
      [1, 9001, 9001, 1],
    ]);
    // A best lap of the session each time it improves
    expect(sent('session:bestlap').map((b) => [b.driverName, b.lapTime])).toEqual([
      ['Ben', 9001],
      ['Ana', 8800],
    ]);
    const board = sent('session:leaderboard').at(-1);
    expect(board.map((d) => [d.controller, d.position, d.gap])).toEqual([
      [0, 1, null],
      [1, 2, 1],
    ]);
  });

  test('only a finish-line crossing with a time, for a known controller, of a running session', async () => {
    const session = await newSession();
    await lap(0, 9000);
    await service.startSession(session.id);
    await service.handleLap({ controller: 0, lapTime: 9000, sector: 2 });
    await lap(0, 0);
    await lap(5, 9000);
    expect(await prisma.lap.count()).toBe(0);
  });

  test('in qualifying the best lap ranks, and the gap is to the best lap', async () => {
    const session = await newSession({ type: SessionType.QUALIF });
    await service.startSession(session.id);
    await lap(0, 9500);
    let board = sent('session:leaderboard').at(-1);
    expect(board.map((d) => [d.controller, d.gap])).toEqual([
      [0, null],
      [1, null],
    ]);
    await lap(1, 9100);
    board = sent('session:leaderboard').at(-1);
    expect(board.map((d) => [d.controller, d.gap, d.positionDelta])).toEqual([
      [1, null, 1],
      [0, 400, -1],
    ]);
    // Ana laps without changing place: her arrow goes, Ben's stays
    await lap(0, 9300);
    board = sent('session:leaderboard').at(-1);
    expect(board.map((d) => [d.controller, d.gap, d.positionDelta])).toEqual([
      [1, null, 1],
      [0, 200, 0],
    ]);
  });

  test('in a race, a driver laps down shows the laps, else the time', async () => {
    const session = await newSession();
    await service.startSession(session.id);
    await lap(0, 9000);
    await lap(0, 9000);
    await lap(1, 9500);
    expect(
      sent('session:leaderboard')
        .at(-1)
        .map((d) => d.gap)
    ).toEqual([null, 1]);
    await lap(1, 9500);
    expect(
      sent('session:leaderboard')
        .at(-1)
        .map((d) => d.gap)
    ).toEqual([null, 1000]);
  });

  test('balancing keeps each lap for the chart, up to its lap count, then finishes', async () => {
    const session = await newSession({ type: SessionType.BALANCING, maxLaps: 2 });
    await service.startSession(session.id);
    await lap(1, 9900);
    await lap(0, 9000);
    await lap(0, 9100);
    // Ana is done: her next crossing is not a lap
    await lap(0, 8000);
    expect(service.getLeaderboard().map((d) => [d.controller, d.laps])).toEqual([
      [
        0,
        [
          { lapNumber: 1, lapTime: 9000 },
          { lapNumber: 2, lapTime: 9100 },
        ],
      ],
      [1, [{ lapNumber: 1, lapTime: 9900 }]],
    ]);
    expect((await sessionRow(session.id)).status).toBe(SessionStatus.ACTIVE);

    // Everyone who ran has done the count: finished, with no grace period
    await lap(1, 9800);
    expect((await sessionRow(session.id)).status).toBe(SessionStatus.FINISHED);
    const [finished] = sent('session:finished');
    expect(finished).toMatchObject({ reason: 'all_finished', sessionType: 'balancing' });
    expect(finished.leaderboard.find((d) => d.controller === 1).laps).toHaveLength(2);
    expect(sent('session:finishing')).toEqual([]);
  });
});

describe('the end of a race', () => {
  test('the leader reaching the lap count waves the flag; the others finish their lap', async () => {
    const session = await newSession({ maxLaps: 2, gracePeriod: 10000 });
    await service.startSession(session.id);
    await lap(0, 9000);
    await lap(1, 9500);
    await lap(0, 9000);

    let row = await sessionRow(session.id);
    expect(row.status).toBe(SessionStatus.FINISHING);
    expect(row.finishingAt).not.toBeNull();
    expect((await entriesOf(session.id)).map((e) => e.lapsAtFinishing)).toEqual([2, 1]);
    expect(sent('session:finishing')[0]).toMatchObject({ reason: 'leader_finished', gracePeriodMs: 10000 });
    // The leader is slowed down at once
    expect(device.setSpeed).toHaveBeenLastCalledWith(0, 1);

    await lap(1, 9500);
    row = await sessionRow(session.id);
    expect(row.status).toBe(SessionStatus.FINISHED);
    expect((await entriesOf(session.id)).map((e) => [e.finalPos, e.totalLaps, e.isDNF])).toEqual([
      [1, 2, false],
      [2, 2, false],
    ]);
    expect(sent('session:finished')[0]).toMatchObject({ sessionId: session.id, reason: 'all_finished' });
    expect(statusChanges().slice(-2)).toEqual([
      ['active', 'finishing'],
      ['finishing', 'finished'],
    ]);
    expect(service.activeSessionId).toBeNull();
  });

  test('the grace period ends the race; who has not crossed the line is DNF', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
    const session = await newSession({ maxLaps: 2, gracePeriod: 10000 });
    const championship = await prisma.championship.create({ data: { name: 'Cup', season: '2026' } });
    await prisma.session.update({ where: { id: session.id }, data: { championshipId: championship.id } });
    const finished = [];
    service.on('sessionFinished', (event) => finished.push(event));
    await service.startSession(session.id);
    await lap(0, 9000);
    await lap(1, 9500);
    await lap(0, 9000);

    await jest.advanceTimersByTimeAsync(10000);
    await settle();
    expect((await sessionRow(session.id)).status).toBe(SessionStatus.FINISHED);
    expect((await entriesOf(session.id)).map((e) => [e.finalPos, e.isDNF])).toEqual([
      [1, false],
      [2, true],
    ]);
    expect(sent('session:finished')[0]).toMatchObject({
      reason: 'grace_period_elapsed',
      championshipId: championship.id,
    });
    expect(finished).toEqual([{ sessionId: session.id, championshipId: championship.id }]);
    expect(sync.stopRace).toHaveBeenCalled();
  });

  test('a car that cannot be slowed down is only reported', async () => {
    const session = await newSession({ maxLaps: 1 });
    await service.startSession(session.id);
    device.setSpeed.mockRejectedValueOnce(new Error('busy'));
    await lap(0, 9000);
    expect(console.warn).toHaveBeenCalledWith('[SessionService] throttle failed:', 'busy');
    expect(service.getDriverByController(0)._throttled).toBe(false);
  });

  test('finishing twice does nothing more', async () => {
    const session = await newSession();
    await service.startSession(session.id);
    await Promise.all([service.finishSession('manual_stop'), service.finishSession('manual_stop')]);
    expect(sent('session:finished')).toHaveLength(1);
  });

  test('stopping by hand finishes the session', async () => {
    expect(await service.stopSession()).toBeNull();
    const session = await newSession();
    await service.startSession(session.id);
    expect(await service.stopSession()).toEqual({ sessionId: session.id });
    expect(sent('session:finished')[0]).toMatchObject({ reason: 'manual_stop' });
  });
});

describe('the heartbeat', () => {
  beforeEach(() => jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] }));

  test('each second: the racing time without the pauses, what is left, the leaderboard', async () => {
    const session = await newSession({ maxDuration: 60000, maxLaps: 10 });
    await service.startSession(session.id);
    await service.onRaceStart();
    await lap(0, 9000);
    service.sessionConfig.pauses = [
      { start: Date.now() - 4000, end: Date.now() - 3000 },
      { start: Date.now() - 500, end: null },
    ];

    await jest.advanceTimersByTimeAsync(1000);
    const beat = sent('session:heartbeat').at(-1);
    expect(beat).toMatchObject({
      sessionId: session.id,
      status: 'active',
      elapsedTime: 1000 - 1000 - 1500,
      remainingTime: 60000 - (1000 - 1000 - 1500),
      remainingLaps: 9,
      gracePeriodRemaining: null,
      pauseDuration: 1500,
      totalPauseDuration: 2500,
    });
    expect(beat.leaderboard).toHaveLength(2);
  });

  test('before GO! no time has run', async () => {
    const session = await newSession();
    await service.startSession(session.id);
    await jest.advanceTimersByTimeAsync(1000);
    expect(sent('session:heartbeat').at(-1)).toMatchObject({
      elapsedTime: 0,
      remainingTime: null,
      remainingLaps: null,
    });
  });

  test('time up in a race waves the flag, and the grace period counts down', async () => {
    const session = await newSession({ maxDuration: 3000, gracePeriod: 10000 });
    await service.startSession(session.id);
    await service.onRaceStart();
    await lap(0, 9000);

    await jest.advanceTimersByTimeAsync(3000);
    expect((await sessionRow(session.id)).status).toBe(SessionStatus.FINISHING);
    expect(sent('session:finishing')[0]).toMatchObject({ reason: 'time_elapsed' });

    await jest.advanceTimersByTimeAsync(1000);
    expect(sent('session:heartbeat').at(-1)).toMatchObject({ status: 'finishing', gracePeriodRemaining: 9000 });

    // Ana finishes the lap she was on: everyone who raced is home
    await lap(0, 9000);
    await jest.advanceTimersByTimeAsync(1000);
    expect((await sessionRow(session.id)).status).toBe(SessionStatus.FINISHED);
    expect((await entriesOf(session.id)).map((e) => [e.totalLaps, e.isDNF])).toEqual([
      [2, false],
      [0, false],
    ]);
  });

  test('time up in balancing finishes at once', async () => {
    const session = await newSession({ type: SessionType.BALANCING, maxDuration: 2000 });
    await service.startSession(session.id);
    await service.onRaceStart();
    await jest.advanceTimersByTimeAsync(2000);
    expect((await sessionRow(session.id)).status).toBe(SessionStatus.FINISHED);
    expect(sent('session:finished')[0]).toMatchObject({ reason: 'time_elapsed' });
  });

  test('a flag with nobody having raced finishes at once', async () => {
    const session = await newSession({ maxDuration: 1000 });
    await service.startSession(session.id);
    await service.onRaceStart();
    await jest.advanceTimersByTimeAsync(2000);
    expect((await sessionRow(session.id)).status).toBe(SessionStatus.FINISHED);
  });

  test('it stops by itself once no session runs', async () => {
    const session = await newSession();
    await service.startSession(session.id);
    service.sessionStatus = SessionStatus.FINISHED;
    await jest.advanceTimersByTimeAsync(1000);
    expect(service.heartbeatInterval).toBeNull();
    expect(sent('session:heartbeat')).toEqual([]);
  });
});

describe('creating a session', () => {
  async function controllers() {
    await prisma.controllerConfig.createMany({
      data: [
        { trackId: track.id, controller: 0, driverId: ana.id, carId: gt.id },
        { trackId: track.id, controller: 1, driverId: ben.id, carId: p911.id },
        { trackId: track.id, controller: 2, driverId: cid.id },
        { trackId: track.id, controller: 3, driverId: cid.id, carId: gt.id },
      ],
    });
  }

  test('a draft named after its type, with the drivers set on the track controllers', async () => {
    await controllers();
    const session = await service.createSession({ type: SessionType.QUALIF, trackId: track.id, maxLaps: 5 });
    expect(session).toMatchObject({ name: 'Qualifying', status: 'draft', trackId: track.id, maxLaps: 5, order: 0 });
    expect(session.track.name).toBe('Ring');
    expect(session.drivers.map((d) => [d.controller, d.driver.name, d.car.model, d.gridPos])).toEqual([
      [0, 'Ana', 'GT', null],
      [1, 'Ben', '911', null],
      [3, 'Cid', 'GT', null],
    ]);
  });

  test('a race takes its grid from the last finished qualifying when asked', async () => {
    await controllers();
    const qualif = await prisma.session.create({
      data: { type: SessionType.QUALIF, status: SessionStatus.FINISHED, trackId: track.id, finishedAt: new Date() },
    });
    await prisma.sessionDriver.createMany({
      data: [
        { sessionId: qualif.id, driverId: ben.id, controller: 0, finalPos: 1 },
        { sessionId: qualif.id, driverId: ana.id, controller: 1, finalPos: 2 },
      ],
    });
    const race = await service.createSession({
      type: SessionType.RACE,
      trackId: track.id,
      name: 'Final',
      gridFromQualifying: true,
      status: 'ready',
      order: 3,
    });
    expect(race).toMatchObject({ name: 'Final', status: 'ready', order: 3 });
    // Cid did not qualify: at the back of the grid
    expect(race.drivers.map((d) => [d.driver.name, d.gridPos])).toEqual([
      ['Ben', 1],
      ['Ana', 2],
      ['Cid', 4],
    ]);

    const plain = await service.createSession({ type: SessionType.RACE, trackId: track.id });
    expect(plain.drivers.map((d) => [d.driver.name, d.gridPos])).toEqual([
      ['Ana', 1],
      ['Ben', 2],
      ['Cid', 4],
    ]);
  });

  test("a championship's session runs on its track; unnamed, it takes the interface's name for its type", async () => {
    const cup = await prisma.championship.create({ data: { name: 'Cup', season: '2026', trackId: track.id } });
    const sessionNames = { [SessionType.PRACTICE]: 'Essais Libres' };
    const session = await service.createSession({ type: SessionType.PRACTICE, championshipId: cup.id, sessionNames });
    expect(session).toMatchObject({ name: 'Essais Libres', trackId: track.id, championshipId: cup.id });
  });

  test('refused for an unknown type, or without a track', async () => {
    await expect(service.createSession({ type: 'endurance', trackId: track.id })).rejects.toThrow(
      'Invalid session type. Must be one of: practice, qualif, race, balancing'
    );
    await expect(service.createSession({ type: SessionType.RACE })).rejects.toThrow(
      'trackId or championshipId required'
    );
    const cup = await prisma.championship.create({ data: { name: 'Cup', season: '2026' } });
    await expect(service.createSession({ type: SessionType.RACE, championshipId: cup.id })).rejects.toThrow(
      'Championship has no track assigned'
    );
    await expect(service.createSession({ type: SessionType.RACE, championshipId: 'nope' })).rejects.toThrow(
      'Championship has no track assigned'
    );
  });
});

describe('resetting and deleting a session', () => {
  async function raced(data = {}) {
    const session = await newSession(
      { status: SessionStatus.FINISHED, startedAt: new Date(), finishedAt: new Date(), pauses: '[]', ...data },
      [{ totalLaps: 3, totalTime: 27000, bestLapTime: 8900, position: 1, finalPos: 1, isDNF: true, lapsAtFinishing: 2 }]
    );
    await prisma.lap.create({
      data: {
        sessionId: session.id,
        trackId: track.id,
        carId: gt.id,
        controller: 0,
        phase: 'race',
        lapNumber: 1,
        lapTime: 9000,
      },
    });
    await prisma.trackRecord.create({
      data: { trackId: track.id, driverId: ana.id, carId: gt.id, lapTime: 9000, sessionId: session.id },
    });
    return session;
  }

  test('a reset hides the laps, zeroes the entries and goes back to draft', async () => {
    const session = await raced();
    const resets = [];
    service.on('sessionReset', (event) => resets.push(event));
    await service.resetSession(session.id);

    expect(await prisma.lap.count({ where: { deletedAt: null } })).toBe(0);
    expect(await prisma.lap.count()).toBe(1);
    const [entry] = await entriesOf(session.id);
    expect(entry).toMatchObject({
      position: null,
      finalPos: null,
      totalLaps: 0,
      totalTime: 0,
      bestLapTime: null,
      isDNF: false,
      lapsAtFinishing: null,
    });
    expect(await sessionRow(session.id)).toMatchObject({
      status: 'draft',
      startedAt: null,
      finishedAt: null,
      pauses: null,
    });
    expect(sync.stopRace).toHaveBeenCalled();
    // Not a championship session: nobody to tell
    expect(resets).toEqual([]);
  });

  test('resetting the running session stops it; a championship is told', async () => {
    const cup = await prisma.championship.create({ data: { name: 'Cup', season: '2026' } });
    const session = await raced({ status: SessionStatus.DRAFT, championshipId: cup.id });
    const resets = [];
    service.on('sessionReset', (event) => resets.push(event));
    await service.startSession(session.id);
    await service.resetSession(session.id);
    expect(service.activeSessionId).toBeNull();
    expect(service.heartbeatInterval).toBeNull();
    expect(resets).toEqual([{ sessionId: session.id, championshipId: cup.id }]);
    await expect(service.resetSession('nope')).rejects.toThrow('Session nope not found');
  });

  test('a delete hides the session with its entries, laps and records, at one time', async () => {
    const cup = await prisma.championship.create({ data: { name: 'Cup', season: '2026' } });
    const session = await raced({ championshipId: cup.id });
    const deletions = [];
    service.on('sessionDeleted', (event) => deletions.push(event));
    await service.deleteSession(session.id);

    const { deletedAt } = await sessionRow(session.id);
    expect(deletedAt).not.toBeNull();
    expect((await prisma.lap.findFirst()).deletedAt).toEqual(deletedAt);
    expect((await prisma.sessionDriver.findFirst()).deletedAt).toEqual(deletedAt);
    expect((await prisma.trackRecord.findFirst()).deletedAt).toEqual(deletedAt);
    expect(deletions).toEqual([{ sessionId: session.id, championshipId: cup.id }]);
    await expect(service.deleteSession('nope')).rejects.toThrow('Session nope not found');
  });

  test('deleting the running session stops it; outside a championship nobody is told', async () => {
    const session = await raced({ status: SessionStatus.DRAFT });
    const deletions = [];
    service.on('sessionDeleted', (event) => deletions.push(event));
    await service.startSession(session.id);
    await service.deleteSession(session.id);
    expect(service.activeSessionId).toBeNull();
    expect(deletions).toEqual([]);
  });
});

describe('gaps of stored entries', () => {
  const entry = (controller, totalLaps, totalTime, bestLapTime) => ({ controller, totalLaps, totalTime, bestLapTime });

  test('a race by laps then time; the gap in laps when behind, else in time', () => {
    const ranked = SessionService.calculateDriverGaps(
      [entry(0, 9, 90000, 9000), entry(1, 10, 99000, 9100), entry(2, 10, 98000, 9200)],
      SessionType.RACE
    );
    expect(ranked.map((d) => [d.controller, d.position, d.gap])).toEqual([
      [2, 1, null],
      [1, 2, 1000],
      [0, 3, 1],
    ]);
  });

  test('otherwise by best lap, those without one last', () => {
    const ranked = SessionService.calculateDriverGaps(
      [entry(0, 0, 0, null), entry(1, 3, 0, 9100), entry(2, 0, 0, null), entry(3, 3, 0, 9000)],
      SessionType.QUALIF
    );
    expect(ranked.map((d) => [d.controller, d.position, d.gap])).toEqual([
      [3, 1, null],
      [1, 2, 100],
      [0, 3, null],
      [2, 4, null],
    ]);
  });

  test('nothing to rank', () => {
    expect(SessionService.calculateDriverGaps([], SessionType.RACE)).toEqual([]);
    expect(SessionService.calculateDriverGaps(null, SessionType.RACE)).toBeNull();
  });
});
