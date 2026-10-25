import { test } from '@jest/globals';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import express from 'express';
import supertest from 'supertest';
import { productEntry, CATALOG_KEY } from '../lib/carreraCatalog.js';
test('isolated test DB: catalogue lookup, article association/update, preserved race fields, tyre cache and invalid input', async () => {
  const dbPath = (await import('../lib/database-url.js')).getDatabasePath();
  assert.ok(dbPath.endsWith('test.db'));
  process.env.DATABASE_URL = `file:${dbPath}`;
  const db = new Database(dbPath);
  const entry = productEntry(
    {
      title: 'Audi R8 LMS GT3',
      handle: '20031063-audi-r8',
      tags: ['Autos', 'DIGITAL 132'],
      variants: [{ sku: '20031063' }],
    },
    'digital-132'
  );
  db.prepare(
    'INSERT INTO Preference(key,value,updatedAt) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value'
  ).run(CATALOG_KEY, JSON.stringify({ version: 1, updatedAt: new Date().toISOString(), entries: [entry] }), Date.now());
  db.close();
  const { default: cars } = await import('../routes/cars.js');
  const { default: catalog } = await import('../routes/catalog.js');
  const app = express();
  app.use(express.json());
  app.use('/api/cars', cars);
  app.use('/api/catalog', catalog);
  const api = supertest(app);
  {
    const found = await api.get('/api/catalog/lookup/31063').expect(200);
    assert.equal(found.body.data.articleNumber, '20031063');
    const created = await api
      .post('/api/cars')
      .send({
        brand: 'Eigene Marke',
        model: 'Eigenes Auto',
        maxSpeed: 30,
        brakeForce: 40,
        fuelCapacity: 80,
        tyresFront: 'Meine Vorderreifen',
        articleNumber: '31063',
      })
      .expect(201);
    const id = created.body.data.id;
    assert.equal(created.body.data.articleNumber, '20031063');
    await api.put(`/api/cars/${id}`).send({ articleNumber: '20031063', model: found.body.data.model }).expect(200);
    const saved = (await api.get(`/api/cars/${id}`).expect(200)).body.data;
    assert.equal(saved.model, 'Audi R8 LMS GT3');
    assert.equal(saved.maxSpeed, 30);
    assert.equal(saved.brakeForce, 40);
    assert.equal(saved.fuelCapacity, 80);
    assert.equal(saved.tyresFront, 'Meine Vorderreifen');
    assert.equal(
      (await api.get('/api/cars?limit=100').expect(200)).body.data.find((c) => c.id === id).articleNumber,
      '20031063'
    );
    const car124 = (
      await api.post('/api/cars').send({ brand: 'ScaleTest', model: 'Scale124', scale: '1:24' }).expect(201)
    ).body.data;
    const car132 = (
      await api.post('/api/cars').send({ brand: 'ScaleTest', model: 'Scale132', scale: '1 / 32' }).expect(201)
    ).body.data;
    const only132 = (await api.get('/api/cars?scale=132&limit=100').expect(200)).body;
    assert.ok(
      only132.data.some((c) => c.id === id),
      'article-only association infers catalogue scale'
    );
    assert.ok(only132.data.some((c) => c.id === car132.id));
    assert.ok(!only132.data.some((c) => c.id === car124.id));
    assert.ok(only132.data.every((c) => c.displayScale === '1:32'));
    const only124 = (await api.get('/api/cars?scale=124&limit=100').expect(200)).body;
    assert.ok(only124.data.some((c) => c.id === car124.id));
    assert.ok(!only124.data.some((c) => c.id === car132.id));
    const page = (await api.get('/api/cars?scale=132&limit=1&offset=0').expect(200)).body;
    assert.equal(page.total, only132.total);
    assert.equal(page.data.length, 1);
    assert.equal(page.hasMore, only132.total > 1);
    await api.get('/api/cars?scale=bad').expect(400);
    await api.put(`/api/cars/${id}`).send({ articleNumber: '../../bad' }).expect(400);
    await api.put(`/api/cars/${id}`).send({ year: '' }).expect(200);
    assert.equal((await api.get(`/api/cars/${id}`)).body.data.year, null);
    await api.put(`/api/cars/${id}`).send({ year: '2023' }).expect(200);
    assert.equal((await api.get(`/api/cars/${id}`)).body.data.year, 2023);
    await api.put(`/api/cars/${id}`).send({ year: 'kein Jahr' }).expect(400);
    assert.equal((await api.get(`/api/cars/${id}`)).body.data.year, 2023);
    await api.put(`/api/cars/${id}`).send({ year: null }).expect(200);
    assert.equal((await api.get(`/api/cars/${id}`)).body.data.year, null);
    const oldFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response(
        '<collapsible-content id="product-ersatzteile-content"><a href="/products/20089800-original-reifen"><div class="inside-products-inhaltose__title">Reifen für Audi</div></a></collapsible-content>'
      );
    try {
      const parts = (await api.post('/api/catalog/tyres/31063/update').expect(200)).body.data;
      assert.equal(parts.parts[0].articleNumber, '20089800');
      assert.equal(
        (await api.get('/api/catalog/tyres/31063').expect(200)).body.data.parts[0].articleNumber,
        '20089800'
      );
    } finally {
      globalThis.fetch = oldFetch;
    }
    const kitt = (await api.get('/api/catalog/lookup/c4226').expect(200)).body.data;
    const delorean = (await api.get('/api/catalog/lookup/H4249').expect(200)).body.data;
    assert.equal(kitt.manufacturer, 'Scalextric');
    assert.equal(delorean.manufacturer, 'Superslot');
    assert.equal((await api.get('/api/catalog/lookup/C4249').expect(200)).body.data.articleNumber, 'H4249');
    const foreign = (
      await api
        .post('/api/cars')
        .send({
          brand: 'Scalextric',
          model: 'Eigener KITT',
          articleNumber: 'c4226',
          maxSpeed: 33,
          tyresRear: 'Eigene Reifen',
        })
        .expect(201)
    ).body.data;
    await api.put(`/api/cars/${foreign.id}`).send({ articleNumber: 'C4249' }).expect(200);
    const foreignSaved = (await api.get(`/api/cars/${foreign.id}`).expect(200)).body.data;
    assert.equal(foreignSaved.articleNumber, 'H4249');
    assert.equal(foreignSaved.maxSpeed, 33);
    assert.equal(foreignSaved.tyresRear, 'Eigene Reifen');
    assert.ok((await api.get('/api/cars?scale=132&limit=100').expect(200)).body.data.some((c) => c.id === foreign.id));
    assert.equal((await api.get('/api/catalog/tyres/C4226').expect(200)).body.data.parts[0].articleNumber, 'W11695');
    assert.equal((await api.get('/api/catalog/tyres/C4249').expect(200)).body.data.parts[0].articleNumber, 'W11255');
    assert.equal(
      (await api.post('/api/catalog/tyres/H4249/update').expect(200)).body.data.parts[0].articleNumber,
      'W11255'
    );
    await api.post('/api/catalog/update').set('Origin', 'https://other.example').expect(403);
  }
});
