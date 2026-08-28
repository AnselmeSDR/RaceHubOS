import express from 'express';
import request from 'supertest';
import { prisma } from './setup.js';
import championshipsRouter, { setChampionshipService } from '../routes/championships.js';

/**
 * Replacing the participant list must keep the trace of those removed:
 * hidden, not erased — and putting a driver back must revive their row rather
 * than clash with the unique constraint on (championshipId, driverId).
 */
describe('PUT /api/championships/:id/participants', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/championships', championshipsRouter);

  // The route regenerates auto sessions afterwards; not under test here
  setChampionshipService({ generateAutoSessions: async () => {} });

  let championship, alexis, romain, lisa;

  beforeEach(async () => {
    await prisma.championshipParticipant.deleteMany();
    await prisma.session.deleteMany();
    await prisma.championship.deleteMany();
    await prisma.driver.deleteMany();
    await prisma.track.deleteMany();

    const track = await prisma.track.create({ data: { name: 'Ring' } });
    alexis = await prisma.driver.create({ data: { name: 'Alexis' } });
    romain = await prisma.driver.create({ data: { name: 'Romain' } });
    lisa = await prisma.driver.create({ data: { name: 'Lisa' } });
    championship = await prisma.championship.create({
      data: { name: 'Rush', season: '2026', trackId: track.id, mode: 'auto' },
    });
    await prisma.championshipParticipant.createMany({
      data: [
        { championshipId: championship.id, driverId: alexis.id, order: 0 },
        { championshipId: championship.id, driverId: romain.id, order: 1 },
        { championshipId: championship.id, driverId: lisa.id, order: 2 },
      ],
    });
  });

  const setParticipants = (driverIds) =>
    request(app)
      .put(`/api/championships/${championship.id}/participants`)
      .send({ participants: driverIds.map((driverId) => ({ driverId })) });

  it('hides a removed participant instead of erasing them', async () => {
    const res = await setParticipants([alexis.id, lisa.id]);

    expect(res.status).toBe(200);
    expect(res.body.data.participants).toHaveLength(2);
    expect(res.body.data.participants.map((p) => p.driverId)).not.toContain(romain.id);

    // the row survives, merely hidden
    const romainRow = await prisma.championshipParticipant.findFirst({ where: { driverId: romain.id } });
    expect(romainRow).not.toBeNull();
    expect(romainRow.deletedAt).not.toBeNull();
  });

  it('revives a participant put back, without duplicating them', async () => {
    await setParticipants([alexis.id, lisa.id]);
    const res = await setParticipants([alexis.id, lisa.id, romain.id]);

    expect(res.status).toBe(200);
    expect(res.body.data.participants).toHaveLength(3);

    const rows = await prisma.championshipParticipant.findMany({ where: { driverId: romain.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].deletedAt).toBeNull();
  });

  it('keeps the requested order', async () => {
    const res = await setParticipants([romain.id, alexis.id, lisa.id]);

    expect(res.body.data.participants.map((p) => p.driverId)).toEqual([romain.id, alexis.id, lisa.id]);
  });

  it('still refuses a list of fewer than two participants', async () => {
    const res = await setParticipants([alexis.id]);

    expect(res.status).toBe(400);
    // nothing was hidden by the rejected request
    expect(await prisma.championshipParticipant.count({ where: { deletedAt: null } })).toBe(3);
  });
});
