import { prisma } from './setup.js';
import {
  softDeleteTrack, restoreTrack,
  softDeleteDriver, restoreDriver,
  softDeleteCar, restoreCar,
} from '../lib/softDelete.js';

/** Build a track with a championship, a session, drivers, cars, laps and a record. */
async function buildFixture() {
  const track = await prisma.track.create({ data: { name: 'Ring' } });
  const other = await prisma.track.create({ data: { name: 'Autre circuit' } });
  const driver = await prisma.driver.create({ data: { name: 'Anselme' } });
  const car = await prisma.car.create({ data: { brand: 'AMG', model: 'GT3' } });

  const championship = await prisma.championship.create({
    data: { name: 'Rush', season: '2026', trackId: track.id },
  });
  const session = await prisma.session.create({
    data: { type: 'race', trackId: track.id, championshipId: championship.id },
  });
  const loneSession = await prisma.session.create({ data: { type: 'practice', trackId: track.id } });
  const elsewhere = await prisma.session.create({ data: { type: 'race', trackId: other.id } });

  const lap = (sessionId, trackId) => prisma.lap.create({
    data: { sessionId, trackId, carId: car.id, driverId: driver.id, controller: 0, phase: 'race', lapNumber: 1, lapTime: 8000 },
  });
  await lap(session.id, track.id);
  await lap(loneSession.id, track.id);
  await lap(elsewhere.id, other.id);

  await prisma.sessionDriver.create({ data: { sessionId: session.id, driverId: driver.id, carId: car.id, controller: 0 } });
  await prisma.sessionDriver.create({ data: { sessionId: elsewhere.id, driverId: driver.id, carId: car.id, controller: 0 } });
  await prisma.trackRecord.create({ data: { trackId: track.id, driverId: driver.id, carId: car.id, lapTime: 8000 } });
  await prisma.championshipParticipant.create({ data: { championshipId: championship.id, driverId: driver.id } });

  return { track, other, driver, car, championship, session, loneSession, elsewhere };
}

const activeCounts = async () => ({
  laps: await prisma.lap.count({ where: { deletedAt: null } }),
  sessions: await prisma.session.count({ where: { deletedAt: null } }),
  sessionDrivers: await prisma.sessionDriver.count({ where: { deletedAt: null } }),
  championships: await prisma.championship.count({ where: { deletedAt: null } }),
  trackRecords: await prisma.trackRecord.count({ where: { deletedAt: null } }),
  participations: await prisma.championshipParticipant.count({ where: { deletedAt: null } }),
  drivers: await prisma.driver.count({ where: { deletedAt: null } }),
  cars: await prisma.car.count({ where: { deletedAt: null } }),
});

beforeEach(async () => {
  await prisma.trackRecord.deleteMany();
  await prisma.championshipParticipant.deleteMany();
  await prisma.lap.deleteMany();
  await prisma.sessionDriver.deleteMany();
  await prisma.session.deleteMany();
  await prisma.championship.deleteMany();
  await prisma.driver.deleteMany();
  await prisma.car.deleteMany();
  await prisma.track.deleteMany();
});

describe('deleting a track', () => {
  it('hides its championships, sessions, session drivers, laps and records', async () => {
    const f = await buildFixture();

    const counts = await softDeleteTrack(prisma, f.track.id);

    expect(counts).toMatchObject({ championships: 1, sessions: 2, sessionDrivers: 1, laps: 2, trackRecords: 1, participations: 1 });
    const after = await activeCounts();
    expect(after).toMatchObject({ laps: 1, sessions: 1, championships: 0, trackRecords: 0 });
    // drivers and cars are deliberately spared
    expect(after.drivers).toBe(1);
    expect(after.cars).toBe(1);
  });

  it('leaves another track untouched', async () => {
    const f = await buildFixture();
    await softDeleteTrack(prisma, f.track.id);

    expect((await prisma.session.findUnique({ where: { id: f.elsewhere.id } })).deletedAt).toBeNull();
    expect((await prisma.track.findUnique({ where: { id: f.other.id } })).deletedAt).toBeNull();
  });

  it('stamps every row with the same timestamp', async () => {
    const f = await buildFixture();
    const { deletedAt } = await softDeleteTrack(prisma, f.track.id);

    const track = await prisma.track.findUnique({ where: { id: f.track.id } });
    const lap = await prisma.lap.findFirst({ where: { trackId: f.track.id } });
    expect(track.deletedAt.getTime()).toBe(deletedAt.getTime());
    expect(lap.deletedAt.getTime()).toBe(deletedAt.getTime());
  });

  it('restores exactly what it hid', async () => {
    const f = await buildFixture();
    const before = await activeCounts();

    await softDeleteTrack(prisma, f.track.id);
    await restoreTrack(prisma, f.track.id);

    expect(await activeCounts()).toEqual(before);
  });

  it('leaves rows deleted beforehand deleted', async () => {
    const f = await buildFixture();
    // this session was deleted on its own, long before the track
    await prisma.session.update({ where: { id: f.loneSession.id }, data: { deletedAt: new Date('2026-01-01') } });

    await softDeleteTrack(prisma, f.track.id);
    await restoreTrack(prisma, f.track.id);

    const lone = await prisma.session.findUnique({ where: { id: f.loneSession.id } });
    expect(lone.deletedAt).toEqual(new Date('2026-01-01'));
  });
});

describe('deleting a driver', () => {
  it('hides their laps and session entries, but not the sessions', async () => {
    const f = await buildFixture();

    const counts = await softDeleteDriver(prisma, f.driver.id);

    expect(counts).toMatchObject({ laps: 3, sessionDrivers: 2, trackRecords: 1, participations: 1 });
    const after = await activeCounts();
    expect(after.laps).toBe(0);
    expect(after.trackRecords).toBe(0);
    // the participation row survives, merely hidden: the driver stays traceable
    expect(after.participations).toBe(0);
    expect(await prisma.championshipParticipant.count()).toBe(1);
    expect(after.sessions).toBe(3);
    expect(after.championships).toBe(1);
  });

  it('restores exactly what it hid', async () => {
    const f = await buildFixture();
    const before = await activeCounts();

    await softDeleteDriver(prisma, f.driver.id);
    await restoreDriver(prisma, f.driver.id);

    expect(await activeCounts()).toEqual(before);
  });
});

describe('deleting a car', () => {
  it('hides its laps and session entries, but not the sessions', async () => {
    const f = await buildFixture();

    const counts = await softDeleteCar(prisma, f.car.id);

    expect(counts).toMatchObject({ laps: 3, sessionDrivers: 2, trackRecords: 1 });
    const after = await activeCounts();
    expect(after.laps).toBe(0);
    expect(after.trackRecords).toBe(0);
    expect(after.sessions).toBe(3);
  });

  it('restores exactly what it hid', async () => {
    const f = await buildFixture();
    const before = await activeCounts();

    await softDeleteCar(prisma, f.car.id);
    await restoreCar(prisma, f.car.id);

    expect(await activeCounts()).toEqual(before);
  });
});
