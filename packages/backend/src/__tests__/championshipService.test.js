import { jest } from '@jest/globals';
import { ChampionshipMode, SessionStatus, SessionType } from '@racehubos/shared';
import { prisma } from './setup.js';
import { ChampionshipService } from '../services/ChampionshipService.js';
import { sessionName } from '../lib/sessionNames.js';

const NAMES = { qualif: 'Quali', race: 'Course' };
const io = { emit: jest.fn() };
const service = new ChampionshipService(io);
afterAll(() => service.close());

let track, drivers;

beforeEach(async () => {
  await prisma.lap.deleteMany();
  await prisma.sessionDriver.deleteMany();
  await prisma.championshipParticipant.deleteMany();
  await prisma.session.deleteMany();
  await prisma.championship.deleteMany();
  await prisma.driver.deleteMany();
  await prisma.track.deleteMany();
  io.emit.mockClear();
  track = await prisma.track.create({ data: { name: 'Ring' } });
  drivers = [];
  for (const name of ['D0', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9']) {
    drivers.push(await prisma.driver.create({ data: { name } }));
  }
});

/** An auto championship whose participants are the first `count` drivers, in order. */
async function autoChampionship(count, settings = {}) {
  return prisma.championship.create({
    data: {
      name: 'Rush',
      season: '2026',
      mode: ChampionshipMode.AUTO,
      trackId: track.id,
      driversPerQualif: 4,
      driversPerRace: 6,
      qualifMaxDuration: 120000,
      qualifMaxLaps: 10,
      raceMaxDuration: 300000,
      raceMaxLaps: 20,
      ...settings,
      participants: { create: drivers.slice(0, count).map((d, order) => ({ driverId: d.id, order })) },
    },
  });
}

const linked = (championship) => ({ championshipId: championship.id, trackId: track.id });
const sessionsOf = (championshipId) =>
  prisma.session.findMany({
    where: { championshipId },
    include: { drivers: { orderBy: { controller: 'asc' } } },
    orderBy: { order: 'asc' },
  });
const namesOf = (entries) => entries.map((e) => drivers.find((d) => d.id === e.driverId).name);
const emitted = (event) => io.emit.mock.calls.filter(([name]) => name === event).map(([, data]) => data);

/** Finishes a qualifying with the given best laps by driver index (null: no lap). */
async function finishQualif(session, bests) {
  await prisma.session.update({ where: { id: session.id }, data: { status: SessionStatus.FINISHED } });
  for (const [index, bestLapTime] of Object.entries(bests)) {
    await prisma.sessionDriver.updateMany({
      where: { sessionId: session.id, driverId: drivers[index].id },
      data: { bestLapTime },
    });
  }
}

describe('a session created in a championship', () => {
  test('runs on its track, through the session service', async () => {
    const championship = await autoChampionship(2);
    service.setSessionService({ createSession: async (params) => params });
    expect(await service.createSession(championship.id, { name: 'Q', trackId: 'other' })).toEqual({
      name: 'Q',
      trackId: track.id,
      championshipId: championship.id,
    });
    await expect(service.createSession('nope', {})).rejects.toThrow('Championship not found');
  });
});

describe('generating the sessions of an auto championship', () => {
  test('qualifying groups interleave the participants, races wait for their results', async () => {
    const championship = await autoChampionship(10);
    await service.generateAutoSessions(championship.id, NAMES);
    const sessions = await sessionsOf(championship.id);

    expect(sessions.map((s) => [s.name, s.type, s.status, s.order, s.autoGroup])).toEqual([
      ['Quali 1', SessionType.QUALIF, SessionStatus.DRAFT, 1, 0],
      ['Quali 2', SessionType.QUALIF, SessionStatus.DRAFT, 2, 1],
      ['Quali 3', SessionType.QUALIF, SessionStatus.DRAFT, 3, 2],
      ['Course 1', SessionType.RACE, SessionStatus.DRAFT, 4, 0],
      ['Course 2', SessionType.RACE, SessionStatus.DRAFT, 5, 1],
    ]);
    expect(sessions.slice(0, 3).map((s) => namesOf(s.drivers))).toEqual([
      ['D0', 'D3', 'D6', 'D9'],
      ['D1', 'D4', 'D7'],
      ['D2', 'D5', 'D8'],
    ]);
    expect(sessions[0].drivers.map((d) => d.controller)).toEqual([0, 1, 2, 3]);
    expect(sessions[3].drivers).toEqual([]);
    expect(sessions.every((s) => s.trackId === track.id)).toBe(true);
    expect([sessions[0].maxDuration, sessions[0].maxLaps, sessions[3].maxDuration, sessions[3].maxLaps]).toEqual([
      120000, 10, 300000, 20,
    ]);
  });

  test('generated sessions come after the free practices', async () => {
    const championship = await autoChampionship(2, { driversPerQualif: 2, driversPerRace: 2 });
    for (const [order, deletedAt] of [
      [0, null],
      [1, null],
      [5, new Date()],
    ]) {
      await prisma.session.create({
        data: { name: `EL${order}`, type: SessionType.PRACTICE, ...linked(championship), order, deletedAt },
      });
    }
    await service.generateAutoSessions(championship.id, NAMES);
    const generated = (await sessionsOf(championship.id)).filter((s) => s.type !== SessionType.PRACTICE);
    expect(generated.map((s) => [s.type, s.order])).toEqual([
      [SessionType.QUALIF, 2],
      [SessionType.RACE, 3],
    ]);
  });

  test('regenerating replaces the drafts only, and skips unlinked participants', async () => {
    const championship = await autoChampionship(3, { driversPerQualif: 2 });
    const practice = await prisma.session.create({
      data: { name: 'EL', type: SessionType.PRACTICE, ...linked(championship), status: SessionStatus.DRAFT },
    });
    const played = await prisma.session.create({
      data: { name: 'Q0', type: SessionType.QUALIF, ...linked(championship), status: SessionStatus.FINISHED },
    });
    await service.generateAutoSessions(championship.id);
    await prisma.championshipParticipant.updateMany({
      where: { driverId: drivers[1].id },
      data: { deletedAt: new Date() },
    });
    await service.generateAutoSessions(championship.id);

    const sessions = await sessionsOf(championship.id);
    expect(sessions.map((s) => s.id)).toEqual(expect.arrayContaining([practice.id, played.id]));
    const drafts = sessions.filter((s) => s.status === SessionStatus.DRAFT && s.type !== SessionType.PRACTICE);
    expect(drafts.map((s) => s.name)).toEqual([
      `${sessionName(SessionType.QUALIF, {})} 1`,
      `${sessionName(SessionType.RACE, {})} 1`,
    ]);
    expect(namesOf(drafts[0].drivers)).toEqual(['D0', 'D2']);
  });

  test('nothing happens for a manual, unknown or incomplete championship', async () => {
    const manual = await autoChampionship(4, { mode: ChampionshipMode.MANUAL });
    const noTrack = await autoChampionship(4, { trackId: null });
    const noSizes = await autoChampionship(4, { driversPerRace: null });
    const empty = await autoChampionship(0);
    for (const { id } of [manual, noTrack, noSizes, empty]) await service.generateAutoSessions(id);
    await service.generateAutoSessions('nope');
    expect(await prisma.session.count()).toBe(0);
  });
});

describe('assigning the races from the qualifying results', () => {
  test('balanced groups in the order of the best laps, those without a time last', async () => {
    const championship = await autoChampionship(5, { driversPerQualif: 3, driversPerRace: 3 });
    await service.generateAutoSessions(championship.id, NAMES);
    const [q1, q2, race1, race2] = await sessionsOf(championship.id);
    // Q1: D0 D2 D4, Q2: D1 D3
    await finishQualif(q1, { 0: 9000, 2: null, 4: 7000 });
    await finishQualif(q2, { 1: 8000, 3: 9500 });
    await prisma.sessionDriver.create({ data: { sessionId: q2.id, controller: 5 } });
    await prisma.sessionDriver.create({ data: { sessionId: race2.id, driverId: drivers[9].id, controller: 0 } });

    await service.assignDriversToRaces(championship.id);
    const [, , r1, r2] = await sessionsOf(championship.id);
    expect(r1.id).toBe(race1.id);
    expect(namesOf(r1.drivers)).toEqual(['D4', 'D1', 'D0']);
    expect(r1.drivers.map((d) => [d.controller, d.gridPos])).toEqual([
      [0, 1],
      [1, 2],
      [2, 3],
    ]);
    expect(namesOf(r2.drivers)).toEqual(['D3', 'D2']);
    expect(emitted('championship:races_assigned')).toEqual([
      { championshipId: championship.id, timestamp: expect.any(String) },
    ]);
  });

  test('a participant who never ran a qualifying still gets a race', async () => {
    const championship = await autoChampionship(2, { driversPerQualif: 2, driversPerRace: 2 });
    await service.generateAutoSessions(championship.id, NAMES);
    const [q1] = await sessionsOf(championship.id);
    await prisma.sessionDriver.deleteMany({ where: { sessionId: q1.id, driverId: drivers[1].id } });
    await finishQualif(q1, { 0: 9000 });

    await service.assignDriversToRaces(championship.id);
    const [, race] = await sessionsOf(championship.id);
    expect(namesOf(race.drivers)).toEqual(['D0', 'D1']);
  });

  test('a manual championship is left alone', async () => {
    const manual = await autoChampionship(2, { mode: ChampionshipMode.MANUAL });
    await service.assignDriversToRaces(manual.id);
    expect(io.emit).not.toHaveBeenCalled();
  });
});

describe('the bracket of an auto championship', () => {
  test('groups, labels and, once every qualifying is over, the merged ranking', async () => {
    const championship = await autoChampionship(4, { driversPerQualif: 2, driversPerRace: 4 });
    await service.generateAutoSessions(championship.id, NAMES);
    const [q1, q2, race] = await sessionsOf(championship.id);
    await finishQualif(q1, { 0: 9000, 2: null });

    let bracket = await service.getBracket(championship.id);
    expect(bracket).toMatchObject({ mode: ChampionshipMode.AUTO, driversPerQualif: 2, driversPerRace: 4 });
    expect(bracket.participants.map((p) => p.driver.name)).toEqual(['D0', 'D1', 'D2', 'D3']);
    expect(bracket.qualifGroups.map((g) => [g.sessionId, g.group, g.label, g.name, g.status])).toEqual([
      [q1.id, 0, 'Q1', 'Quali 1', SessionStatus.FINISHED],
      [q2.id, 1, 'Q2', 'Quali 2', SessionStatus.DRAFT],
    ]);
    expect(bracket.raceGroups.map((g) => [g.sessionId, g.label, g.name])).toEqual([[race.id, 'R1', 'Course 1']]);
    expect(bracket.qualifGroups[0].drivers.map((d) => d.driver.name)).toEqual(['D0', 'D2']);
    expect(bracket.allQualifsFinished).toBe(false);
    expect(bracket.mergedRanking).toEqual([]);

    await finishQualif(q2, { 1: 8000, 3: 9500 });
    bracket = await service.getBracket(championship.id);
    expect(bracket.allQualifsFinished).toBe(true);
    expect(bracket.mergedRanking.map((r) => [r.position, r.driver.name, r.bestTime])).toEqual([
      [1, 'D1', 8000],
      [2, 'D0', 9000],
      [3, 'D3', 9500],
      [4, 'D2', null],
    ]);
  });

  test('none for a manual or unknown championship', async () => {
    const manual = await autoChampionship(2, { mode: ChampionshipMode.MANUAL });
    expect(await service.getBracket(manual.id)).toBeNull();
    expect(await service.getBracket('nope')).toBeNull();
  });
});

describe('reacting to the sessions', () => {
  async function playedQualifs() {
    const championship = await autoChampionship(4, { driversPerQualif: 2, driversPerRace: 4 });
    await service.generateAutoSessions(championship.id, NAMES);
    const [q1, q2, race] = await sessionsOf(championship.id);
    return { championship, q1, q2, race };
  }

  test("the last qualifying's end assigns the races", async () => {
    const { championship, q1, q2, race } = await playedQualifs();
    await finishQualif(q1, { 0: 9000 });
    await service.onSessionFinished(q1.id, championship.id);
    expect(emitted('championship:standings_changed')).toEqual([
      { championshipId: championship.id, sessionId: q1.id, reason: 'session_finished', timestamp: expect.any(String) },
    ]);
    expect(emitted('championship:races_assigned')).toEqual([]);

    await finishQualif(q2, { 1: 8000 });
    await service.onSessionFinished(q2.id, championship.id);
    expect(emitted('championship:races_assigned')).toHaveLength(1);
    expect((await sessionsOf(championship.id))[2].drivers).toHaveLength(4);

    await service.onSessionFinished(race.id, championship.id);
    expect(emitted('championship:races_assigned')).toHaveLength(1);
  });

  test('a session outside a championship, or in a manual one, only refreshes the standings', async () => {
    await service.onSessionFinished('s1', null);
    await service.onStandingsChanged(null, 's1', 'session_reset');
    expect(io.emit).not.toHaveBeenCalled();

    const manual = await autoChampionship(2, { mode: ChampionshipMode.MANUAL });
    await service.onSessionFinished('s1', manual.id);
    await service.onStandingsChanged(manual.id, 's1', 'session_reset');
    expect(io.emit.mock.calls.map(([event]) => event)).toEqual([
      'championship:standings_changed',
      'championship:standings_changed',
    ]);
  });

  test('resetting a qualifying clears the races; deleting it or resetting a race does not', async () => {
    const { championship, q1, q2, race } = await playedQualifs();
    await finishQualif(q1, { 0: 9000 });
    await finishQualif(q2, { 1: 8000 });
    await service.assignDriversToRaces(championship.id);
    io.emit.mockClear();
    const raceDrivers = () => prisma.sessionDriver.count({ where: { sessionId: race.id } });

    await service.onStandingsChanged(championship.id, q1.id, 'session_deleted');
    await service.onStandingsChanged(championship.id, race.id, 'session_reset');
    expect(await raceDrivers()).toBe(4);
    expect(emitted('championship:standings_changed').map((e) => e.reason)).toEqual([
      'session_deleted',
      'session_reset',
    ]);

    await service.onStandingsChanged(championship.id, q1.id, 'session_reset');
    expect(await raceDrivers()).toBe(0);
    expect(emitted('championship:races_assigned')).toEqual([
      { championshipId: championship.id, cleared: true, timestamp: expect.any(String) },
    ]);
  });
});
