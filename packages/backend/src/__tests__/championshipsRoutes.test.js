import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { ChampionshipMode, ChampionshipStatus, SessionStatus, SessionType } from '@racehubos/shared';
import { prisma } from './setup.js';
import championshipsRouter, { setChampionshipService } from '../routes/championships.js';

const app = express();
app.use(express.json());
app.use('/api/championships', championshipsRouter);
const api = request(app);

const service = {
  generateAutoSessions: jest.fn(async () => {}),
  createSession: jest.fn(),
  getBracket: jest.fn(),
};
setChampionshipService(service);

async function wipe() {
  await prisma.championshipExtra.deleteMany();
  await prisma.lap.deleteMany();
  await prisma.sessionDriver.deleteMany();
  await prisma.championshipParticipant.deleteMany();
  await prisma.session.deleteMany();
  await prisma.championship.deleteMany();
  await prisma.driver.deleteMany();
  await prisma.car.deleteMany();
  await prisma.track.deleteMany();
}

let track, ana, ben, cid, car1, car2;

beforeEach(async () => {
  await wipe();
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  track = await prisma.track.create({ data: { name: 'Ring' } });
  ana = await prisma.driver.create({ data: { name: 'Ana' } });
  ben = await prisma.driver.create({ data: { name: 'Ben' } });
  cid = await prisma.driver.create({ data: { name: 'Cid' } });
  car1 = await prisma.car.create({ data: { brand: 'Ford', model: 'GT' } });
  car2 = await prisma.car.create({ data: { brand: 'Porsche', model: '911' } });
});
afterEach(() => jest.restoreAllMocks());

const newChampionship = (data = {}) =>
  prisma.championship.create({ data: { name: 'Rush', season: '2026', trackId: track.id, ...data } });

const newSession = (championshipId, type, status, data = {}) =>
  prisma.session.create({ data: { type, status, trackId: track.id, championshipId, ...data } });

let lapNumber = 0;
const lap = (session, driver, car, lapTime, data = {}) =>
  prisma.lap.create({
    data: {
      sessionId: session.id,
      trackId: track.id,
      driverId: driver?.id ?? null,
      carId: car.id,
      controller: 0,
      phase: session.type,
      lapNumber: ++lapNumber,
      lapTime,
      ...data,
    },
  });

const entry = (session, driver, car, controller, data = {}) =>
  prisma.sessionDriver.create({
    data: { sessionId: session.id, driverId: driver?.id ?? null, carId: car?.id ?? null, controller, ...data },
  });

/** A championship with a draft practice, a finished qualif and a finished race. */
async function raced() {
  const championship = await newChampionship();
  const practice = await newSession(championship.id, SessionType.PRACTICE, SessionStatus.DRAFT, { name: 'EL' });
  const qualif = await newSession(championship.id, SessionType.QUALIF, SessionStatus.FINISHED, { name: 'Q1' });
  const race = await newSession(championship.id, SessionType.RACE, SessionStatus.FINISHED, { name: 'R1' });

  await lap(practice, ana, car1, 7000);
  await lap(practice, ben, car2, 6900, { deletedAt: new Date() });
  await lap(qualif, ana, car1, 8000.4);
  await lap(qualif, ana, car1, 8100);
  await lap(qualif, ben, car2, 7900);
  await lap(qualif, ana, car1, 7000, { deletedAt: new Date() });
  for (const time of [8000, 8010, 8020, 8030, 9000]) await lap(race, ana, car1, time);
  for (const time of [7950, 8100, 8100, 8100]) await lap(race, ben, car2, time);

  await entry(race, ana, car1, 0, { totalLaps: 10, totalTime: 90000 });
  await entry(race, ben, car2, 1, { totalLaps: 10, totalTime: 95000 });
  await entry(race, cid, car1, 2, { totalLaps: 0, isDNF: true });
  return { championship, practice, qualif, race };
}

describe('GET /api/championships', () => {
  test('active ones by default, filtered by track and status, paginated', async () => {
    const other = await prisma.track.create({ data: { name: 'Autre' } });
    await newChampionship({ name: 'A', status: ChampionshipStatus.ACTIVE });
    await newChampionship({ name: 'B', status: ChampionshipStatus.FINISHED, trackId: other.id });
    await newChampionship({ name: 'C', deletedAt: new Date() });

    let res = await api.get('/api/championships?sortBy=name&sortOrder=asc');
    expect(res.status).toBe(200);
    expect(res.body.data.map((c) => c.name)).toEqual(['A', 'B']);
    expect(res.body).toMatchObject({ total: 2, hasMore: false });

    res = await api.get('/api/championships?deleted=true');
    expect(res.body.data.map((c) => c.name)).toEqual(['C']);

    res = await api.get(`/api/championships?trackId=${other.id}`);
    expect(res.body.data.map((c) => c.name)).toEqual(['B']);
    res = await api.get(`/api/championships?trackId=${other.id},${track.id}&sortBy=name&sortOrder=asc`);
    expect(res.body.data.map((c) => c.name)).toEqual(['A', 'B']);

    res = await api.get(`/api/championships?status=${ChampionshipStatus.FINISHED}`);
    expect(res.body.data.map((c) => c.name)).toEqual(['B']);
    res = await api.get(`/api/championships?status=${ChampionshipStatus.FINISHED},${ChampionshipStatus.ACTIVE}`);
    expect(res.body.total).toBe(2);

    res = await api.get('/api/championships?limit=1&offset=0&sortBy=name&sortOrder=asc');
    expect(res.body.data.map((c) => c.name)).toEqual(['A']);
    expect(res.body).toMatchObject({ total: 2, hasMore: true });
  });

  test('sorted by track name, qualif count or race count', async () => {
    const zed = await prisma.track.create({ data: { name: 'Zed' } });
    const a = await newChampionship({ name: 'A', trackId: zed.id });
    const b = await newChampionship({ name: 'B' });
    await newSession(a.id, SessionType.QUALIF, SessionStatus.DRAFT);
    await newSession(a.id, SessionType.QUALIF, SessionStatus.DRAFT);
    await newSession(b.id, SessionType.QUALIF, SessionStatus.DRAFT, { deletedAt: new Date() });
    await newSession(b.id, SessionType.RACE, SessionStatus.DRAFT);
    const noTrack = await prisma.championship.create({ data: { name: 'N', season: '2026' } });

    const names = async (query) => (await api.get(`/api/championships?${query}`)).body.data.map((c) => c.name);
    expect(await names('sortBy=track&sortOrder=asc')).toEqual(['N', 'B', 'A']);
    expect(await names('sortBy=track')).toEqual(['A', 'B', 'N']);
    expect((await names('sortBy=qualifs&sortOrder=asc'))[2]).toBe('A');
    expect((await names('sortBy=qualifs'))[0]).toBe('A');
    expect((await names('sortBy=races'))[0]).toBe('B');
    expect(noTrack.trackId).toBeNull();
  });

  test('a database failure answers 500', async () => {
    const res = await api.get('/api/championships?sortBy=unknownField');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ success: false, error: 'Failed to fetch championships' });
  });
});

describe('GET /api/championships/:id', () => {
  test('with its participants in order and its sessions with entries and laps', async () => {
    const { championship } = await raced();
    await prisma.championshipParticipant.createMany({
      data: [
        { championshipId: championship.id, driverId: ben.id, order: 1 },
        { championshipId: championship.id, driverId: ana.id, order: 0 },
      ],
    });
    const res = await api.get(`/api/championships/${championship.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.participants.map((p) => p.driver.name)).toEqual(['Ana', 'Ben']);
    expect(res.body.data.sessions.map((s) => s.name)).toEqual(['EL', 'Q1', 'R1']);
    expect(res.body.data.sessions[1].laps).toHaveLength(3);
    expect(res.body.data.sessions[2].drivers).toHaveLength(3);
    expect(res.body.data.track.name).toBe('Ring');
  });

  test('404 when missing or deleted', async () => {
    const deleted = await newChampionship({ deletedAt: new Date() });
    expect((await api.get('/api/championships/nope')).status).toBe(404);
    expect((await api.get(`/api/championships/${deleted.id}`)).status).toBe(404);
  });
});

describe('exports', () => {
  test('a workbook for one or several championships, 404 for none', async () => {
    const { championship } = await raced();
    let res = await api.get(`/api/championships/${championship.id}/export`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheetml');
    res = await api.get(`/api/championships/export?ids=${championship.id}`);
    expect(res.status).toBe(200);
    expect((await api.get('/api/championships/nope/export')).status).toBe(404);
    expect((await api.get('/api/championships/export?ids=')).status).toBe(404);
  });
});

describe('POST /api/championships', () => {
  const create = (body) => api.post('/api/championships').send(body);
  const auto = (overrides = {}) => ({
    name: 'Auto',
    season: '2026',
    mode: ChampionshipMode.AUTO,
    trackId: track.id,
    participants: [{ driverId: ana.id }, { driverId: ben.id }],
    driversPerQualif: 2,
    driversPerRace: 2,
    ...overrides,
  });

  test.each([
    [() => ({ season: '2026' }), 'Name and season are required'],
    [() => ({ name: 'X', season: '2026', trackId: 'nope' }), 'Track not found'],
    [() => auto({ trackId: undefined }), 'Track is required for auto championships'],
    [() => auto({ participants: [{ driverId: ana.id }] }), 'At least 2 participants required'],
    [() => auto({ participants: undefined }), 'At least 2 participants required'],
    [() => auto({ participants: [{ driverId: ana.id }, { driverId: ana.id }] }), 'Duplicate drivers in participants'],
    [() => auto({ participants: [{ driverId: ana.id }, { driverId: 'ghost' }] }), 'One or more drivers not found'],
    [() => auto({ driversPerQualif: 7 }), 'driversPerQualif must be between 2 and 6'],
    [() => auto({ driversPerQualif: undefined }), 'driversPerQualif must be between 2 and 6'],
    [() => auto({ driversPerRace: 1 }), 'driversPerRace must be between 2 and 6'],
  ])('refused: %#', async (body, error) => {
    const res = await create(body());
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, error });
  });

  test('a manual championship on a track gets its free practice session', async () => {
    const res = await create({
      name: ' Coupe ',
      season: ' 2026 ',
      trackId: track.id,
      qualifMaxLaps: 10,
      sessionNames: { practice: 'Essais libres' },
    });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      name: 'Coupe',
      season: '2026',
      status: ChampionshipStatus.PLANNED,
      mode: ChampionshipMode.MANUAL,
      driversPerQualif: null,
      qualifMaxLaps: 10,
      raceMaxLaps: null,
    });
    expect(res.body.data.sessions).toEqual([
      expect.objectContaining({ type: SessionType.PRACTICE, status: SessionStatus.DRAFT, name: 'Essais libres' }),
    ]);
    expect(service.generateAutoSessions).not.toHaveBeenCalled();
  });

  test('without a track, no session', async () => {
    const res = await create({ name: 'X', season: '2026', status: ChampionshipStatus.ACTIVE });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ trackId: null, status: ChampionshipStatus.ACTIVE, sessions: [] });
  });

  test('an automatic championship gets its participants in order and its generated sessions', async () => {
    const names = { qualif: 'Q' };
    const res = await create(auto({ participants: [{ driverId: ben.id }, { driverId: ana.id }], sessionNames: names }));
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ mode: ChampionshipMode.AUTO, driversPerQualif: 2, driversPerRace: 2 });
    expect(res.body.data.participants.map((p) => p.driver.name)).toEqual(['Ben', 'Ana']);
    expect(service.generateAutoSessions).toHaveBeenCalledWith(res.body.data.id, names);
  });

  test('500 when generating fails', async () => {
    service.generateAutoSessions.mockRejectedValueOnce(new Error('boom'));
    const res = await create(auto());
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Failed to create championship');
  });
});

describe('PUT /api/championships/:id', () => {
  test('updates the name, season and status given; anything else is ignored', async () => {
    const championship = await newChampionship();
    const put = (body) => api.put(`/api/championships/${championship.id}`).send(body);

    let res = await put({ name: ' New ', season: ' 2027 ', status: ChampionshipStatus.ACTIVE });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ name: 'New', season: '2027', status: ChampionshipStatus.ACTIVE });
    expect(res.body.data.sessions).toEqual([]);

    res = await put({ pointsSystem: '{}', mode: ChampionshipMode.AUTO });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ name: 'New', mode: ChampionshipMode.MANUAL });
  });

  test('404 when missing', async () => {
    expect((await api.put('/api/championships/nope').send({ name: 'X' })).status).toBe(404);
  });
});

describe('DELETE and restore', () => {
  const counts = async (championshipId) => ({
    laps: await prisma.lap.count({ where: { session: { championshipId }, deletedAt: null } }),
    entries: await prisma.sessionDriver.count({ where: { session: { championshipId }, deletedAt: null } }),
    sessions: await prisma.session.count({ where: { championshipId, deletedAt: null } }),
    participants: await prisma.championshipParticipant.count({ where: { championshipId, deletedAt: null } }),
  });

  test('a first delete hides everything, a restore brings back only what it hid, a second delete erases', async () => {
    const { championship } = await raced();
    const id = championship.id;
    await prisma.championshipParticipant.create({ data: { championshipId: id, driverId: ana.id } });
    const before = await counts(id);
    expect(before).toEqual({ laps: 13, entries: 3, sessions: 3, participants: 1 });

    let res = await api.delete(`/api/championships/${id}`);
    expect(res.body).toEqual({ success: true, message: 'Championship deleted successfully' });
    expect(await counts(id)).toEqual({ laps: 0, entries: 0, sessions: 0, participants: 0 });
    expect((await prisma.championship.findUnique({ where: { id } })).deletedAt).not.toBeNull();

    res = await api.patch(`/api/championships/${id}/restore`);
    expect(res.body).toEqual({ success: true, message: 'Championship restored' });
    expect(await counts(id)).toEqual(before);
    expect(await prisma.lap.count({ where: { session: { championshipId: id }, deletedAt: { not: null } } })).toBe(2);

    await api.delete(`/api/championships/${id}`);
    res = await api.delete(`/api/championships/${id}`);
    expect(res.status).toBe(200);
    expect(await prisma.championship.findUnique({ where: { id } })).toBeNull();
    expect(await prisma.session.count({ where: { championshipId: id } })).toBe(0);
    expect(await prisma.lap.count()).toBe(0);
  });

  test('404 when missing', async () => {
    expect((await api.delete('/api/championships/nope')).status).toBe(404);
    expect((await api.patch('/api/championships/nope/restore')).status).toBe(404);
  });
});

describe('POST /api/championships/:id/sessions', () => {
  test("the service's session, its error as a 400, 404 for an unknown championship", async () => {
    const championship = await newChampionship();
    service.createSession.mockResolvedValueOnce({ id: 's1' });
    let res = await api.post(`/api/championships/${championship.id}/sessions`).send({ type: SessionType.RACE });
    expect(res.body).toEqual({ success: true, data: { id: 's1' } });
    expect(service.createSession).toHaveBeenCalledWith(championship.id, { type: SessionType.RACE });

    service.createSession.mockRejectedValueOnce(new Error('No track'));
    res = await api.post(`/api/championships/${championship.id}/sessions`).send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('No track');

    expect((await api.post('/api/championships/nope/sessions').send({})).status).toBe(404);
  });
});

describe('GET /api/championships/:id/bracket', () => {
  test("the service's bracket, 404 without one, 500 on failure", async () => {
    service.getBracket.mockResolvedValueOnce({ qualifGroups: [] });
    expect((await api.get('/api/championships/c1/bracket')).body).toEqual({
      success: true,
      data: { qualifGroups: [] },
    });
    service.getBracket.mockResolvedValueOnce(null);
    expect((await api.get('/api/championships/c1/bracket')).status).toBe(404);
    service.getBracket.mockRejectedValueOnce(new Error('boom'));
    expect((await api.get('/api/championships/c1/bracket')).status).toBe(500);
  });
});

describe('GET /api/championships/:id/results', () => {
  test('race standings, podium and awards from finished sessions only', async () => {
    const { championship } = await raced();
    const res = await api.get(`/api/championships/${championship.id}/results`);
    expect(res.status).toBe(200);
    const { podium, standings, awards } = res.body.data;

    expect(standings.map((s) => [s.position, s.driver.name, s.totalLaps, s.totalTime, s.finishedRaces])).toEqual([
      [1, 'Ana', 10, 90000, 1],
      [2, 'Ben', 10, 95000, 1],
      [3, 'Cid', 0, 0, 0],
    ]);
    expect(podium).toEqual(standings);
    expect(standings[0].car.model).toBe('GT');

    const byId = Object.fromEntries(awards.map((a) => [a.id, a]));
    expect(awards.map((a) => a.id)).toEqual([
      'best-lap',
      'best-qualif',
      'best-race-lap',
      'comeback',
      'consistent',
      'iron-man',
    ]);
    expect(byId['best-lap']).toMatchObject({
      title: 'Meilleur tour',
      icon: 'timer',
      lapTime: 7900,
      sessionName: 'Q1',
      sessionType: SessionType.QUALIF,
      driver: { name: 'Ben' },
    });
    expect(byId['best-qualif']).toMatchObject({ lapTime: 7900, sessionName: 'Q1', driver: { name: 'Ben' } });
    expect(byId['best-race-lap']).toMatchObject({ lapTime: 7950, sessionName: 'R1', driver: { name: 'Ben' } });
    expect(byId.comeback).toMatchObject({ gain: 1, qualifPos: 2, racePos: 1, driver: { name: 'Ana' } });
    expect(byId.consistent).toMatchObject({ stdDev: 8, sessionName: 'R1', driver: { name: 'Ana' } });
    expect(byId['iron-man']).toMatchObject({ totalLaps: 10, finishedRaces: 1, driver: { name: 'Ana' } });
  });

  test('no awards before anything is finished; entries without a driver skipped', async () => {
    const championship = await newChampionship();
    const race = await newSession(championship.id, SessionType.RACE, SessionStatus.FINISHED);
    await entry(race, null, null, 0, { totalLaps: 3 });
    const draft = await newSession(championship.id, SessionType.QUALIF, SessionStatus.DRAFT);
    await lap(draft, ana, car1, 8000);

    const res = await api.get(`/api/championships/${championship.id}/results`);
    expect(res.body.data).toEqual({ podium: [], standings: [], awards: [] });
  });

  test('no comeback without a gain', async () => {
    const championship = await newChampionship();
    const qualif = await newSession(championship.id, SessionType.QUALIF, SessionStatus.FINISHED);
    const race = await newSession(championship.id, SessionType.RACE, SessionStatus.FINISHED);
    await lap(qualif, ana, car1, 8000);
    await lap(qualif, ben, car2, 8100);
    await entry(race, ana, car1, 0, { totalLaps: 5 });
    await entry(race, ben, car2, 1, { totalLaps: 4 });
    await entry(race, cid, car2, 2, { totalLaps: 3 });

    const res = await api.get(`/api/championships/${championship.id}/results`);
    expect(res.body.data.awards.map((a) => a.id)).toEqual(['best-lap', 'best-qualif', 'iron-man']);
  });

  test('404 when missing', async () => {
    expect((await api.get('/api/championships/nope/results')).status).toBe(404);
  });
});

describe('GET /api/championships/:id/standings', () => {
  test('qualif: best lap per driver and car over finished qualifs, deleted laps left out', async () => {
    const { championship } = await raced();
    const res = await api.get(`/api/championships/${championship.id}/standings?type=${SessionType.QUALIF}`);
    expect(res.body).toMatchObject({ success: true, type: SessionType.QUALIF, count: 2 });
    expect(res.body.standings.map((s) => [s.position, s.driver.name, s.car.model, s.bestTime, s.totalLaps])).toEqual([
      [1, 'Ben', '911', 7900, 1],
      [2, 'Ana', 'GT', 8000, 2],
    ]);
  });

  test('race: laps then time per driver and car over finished races', async () => {
    const { championship } = await raced();
    const res = await api.get(`/api/championships/${championship.id}/standings?type=${SessionType.RACE}`);
    expect(
      res.body.standings.map((s) => [s.position, s.driver.name, s.totalLaps, s.totalTime, s.finishedRaces])
    ).toEqual([
      [1, 'Ana', 10, 90000, 1],
      [2, 'Ben', 10, 95000, 1],
      [3, 'Cid', 0, 0, 0],
    ]);
  });

  test('practice: best lap of the practice session, deleted laps included; none without one', async () => {
    const { championship } = await raced();
    const res = await api.get(`/api/championships/${championship.id}/standings?type=${SessionType.PRACTICE}`);
    expect(res.body.standings.map((s) => [s.driver.name, s.bestTime])).toEqual([
      ['Ben', 6900],
      ['Ana', 7000],
    ]);

    const bare = await newChampionship();
    expect((await api.get(`/api/championships/${bare.id}/standings?type=${SessionType.PRACTICE}`)).body).toEqual({
      success: true,
      type: SessionType.PRACTICE,
      standings: [],
      count: 0,
    });
  });

  test('400 without a type or with an unknown one, 404 for an unknown championship', async () => {
    const championship = await newChampionship();
    expect((await api.get(`/api/championships/${championship.id}/standings`)).status).toBe(400);
    const res = await api.get(`/api/championships/${championship.id}/standings?type=${SessionType.BALANCING}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid type. Must be one of: qualif, race, practice');
    expect((await api.get(`/api/championships/nope/standings?type=${SessionType.RACE}`)).status).toBe(404);
  });
});

describe('PUT /api/championships/:id/participants (validation)', () => {
  const put = (id, driverIds) =>
    api
      .put(`/api/championships/${id}/participants`)
      .send({ participants: driverIds.map((driverId) => ({ driverId })) });

  test('refused for a manual championship, fewer than two, duplicates or unknown drivers', async () => {
    const manual = await newChampionship();
    const auto = await newChampionship({ mode: ChampionshipMode.AUTO });
    expect((await put(manual.id, [ana.id, ben.id])).body.error).toBe('Only auto championships support participants');
    expect((await put(auto.id, [ana.id])).body.error).toBe('At least 2 participants required');
    expect((await put(auto.id, [ana.id, ana.id])).body.error).toBe('Duplicate drivers in participants');
    expect((await put(auto.id, [ana.id, 'ghost'])).body.error).toBe('One or more drivers not found');
    expect((await put('nope', [ana.id, ben.id])).status).toBe(404);
  });

  test('once a qualif has started, its drivers stay and the sessions are not regenerated', async () => {
    const auto = await newChampionship({ mode: ChampionshipMode.AUTO });
    const qualif = await newSession(auto.id, SessionType.QUALIF, SessionStatus.ACTIVE);
    await newSession(auto.id, SessionType.QUALIF, SessionStatus.DRAFT);
    await entry(qualif, ana, car1, 0);
    await entry(qualif, null, null, 1);

    let res = await put(auto.id, [ben.id, cid.id]);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Cannot remove driver who already participated in a qualif');

    res = await put(auto.id, [ana.id, cid.id]);
    expect(res.status).toBe(200);
    expect(res.body.data.participants.map((p) => p.driver.name)).toEqual(['Ana', 'Cid']);
    expect(service.generateAutoSessions).not.toHaveBeenCalled();
  });

  test('before any qualif, the sessions are regenerated with the names given', async () => {
    const auto = await newChampionship({ mode: ChampionshipMode.AUTO });
    const names = { race: 'Course' };
    const res = await api
      .put(`/api/championships/${auto.id}/participants`)
      .send({ participants: [{ driverId: ana.id }, { driverId: ben.id }], sessionNames: names });
    expect(res.status).toBe(200);
    expect(service.generateAutoSessions).toHaveBeenCalledWith(auto.id, names);
  });
});
