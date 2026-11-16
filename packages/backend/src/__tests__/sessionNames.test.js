import express from 'express';
import request from 'supertest';
import { prisma } from './setup.js';
import championshipsRouter, { setChampionshipService } from '../routes/championships.js';
import { ChampionshipService } from '../services/ChampionshipService.js';
import { sessionName } from '../lib/sessionNames.js';

/**
 * Sessions the server creates on its own are named in the interface language,
 * sent by the client; without it they fall back to English, never to French.
 */
describe('names of the sessions created by the server', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/championships', championshipsRouter);
  setChampionshipService(new ChampionshipService(null));

  const german = { practice: 'Freies Training', qualif: 'Qualifikation', race: 'Rennen' };
  let track, drivers;

  beforeEach(async () => {
    await prisma.sessionDriver.deleteMany();
    await prisma.championshipParticipant.deleteMany();
    await prisma.session.deleteMany();
    await prisma.championship.deleteMany();
    await prisma.driver.deleteMany();
    await prisma.track.deleteMany();

    track = await prisma.track.create({ data: { name: 'Ring' } });
    drivers = await Promise.all(
      ['Alexis', 'Romain', 'Lisa', 'Jordan'].map((name) => prisma.driver.create({ data: { name } }))
    );
  });

  const createAuto = (extra = {}) =>
    request(app)
      .post('/api/championships')
      .send({
        name: 'Rush',
        season: '2026',
        trackId: track.id,
        mode: 'auto',
        driversPerQualif: 2,
        driversPerRace: 4,
        participants: drivers.map((d) => ({ driverId: d.id })),
        ...extra,
      });

  const namesOf = async (championshipId) =>
    (await prisma.session.findMany({ where: { championshipId }, orderBy: { order: 'asc' } })).map((s) => s.name);

  it('uses the names sent by the interface', async () => {
    const res = await createAuto({ sessionNames: german });

    expect(res.status).toBe(201);
    expect(await namesOf(res.body.data.id)).toEqual([
      'Freies Training',
      'Qualifikation 1',
      'Qualifikation 2',
      'Rennen 1',
    ]);
  });

  it('falls back to English when none are sent', async () => {
    const res = await createAuto();

    expect(await namesOf(res.body.data.id)).toEqual(['Free Practice', 'Qualifying 1', 'Qualifying 2', 'Race 1']);
  });

  it('names the sessions an edit adds in the interface language, numbered among their type', async () => {
    const { body } = await createAuto({ sessionNames: german });
    const ids = drivers.map((d) => d.id);

    const res = await request(app)
      .put(`/api/championships/${body.data.id}/plan`)
      .send({
        name: 'Rush',
        mode: 'auto',
        driversPerQualif: 2,
        driversPerRace: 4,
        participants: ids.map((driverId) => ({ driverId })),
        practiceGroups: [ids.slice(0, 2), ids.slice(2)],
        qualifGroups: [ids.slice(0, 2), ids.slice(2)],
        sessionNames: german,
      });

    expect(res.status).toBe(200);
    expect(await namesOf(body.data.id)).toEqual([
      'Freies Training',
      'Freies Training 2',
      'Qualifikation 1',
      'Qualifikation 2',
      'Rennen 1',
    ]);
  });

  it('names a session of an unknown type like a practice', () => {
    expect(sessionName('endurance')).toBe('Free Practice');
  });
});
