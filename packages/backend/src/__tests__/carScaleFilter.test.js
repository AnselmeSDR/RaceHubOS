import express from 'express';
import request from 'supertest';
import cars from '../routes/cars.js';
import { prisma } from './setup.js';

const app = express();
app.use('/api/cars', cars);
const api = request(app);

beforeAll(async () => {
  await prisma.car.createMany({
    data: [
      { id: 'scale-32-a', brand: 'A', model: '32 fast', scale: '1:32', bestLap: 1000 },
      { id: 'scale-32-b', brand: 'B', model: '32 slow', scale: '1:32', bestLap: 3000 },
      { id: 'scale-24', brand: 'C', model: '24', scale: '1:24', bestLap: 2000 },
      { id: 'scale-43', brand: 'Z', model: '43', scale: '1:43' },
      { id: 'scale-none', brand: 'D', model: 'No scale' },
      { id: 'scale-empty', brand: 'E', model: 'Empty scale', scale: '' },
      { id: 'scale-deleted', brand: 'F', model: 'Deleted', scale: '1:64', deletedAt: new Date() },
    ],
  });
});

test('exact single and comma-separated multi-scale filtering, without assuming a fixed scale list', async () => {
  const single = (await api.get('/api/cars').query({ scale: '1:32' }).expect(200)).body;
  expect(single.data.map((car) => car.id)).toEqual(['scale-32-a', 'scale-32-b']);
  expect(single.total).toBe(2);
  const multi = (await api.get('/api/cars').query({ scale: '1:32,1:24' }).expect(200)).body;
  expect(multi.data.map((car) => car.id)).toEqual(['scale-32-a', 'scale-32-b', 'scale-24']);
  expect(multi.total).toBe(3);
  const custom = (await api.get('/api/cars').query({ scale: '1:43' }).expect(200)).body;
  expect(custom.data.map((car) => car.id)).toEqual(['scale-43']);
  expect((await api.get('/api/cars').query({ scale: '1:3' })).body.total).toBe(0);
});

test('pagination and computed best-lap sorting happen after filtering; options cover all pages', async () => {
  const page = (await api.get('/api/cars').query({ scale: '1:32,1:24', limit: 1, offset: 1 }).expect(200)).body;
  expect(page.data.map((car) => car.id)).toEqual(['scale-32-b']);
  expect(page.total).toBe(3);
  expect(page.hasMore).toBe(true);
  expect(page.scales).toEqual(['1:24', '1:32', '1:43']);
  const last = (
    await api
      .get('/api/cars')
      .query({ scale: '1:32', sortBy: 'bestLap', sortOrder: 'desc', limit: 1, offset: 1 })
      .expect(200)
  ).body;
  expect(last.data.map((car) => car.id)).toEqual(['scale-32-a']);
  expect(last.total).toBe(2);
  expect(last.hasMore).toBe(false);
});

test('clearing the filter retains cars without a scale; deleted scales stay in the deleted view', async () => {
  for (const query of [{}, { scale: '' }]) {
    const response = (await api.get('/api/cars').query(query).expect(200)).body;
    expect(response.total).toBe(6);
    expect(response.data.map((car) => car.id)).toEqual(expect.arrayContaining(['scale-none', 'scale-empty']));
    expect(response.scales).toEqual(['1:24', '1:32', '1:43']);
  }
  const deleted = (await api.get('/api/cars').query({ deleted: 'true', scale: '1:64' }).expect(200)).body;
  expect(deleted.data.map((car) => car.id)).toEqual(['scale-deleted']);
  expect(deleted.scales).toEqual(['1:64']);
  const empty = (await api.get('/api/cars').query({ scale: 'unknown', limit: 1 }).expect(200)).body;
  expect(empty.data).toEqual([]);
  expect(empty.total).toBe(0);
  expect(empty.hasMore).toBe(false);
});
