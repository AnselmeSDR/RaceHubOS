import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { ChampionshipMode, ChampionshipStatus, SessionStatus, SessionType } from '@racehubos/shared';
import { prisma } from './setup.js';
import championshipsRouter, { setChampionshipService } from '../routes/championships.js';
import { ChampionshipService } from '../services/ChampionshipService.js';

/**
 * Editing a championship under way (PUT /api/championships/:id/plan): a session that has started
 * never changes; the sessions to come are planned again after it; a driver who raced and leaves is
 * DNF in the sessions to come they were in.
 */
const app = express();
app.use(express.json());
app.use('/api/championships', championshipsRouter);
const api = request(app);
const service = new ChampionshipService(null);
setChampionshipService(service);

const { MANUAL, AUTO } = ChampionshipMode;
const { PRACTICE, QUALIF, RACE } = SessionType;
const { DRAFT, FINISHED } = SessionStatus;

let track, other, ana, ben, cid, dan, car1, car2, car3, car4;

beforeEach(async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  await prisma.lap.deleteMany();
  await prisma.sessionDriver.deleteMany();
  await prisma.championshipParticipant.deleteMany();
  await prisma.session.deleteMany();
  await prisma.championship.deleteMany();
  await prisma.driver.deleteMany();
  await prisma.car.deleteMany();
  await prisma.track.deleteMany();
  track = await prisma.track.create({ data: { name: 'Ring' } });
  other = await prisma.track.create({ data: { name: 'Other' } });
  [ana, ben, cid, dan] = await Promise.all(
    ['Ana', 'Ben', 'Cid', 'Dan'].map((name) => prisma.driver.create({ data: { name } }))
  );
  [car1, car2, car3, car4] = await Promise.all(
    ['GT', '911', 'M4', 'R8'].map((model) => prisma.car.create({ data: { brand: 'X', model } }))
  );
});
afterEach(() => jest.restoreAllMocks());

const carOf = (driver) => ({ [ana.id]: car1, [ben.id]: car2, [cid.id]: car3, [dan.id]: car4 })[driver.id];

async function championship(mode, drivers, data = {}) {
  const created = await prisma.championship.create({
    data: { name: 'Rush', season: '2026', trackId: track.id, mode, ...data },
  });
  await prisma.championshipParticipant.createMany({
    data: drivers.map((d, order) => ({ championshipId: created.id, driverId: d.id, carId: carOf(d).id, order })),
  });
  return created;
}

async function session(championshipId, type, status, order, drivers = [], data = {}) {
  return prisma.session.create({
    data: {
      type,
      status,
      order,
      name: data.name ?? `${type} ${order}`,
      trackId: track.id,
      championshipId,
      ...data,
      drivers: {
        create: drivers.map((d, controller) => ({ driverId: d.id, carId: carOf(d).id, controller, bestLapTime: 0 })),
      },
    },
  });
}

const line = (drivers) => drivers.map((d) => ({ driverId: d.id, carId: carOf(d).id }));
const seats = (drivers) => drivers.map((d, controller) => ({ driverId: d.id, controller }));

const edit = (id, body) =>
  api.put(`/api/championships/${id}/plan`).send({ name: 'Rush', trackId: track.id, mode: MANUAL, ...body });

const sessionsOf = (championshipId) =>
  prisma.session.findMany({
    where: { championshipId, deletedAt: null },
    include: { drivers: { orderBy: { controller: 'asc' } }, withdrawals: true },
    orderBy: { order: 'asc' },
  });

describe('a session that has started never changes', () => {
  test('manual: the sessions to come are kept by id, added after those that ran, or removed', async () => {
    const rush = await championship(MANUAL, [ana, ben, cid]);
    const q1 = await session(rush.id, QUALIF, FINISHED, 0, [ana, ben], { name: 'Q1', maxDuration: 60000 });
    const q2 = await session(rush.id, QUALIF, DRAFT, 1, [cid]);
    const r1 = await session(rush.id, RACE, DRAFT, 2, [ana]);

    const res = await edit(rush.id, {
      participants: line([ana, ben, cid]),
      qualifMaxDuration: 300000,
      raceMaxDuration: 600000,
      sessions: [
        { type: RACE, drivers: seats([ben, cid]) },
        { id: q2.id, type: QUALIF, drivers: seats([cid, ana]) },
      ],
      sessionNames: { race: 'Course' },
    });

    expect(res.status).toBe(200);
    const after = await sessionsOf(rush.id);
    expect(after.map((s) => [s.name, s.order])).toEqual([
      ['Q1', 0],
      ['Course 1', 1],
      [q2.name, 2],
    ]);
    expect(after[0]).toMatchObject({ id: q1.id, maxDuration: 60000 });
    expect(after[0].drivers.map((d) => d.driverId)).toEqual([ana.id, ben.id]);
    expect(after[1].drivers.map((d) => [d.driverId, d.carId])).toEqual([
      [ben.id, car2.id],
      [cid.id, car3.id],
    ]);
    expect(after[2]).toMatchObject({ id: q2.id, maxDuration: 300000 });
    expect(after[2].drivers.map((d) => d.driverId)).toEqual([cid.id, ana.id]);
    expect(await prisma.session.findUnique({ where: { id: r1.id } })).toBeNull();
  });

  test('a session to come left out goes to the bin when a reset left laps in it', async () => {
    const rush = await championship(MANUAL, [ana, ben]);
    const reset = await session(rush.id, PRACTICE, DRAFT, 0, [ana]);
    await prisma.lap.create({
      data: {
        sessionId: reset.id,
        trackId: track.id,
        driverId: ana.id,
        carId: car1.id,
        controller: 0,
        phase: PRACTICE,
        lapNumber: 1,
        lapTime: 7000,
        deletedAt: new Date(),
      },
    });

    expect((await edit(rush.id, { participants: line([ana, ben]), sessions: [] })).status).toBe(200);
    expect((await prisma.session.findUnique({ where: { id: reset.id } })).deletedAt).not.toBeNull();
  });

  test('the track changes until a session has run', async () => {
    const rush = await championship(MANUAL, [ana, ben]);
    const q1 = await session(rush.id, QUALIF, DRAFT, 0, [ana]);
    const body = { participants: line([ana, ben]), sessions: [{ id: q1.id, type: QUALIF }] };

    expect((await edit(rush.id, { ...body, trackId: other.id })).status).toBe(200);
    expect((await prisma.session.findUnique({ where: { id: q1.id } })).trackId).toBe(other.id);

    await prisma.session.update({ where: { id: q1.id }, data: { status: FINISHED } });
    const res = await edit(rush.id, { ...body, trackId: track.id, sessions: [] });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('The track no longer changes once a session has run');
  });

  test('refused: a finished championship, a session not to come, a type changed, too few drivers', async () => {
    const rush = await championship(MANUAL, [ana, ben]);
    const q1 = await session(rush.id, QUALIF, FINISHED, 0, [ana]);
    const q2 = await session(rush.id, QUALIF, DRAFT, 1, [ben]);
    const participants = line([ana, ben]);

    let res = await edit(rush.id, { participants, sessions: [{ id: q1.id, type: QUALIF }] });
    expect(res.status).toBe(400);
    res = await edit(rush.id, { participants, sessions: [{ id: q2.id, type: RACE }] });
    expect(res.body.error).toBe('A session keeps its type');
    res = await edit(rush.id, { mode: AUTO, driversPerQualif: 2, driversPerRace: 2, participants: line([ana]) });
    expect(res.body.error).toBe('At least 2 participants required');

    await prisma.championship.update({ where: { id: rush.id }, data: { status: ChampionshipStatus.FINISHED } });
    expect((await edit(rush.id, { participants, sessions: [] })).status).toBe(409);
    expect(await prisma.session.count({ where: { championshipId: rush.id } })).toBe(2);
  });
});

describe('a participant who leaves', () => {
  test('after racing: DNF in the sessions to come they were in, back again when re-entered', async () => {
    const rush = await championship(MANUAL, [ana, ben, cid]);
    await session(rush.id, QUALIF, FINISHED, 0, [ana, ben]);
    const r1 = await session(rush.id, RACE, DRAFT, 1, [ana, ben, cid]);

    let res = await edit(rush.id, {
      participants: line([ben, cid]),
      sessions: [{ id: r1.id, type: RACE, drivers: seats([ben, cid]) }],
    });
    expect(res.status).toBe(200);
    let [, race] = await sessionsOf(rush.id);
    expect(race.drivers.map((d) => d.driverId)).toEqual([ben.id, cid.id]);
    expect(race.withdrawals.map((w) => [w.driverId, w.carId])).toEqual([[ana.id, car1.id]]);
    const hidden = await prisma.championshipParticipant.findFirst({ where: { driverId: ana.id } });
    expect(hidden.deletedAt).not.toBeNull();

    res = await edit(rush.id, {
      participants: line([ben, cid, ana]),
      sessions: [{ id: r1.id, type: RACE, drivers: seats([ben, cid, ana]) }],
    });
    expect(res.status).toBe(200);
    [, race] = await sessionsOf(rush.id);
    expect(race.withdrawals).toEqual([]);
    expect(await prisma.championshipParticipant.count({ where: { driverId: ana.id, deletedAt: null } })).toBe(1);
  });

  test('without racing: simply gone, DNF nowhere', async () => {
    const rush = await championship(MANUAL, [ana, ben, cid]);
    await session(rush.id, QUALIF, FINISHED, 0, [ana, ben]);
    const r1 = await session(rush.id, RACE, DRAFT, 1, [ana, cid]);

    await edit(rush.id, {
      participants: line([ana, ben]),
      sessions: [{ id: r1.id, type: RACE, drivers: seats([ana]) }],
    });

    expect(await prisma.sessionWithdrawal.count()).toBe(0);
  });
});

describe('an automatic championship', () => {
  const autoBody = (body) => ({ mode: AUTO, driversPerQualif: 2, driversPerRace: 2, practiceGroups: [], ...body });

  test('the qualifs to come take only the drivers still to qualify', async () => {
    const rush = await championship(AUTO, [ana, ben, cid, dan], { driversPerQualif: 2, driversPerRace: 2 });
    await session(rush.id, QUALIF, FINISHED, 0, [ana, ben], { autoGroup: 0 });
    const q2 = await session(rush.id, QUALIF, DRAFT, 1, [cid, dan], { autoGroup: 1 });
    const participants = line([ana, ben, cid, dan]);

    let res = await edit(rush.id, autoBody({ participants, qualifGroups: [[ana.id, cid.id], [dan.id]] }));
    expect(res.status).toBe(400);

    res = await edit(rush.id, autoBody({ participants, qualifGroups: [[dan.id, cid.id]] }));
    expect(res.status).toBe(200);
    const after = await sessionsOf(rush.id);
    expect(after.map((s) => [s.type, s.status, s.autoGroup])).toEqual([
      [QUALIF, FINISHED, 0],
      [QUALIF, DRAFT, 1],
      [RACE, DRAFT, 0],
      [RACE, DRAFT, 1],
    ]);
    expect(after[1].id).toBe(q2.id);
    expect(after[1].drivers.map((d) => d.driverId)).toEqual([dan.id, cid.id]);
  });

  test('every qualif over: the races to come fill from the ranking, without those who raced or left', async () => {
    const rush = await championship(AUTO, [ana, ben, cid, dan], { driversPerQualif: 4, driversPerRace: 2 });
    const q1 = await session(rush.id, QUALIF, FINISHED, 0, [ana, ben, cid, dan], { autoGroup: 0 });
    const times = { [ana.id]: 7000, [ben.id]: 7100, [cid.id]: 7200, [dan.id]: 7300 };
    for (const [driverId, bestLapTime] of Object.entries(times)) {
      await prisma.sessionDriver.updateMany({ where: { sessionId: q1.id, driverId }, data: { bestLapTime } });
    }
    await session(rush.id, RACE, FINISHED, 1, [ana, ben], { autoGroup: 0 });
    await session(rush.id, RACE, DRAFT, 2, [], { autoGroup: 1 });

    const res = await edit(rush.id, autoBody({ driversPerQualif: 4, participants: line([ana, ben, cid]) }));

    expect(res.status).toBe(200);
    const races = (await sessionsOf(rush.id)).filter((s) => s.type === RACE);
    expect(races.map((r) => r.drivers.map((d) => d.driverId))).toEqual([[ana.id, ben.id], [cid.id]]);
  });
});
