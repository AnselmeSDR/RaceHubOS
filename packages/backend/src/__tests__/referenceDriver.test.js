import { prisma } from './setup.js';
import {
  getReferenceDriver,
  setReferenceDriver,
  createStig,
  migrateBalancingLaps,
} from '../lib/referenceDriver.js';

async function makeLap(sessionId, trackId, carId, { phase, driverId = null, lapNumber = 1 }) {
  return prisma.lap.create({
    data: { sessionId, trackId, carId, driverId, controller: 0, phase, lapNumber, lapTime: 8000 },
  });
}

describe('reference driver', () => {
  let track, car;

  beforeEach(async () => {
    await prisma.lap.deleteMany();
    await prisma.sessionDriver.deleteMany();
    await prisma.session.deleteMany();
    await prisma.driver.deleteMany();
    await prisma.car.deleteMany();
    await prisma.track.deleteMany();

    track = await prisma.track.create({ data: { name: 'Test Ring' } });
    car = await prisma.car.create({ data: { brand: 'Test', model: 'GT3' } });
  });

  it('has none configured by default', async () => {
    await prisma.driver.create({ data: { name: 'Anselme' } });
    expect(await getReferenceDriver(prisma)).toBeNull();
  });

  it('creates Le STIG and marks it as reference', async () => {
    const stig = await createStig(prisma);
    expect(stig.name).toBe('Le STIG');
    expect(stig.isReference).toBe(true);
    expect((await getReferenceDriver(prisma)).id).toBe(stig.id);
  });

  it('does not duplicate Le STIG when created twice', async () => {
    const first = await createStig(prisma);
    const second = await createStig(prisma);
    expect(second.id).toBe(first.id);
    expect(await prisma.driver.count({ where: { name: 'Le STIG' } })).toBe(1);
  });

  it('keeps a single reference driver when switching', async () => {
    const stig = await createStig(prisma);
    const other = await prisma.driver.create({ data: { name: 'Touille' } });

    await setReferenceDriver(prisma, other.id);

    expect(await prisma.driver.count({ where: { isReference: true } })).toBe(1);
    expect((await getReferenceDriver(prisma)).id).toBe(other.id);
    expect((await prisma.driver.findUnique({ where: { id: stig.id } })).isReference).toBe(false);
  });

  it('can be cleared', async () => {
    await createStig(prisma);
    await setReferenceDriver(prisma, null);
    expect(await getReferenceDriver(prisma)).toBeNull();
  });

  it('refuses a deleted driver', async () => {
    const gone = await prisma.driver.create({ data: { name: 'Parti', deletedAt: new Date() } });
    await expect(setReferenceDriver(prisma, gone.id)).rejects.toThrow('deleted');
  });

  describe('migrating past balancing laps', () => {
    it('claims laps that had no driver at all', async () => {
      // the real-world case: balancing laps were recorded with driverId = null
      const stig = await createStig(prisma);
      const session = await prisma.session.create({ data: { type: 'balancing', trackId: track.id } });
      await makeLap(session.id, track.id, car.id, { phase: 'balancing', lapNumber: 1 });
      await makeLap(session.id, track.id, car.id, { phase: 'balancing', lapNumber: 2 });
      await prisma.sessionDriver.create({ data: { sessionId: session.id, carId: car.id, controller: 0 } });

      const moved = await migrateBalancingLaps(prisma, stig.id);

      expect(moved).toEqual({ laps: 2, sessionDrivers: 1 });
      expect(await prisma.lap.count({ where: { phase: 'balancing', driverId: stig.id } })).toBe(2);
    });

    it('claims laps that belonged to another driver', async () => {
      const stig = await createStig(prisma);
      const anselme = await prisma.driver.create({ data: { name: 'Anselme' } });
      const session = await prisma.session.create({ data: { type: 'balancing', trackId: track.id } });
      await makeLap(session.id, track.id, car.id, { phase: 'balancing', driverId: anselme.id });

      const moved = await migrateBalancingLaps(prisma, stig.id);

      expect(moved.laps).toBe(1);
      expect(await prisma.lap.count({ where: { driverId: anselme.id } })).toBe(0);
    });

    it('leaves race, qualifying and practice laps untouched', async () => {
      const stig = await createStig(prisma);
      const anselme = await prisma.driver.create({ data: { name: 'Anselme' } });
      const race = await prisma.session.create({ data: { type: 'race', trackId: track.id } });
      for (const phase of ['race', 'qualif', 'practice']) {
        await makeLap(race.id, track.id, car.id, { phase, driverId: anselme.id });
      }

      const moved = await migrateBalancingLaps(prisma, stig.id);

      expect(moved.laps).toBe(0);
      expect(await prisma.lap.count({ where: { driverId: anselme.id } })).toBe(3);
      expect(await prisma.lap.count({ where: { driverId: stig.id } })).toBe(0);
    });

    it('is safe to run twice', async () => {
      const stig = await createStig(prisma);
      const session = await prisma.session.create({ data: { type: 'balancing', trackId: track.id } });
      await makeLap(session.id, track.id, car.id, { phase: 'balancing' });

      await migrateBalancingLaps(prisma, stig.id);
      const second = await migrateBalancingLaps(prisma, stig.id);

      expect(second.laps).toBe(0);
      expect(await prisma.lap.count({ where: { driverId: stig.id } })).toBe(1);
    });
  });
});
