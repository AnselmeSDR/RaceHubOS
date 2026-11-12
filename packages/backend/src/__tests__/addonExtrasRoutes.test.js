import express from 'express';
import request from 'supertest';
import { prisma } from './setup.js';
import { createExtras } from '../addons/extras.js';
import carsRouter from '../routes/cars.js';
import driversRouter from '../routes/drivers.js';
import tracksRouter from '../routes/tracks.js';
import divisionsRouter from '../routes/divisions.js';
import championshipsRouter from '../routes/championships.js';
import sessionsRouter, { setSessionService } from '../routes/sessions.js';

// The core API returns every add-on's fields with each record — docs/ADDONS.md § Extra fields
const app = express();
app.use(express.json());
app.use('/api/cars', carsRouter);
app.use('/api/drivers', driversRouter);
app.use('/api/tracks', tracksRouter);
app.use('/api/divisions', divisionsRouter);
app.use('/api/championships', championshipsRouter);
app.use('/api/sessions', sessionsRouter);
setSessionService({ prisma });

const planner = createExtras(prisma, 'track-planner');

const records = {
  car: () => prisma.car.create({ data: { brand: 'Porsche', model: '911' } }),
  driver: () => prisma.driver.create({ data: { name: 'Romain' } }),
  track: () => prisma.track.create({ data: { name: 'Ring' } }),
  division: () => prisma.division.create({ data: { name: 'GOLD', scope: 'driver' } }),
  championship: () => prisma.championship.create({ data: { name: 'Cup', season: '2026' } }),
  session: async () => {
    const track = await prisma.track.create({ data: { name: 'Session ring' } });
    return prisma.session.create({ data: { type: 'race', trackId: track.id } });
  },
};

const paths = {
  car: '/api/cars',
  driver: '/api/drivers',
  track: '/api/tracks',
  division: '/api/divisions',
  championship: '/api/championships',
  session: '/api/sessions',
};

describe.each(Object.keys(records))('%s', (type) => {
  let record;

  beforeEach(async () => {
    record = await records[type]();
    await planner.set(type, record.id, { note: type });
  });

  test('the detail carries the add-on fields', async () => {
    const res = await request(app).get(`${paths[type]}/${record.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.extras).toEqual({ 'track-planner': { note: type } });
  });

  test('the list carries them too', async () => {
    const res = await request(app).get(`${paths[type]}?limit=1000`);
    expect(res.status).toBe(200);
    const listed = res.body.data.find((item) => item.id === record.id);
    expect(listed.extras).toEqual({ 'track-planner': { note: type } });
  });
});
