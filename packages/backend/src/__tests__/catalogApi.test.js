import { jest, test, expect } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import catalog from '../routes/catalog.js';
import cars from '../routes/cars.js';
import { prisma } from './setup.js';

const app = express();
app.use(express.json());
app.use('/api/catalog', catalog);
app.use('/api/cars', cars);
const api = request(app);
const sample = {
  serial: 'LOCAL-1',
  brand: 'Own photo',
  model: 'Example',
  scale: '1:32',
  year: 1888,
  tyresFront: 'Front reference',
  tyresRear: 'Rear reference',
  img: '/api/img/cars/local-photo.jpg',
};

test('empty local catalog, manual CRUD, strict atomic JSON import and zero network calls', async () => {
  await prisma.catalogEntry.deleteMany();
  const network = jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network forbidden'));
  try {
    expect((await api.get('/api/catalog')).body.data).toEqual([]);
    await api.get('/api/catalog/lookup/LOCAL-1').expect(404);
    await api.put('/api/catalog/LOCAL-1').send(sample).expect(200);
    expect((await api.get('/api/catalog/lookup/LOCAL-1')).body.data.year).toBe(1888);
    await api
      .post('/api/catalog/import')
      .send({
        version: 1,
        entries: [
          { ...sample, model: 'Must roll back' },
          { serial: 'INVALID', brand: 'Missing model' },
        ],
      })
      .expect(400);
    expect((await api.get('/api/catalog/lookup/LOCAL-1')).body.data.model).toBe('Example');
    await api
      .post('/api/catalog/import')
      .send({ version: 1, entries: [sample, sample] })
      .expect(400);
    await api.post('/api/catalog/import').send({ version: 2, entries: [] }).expect(400);
    for (const img of ['https://shop.example/car.jpg', '/api/img/cars/../private.jpg', 'file:///tmp/a.png']) {
      await api
        .put('/api/catalog/LOCAL-1')
        .send({ ...sample, img })
        .expect(400);
    }
    await api
      .put('/api/catalog/LOCAL-1')
      .send({ ...sample, manufacturer: 'unknown' })
      .expect(400);
    await api
      .post('/api/catalog/import')
      .send({
        version: 1,
        entries: [
          { ...sample, model: 'Updated' },
          { ...sample, serial: 'LOCAL-2', year: null },
        ],
      })
      .expect(200);
    expect((await api.get('/api/catalog')).body.data).toHaveLength(2);
    expect((await api.get('/api/catalog/lookup/LOCAL-1')).body.data.model).toBe('Updated');
    await api.delete('/api/catalog/LOCAL-2').expect(200);
    expect((await api.get('/api/catalog')).body.data).toHaveLength(1);
    expect(network).not.toHaveBeenCalled();
  } finally {
    network.mockRestore();
  }
});

test('catalog values persist in Car columns without changing race settings or creating preferences', async () => {
  const created = await api
    .post('/api/cars')
    .send({
      brand: 'My brand',
      model: 'My car',
      maxSpeed: 30,
      brakeForce: 40,
      fuelCapacity: 80,
      motor: 'Mounted motor',
      tyresFront: 'Mounted tyres',
    })
    .expect(201);
  const id = created.body.data.id;
  const preferencesBefore = await prisma.preference.count();
  await api.put(`/api/cars/${id}`).send(sample).expect(200);
  const saved = (await api.get(`/api/cars/${id}`).expect(200)).body.data;
  for (const [key, value] of Object.entries(sample)) expect(saved[key]).toBe(value);
  expect(saved.motor).toBe('Mounted motor');
  expect(saved.maxSpeed).toBe(30);
  expect(saved.brakeForce).toBe(40);
  expect(saved.fuelCapacity).toBe(80);
  expect((await prisma.car.findUnique({ where: { id } })).serial).toBe('LOCAL-1');
  expect(await prisma.preference.count()).toBe(preferencesBefore);
  await api.put(`/api/cars/${id}`).send({ serial: '', year: null }).expect(200);
  expect((await api.get(`/api/cars/${id}`)).body.data.serial).toBeNull();
  expect((await api.get(`/api/cars/${id}`)).body.data.year).toBeNull();
  await api.delete('/api/catalog/LOCAL-1').expect(200);
  expect((await api.get(`/api/cars/${id}`)).body.data.tyresRear).toBe(sample.tyresRear);
});

test('catalog exports round-trip through the same importer without timestamps or writes', async () => {
  await prisma.catalogEntry.deleteMany();
  const empty = await api.get('/api/catalog/export').expect(200);
  expect(empty.body).toEqual({ version: 2, entries: [], images: {} });
  await api.post('/api/catalog/import').send(empty.body).expect(200);
  const serial = 'Own / article ü';
  const entry = { ...sample, img: null, serial, year: null, widthMm: 62.5, notes: 'Größe · détails' };
  await api
    .put(`/api/catalog/${encodeURIComponent(serial)}`)
    .send(entry)
    .expect(200);
  await api
    .put('/api/catalog/SECOND')
    .send({ ...sample, img: null, serial: 'SECOND' })
    .expect(200);
  for (const url of ['/api/catalog/export', `/api/catalog/export/${encodeURIComponent(serial)}`]) {
    const before = (await api.get('/api/catalog')).body.data;
    const exported = await api.get(url).expect(200);
    expect(exported.headers['content-disposition']).toMatch(/^attachment;/);
    expect(exported.headers['content-type']).toContain('application/json');
    expect((await api.get('/api/catalog')).body.data).toEqual(before);
    expect(exported.body.version).toBe(2);
    expect(exported.body.entries).toHaveLength(url === '/api/catalog/export' ? 2 : 1);
    expect(exported.body.entries.find((row) => row.serial === serial)).toMatchObject(entry);
    for (const row of exported.body.entries) {
      expect(row).not.toHaveProperty('createdAt');
      expect(row).not.toHaveProperty('updatedAt');
    }
    await api.delete(`/api/catalog/${encodeURIComponent(serial)}`).expect(200);
    await api.post('/api/catalog/import').send(exported.body).expect(200);
    expect((await api.get(`/api/catalog/lookup/${encodeURIComponent(serial)}`)).body.data).toMatchObject(entry);
    expect((await api.get('/api/catalog/lookup/SECOND')).body.data.serial).toBe('SECOND');
  }
  await api.get('/api/catalog/export/NOT-FOUND').expect(404);
});
