import express from 'express';
import request from 'supertest';
import { prisma } from './setup.js';
import {
  attachExtras,
  createExtras,
  createExtrasRouter,
  EXTRA_TYPES,
  ExtraError,
  parseExtra,
  scopeExtraArgs,
  scopePrisma,
} from '../addons/extras.js';

const tyres = createExtras(prisma, 'tyre-catalog');
const pits = createExtras(prisma, 'pit-advice');

let car;
let otherCar;

beforeEach(async () => {
  for (const { model } of Object.values(EXTRA_TYPES)) await prisma[model].deleteMany();
  car = await prisma.car.create({ data: { brand: 'Porsche', model: '911 RSR' } });
  otherCar = await prisma.car.create({ data: { brand: 'Ferrari', model: '488' } });
});

describe('ctx.extra', () => {
  test('nothing stored gives {}', async () => {
    expect(await tyres.get('car', car.id)).toEqual({});
    expect(await tyres.all('car')).toEqual({});
  });

  test('set stores and returns the add-on fields', async () => {
    expect(await tyres.set('car', car.id, { tyre: 'soft', grip: 3 })).toEqual({ tyre: 'soft', grip: 3 });
    expect(await tyres.get('car', car.id)).toEqual({ tyre: 'soft', grip: 3 });
  });

  test('set merges, nested objects included, and null removes a field', async () => {
    await tyres.set('car', car.id, { tyre: 'soft', grip: 3, wear: { front: 1, rear: 2 } });
    expect(await tyres.set('car', car.id, { grip: null, wear: { rear: 5 } })).toEqual({
      tyre: 'soft',
      wear: { front: 1, rear: 5 },
    });
  });

  test('each add-on only sees and changes its own fields', async () => {
    await tyres.set('car', car.id, { tyre: 'soft' });
    await pits.set('car', car.id, { tankSize: 15 });
    await pits.set('car', car.id, { tyre: 'oops' });

    expect(await tyres.get('car', car.id)).toEqual({ tyre: 'soft' });
    expect(await pits.get('car', car.id)).toEqual({ tankSize: 15, tyre: 'oops' });

    await pits.remove('car', car.id);
    expect(await pits.get('car', car.id)).toEqual({});
    expect(await tyres.get('car', car.id)).toEqual({ tyre: 'soft' });
  });

  test('all lists the add-on fields per record', async () => {
    await tyres.set('car', car.id, { tyre: 'soft' });
    await tyres.set('car', otherCar.id, { tyre: 'hard' });
    await pits.set('car', car.id, { tankSize: 15 });
    expect(await tyres.all('car')).toEqual({ [car.id]: { tyre: 'soft' }, [otherCar.id]: { tyre: 'hard' } });
  });

  test('works on every record type', async () => {
    const track = await prisma.track.create({ data: { name: 'Ring' } });
    const team = await prisma.team.create({ data: { name: 'Red' } });
    const driver = await prisma.driver.create({ data: { name: 'Andi' } });
    const championship = await prisma.championship.create({ data: { name: 'Cup', season: '2026' } });
    const session = await prisma.session.create({ data: { type: 'race', trackId: track.id } });
    const records = { car, track, team, driver, championship, session };

    for (const [type, record] of Object.entries(records)) {
      await tyres.set(type, record.id, { type });
      expect(await tyres.get(type, record.id)).toEqual({ type });
    }
  });

  test('an unknown record type is refused', async () => {
    await expect(tyres.get('lap', car.id)).rejects.toThrow('Unknown record type "lap"');
    await expect(tyres.set('toString', car.id, {})).rejects.toBeInstanceOf(ExtraError);
  });

  test.each([null, [], 'soft', 3])('set refuses %p as fields', async (fields) => {
    await expect(tyres.set('car', car.id, fields)).rejects.toMatchObject({ status: 400 });
  });

  test('set on a missing record is a 404', async () => {
    await expect(tyres.set('car', 'missing', { tyre: 'soft' })).rejects.toMatchObject({
      message: 'Car "missing" not found',
      status: 404,
    });
  });

  test('other database errors are passed through', async () => {
    const broken = createExtras(
      { $executeRawUnsafe: () => Promise.reject(new Error('disk full')), carExtra: prisma.carExtra },
      'x'
    );
    await expect(broken.set('car', car.id, {})).rejects.toThrow('disk full');
  });

  test('a damaged row reads as {}', async () => {
    await prisma.carExtra.create({ data: { carId: car.id, addon: 'tyre-catalog', data: '{broken' } });
    expect(await tyres.get('car', car.id)).toEqual({});
  });

  test('the fields go away with the record', async () => {
    await tyres.set('car', car.id, { tyre: 'soft' });
    await prisma.car.delete({ where: { id: car.id } });
    expect(await prisma.carExtra.count()).toBe(0);
  });
});

describe('parseExtra', () => {
  test.each([
    ['{"a":1}', { a: 1 }],
    ['[1]', {}],
    ['null', {}],
    ['3', {}],
    ['nope', {}],
  ])('%s', (data, expected) => {
    expect(parseExtra(data)).toEqual(expected);
  });
});

describe('ctx.prisma on extension tables', () => {
  const scoped = scopePrisma(prisma, 'tyre-catalog');

  beforeEach(async () => {
    await tyres.set('car', car.id, { tyre: 'soft' });
    await pits.set('car', car.id, { tankSize: 15 });
    await pits.set('car', otherCar.id, { tankSize: 12 });
  });

  test('reads only its own rows', async () => {
    expect(await scoped.carExtra.findMany()).toHaveLength(1);
    expect(await scoped.carExtra.count()).toBe(1);
    expect(await scoped.carExtra.findMany({ where: { carId: otherCar.id } })).toEqual([]);
    expect(await scoped.carExtra.findFirst({ where: { addon: 'pit-advice' } })).toBeNull();
  });

  test('a unique lookup is pinned to the add-on', async () => {
    const row = await scoped.carExtra.findUnique({
      where: { carId_addon: { carId: car.id, addon: 'pit-advice' } },
    });
    expect(row.addon).toBe('tyre-catalog');
    expect(await scoped.carExtra.findUnique({ where: { carId: otherCar.id } })).toBeNull();
  });

  test('a careless deleteMany only erases its own rows', async () => {
    await scoped.carExtra.deleteMany();
    expect(await prisma.carExtra.count()).toBe(2);
    expect(await pits.get('car', car.id)).toEqual({ tankSize: 15 });
  });

  test('updateMany only touches its own rows and cannot hand them over', async () => {
    await scoped.carExtra.updateMany({ data: { data: '{}', addon: 'pit-advice' } });
    expect(await pits.all('car')).toEqual({ [car.id]: { tankSize: 15 }, [otherCar.id]: { tankSize: 12 } });
    expect(await tyres.get('car', car.id)).toEqual({});
  });

  test('create, upsert, update and delete are pinned to the add-on', async () => {
    await scoped.carExtra.create({ data: { carId: otherCar.id, addon: 'pit-advice', data: '{"a":1}' } });
    expect(await tyres.get('car', otherCar.id)).toEqual({ a: 1 });

    await scoped.carExtra.upsert({
      where: { carId_addon: { carId: otherCar.id, addon: 'pit-advice' } },
      create: { carId: otherCar.id, data: '{}' },
      update: { data: '{"a":2}' },
    });
    expect(await tyres.get('car', otherCar.id)).toEqual({ a: 2 });
    expect(await pits.get('car', otherCar.id)).toEqual({ tankSize: 12 });

    await scoped.carExtra.update({ where: { carId: otherCar.id }, data: { data: '{"a":3}' } });
    expect(await tyres.get('car', otherCar.id)).toEqual({ a: 3 });

    await scoped.carExtra.delete({ where: { carId_addon: { carId: otherCar.id, addon: 'pit-advice' } } });
    expect(await tyres.get('car', otherCar.id)).toEqual({});
    expect(await pits.get('car', otherCar.id)).toEqual({ tankSize: 12 });
  });

  test('createMany is pinned to the add-on', async () => {
    await scoped.carExtra.deleteMany();
    await scoped.carExtra.createMany({ data: [{ carId: car.id, addon: 'pit-advice', data: '{}' }] });
    expect(await scoped.carExtra.count()).toBe(1);
  });

  test('other models are not touched', async () => {
    expect(await scoped.car.count()).toBe(await prisma.car.count());
  });
});

describe('scopeExtraArgs', () => {
  const type = EXTRA_TYPES.car;

  test('a filter without where gets one', () => {
    expect(scopeExtraArgs(type, 'findMany', undefined, 'a')).toEqual({ where: { addon: 'a' } });
  });

  test('createMany accepts a single row', () => {
    expect(scopeExtraArgs(type, 'createMany', { data: { carId: 'c' } }, 'a')).toEqual({
      data: [{ carId: 'c', addon: 'a' }],
    });
  });

  test('createManyAndReturn and updateManyAndReturn are scoped too', () => {
    expect(scopeExtraArgs(type, 'createManyAndReturn', { data: [{ carId: 'c' }] }, 'a').data).toEqual([
      { carId: 'c', addon: 'a' },
    ]);
    expect(scopeExtraArgs(type, 'updateManyAndReturn', { data: {} }, 'a')).toEqual({
      where: { addon: 'a' },
      data: { addon: 'a' },
    });
  });

  test('unknown operations pass through', () => {
    expect(scopeExtraArgs(type, 'somethingNew', { x: 1 }, 'a')).toEqual({ x: 1 });
  });
});

describe('attachExtras', () => {
  beforeEach(async () => {
    await tyres.set('car', car.id, { tyre: 'soft' });
    await pits.set('car', car.id, { tankSize: 15 });
  });

  test('adds every add-on fields to a record', async () => {
    expect((await attachExtras(prisma, 'car', car)).extras).toEqual({
      'tyre-catalog': { tyre: 'soft' },
      'pit-advice': { tankSize: 15 },
    });
  });

  test('adds them to a list, {} for records without', async () => {
    const [first, second] = await attachExtras(prisma, 'car', [car, otherCar]);
    expect(Object.keys(first.extras)).toHaveLength(2);
    expect(second.extras).toEqual({});
  });

  test('leaves nothing and empty lists alone', async () => {
    expect(await attachExtras(prisma, 'car', null)).toBeNull();
    expect(await attachExtras(prisma, 'car', [])).toEqual([]);
  });
});

describe('extras route', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/addons/tyre-catalog', createExtrasRouter(tyres));

  test('PUT then GET', async () => {
    const put = await request(app).put(`/api/addons/tyre-catalog/extras/car/${car.id}`).send({ tyre: 'soft' });
    expect(put.body).toEqual({ success: true, data: { tyre: 'soft' } });

    const get = await request(app).get(`/api/addons/tyre-catalog/extras/car/${car.id}`);
    expect(get.body).toEqual({ success: true, data: { tyre: 'soft' } });
  });

  test('DELETE', async () => {
    await tyres.set('car', car.id, { tyre: 'soft' });
    const res = await request(app).delete(`/api/addons/tyre-catalog/extras/car/${car.id}`);
    expect(res.body).toEqual({ success: true, data: {} });
    expect(await tyres.get('car', car.id)).toEqual({});
  });

  test('errors carry their status', async () => {
    const unknown = await request(app).get(`/api/addons/tyre-catalog/extras/lap/${car.id}`);
    expect(unknown.status).toBe(400);
    expect(unknown.body.success).toBe(false);

    const badBody = await request(app).put(`/api/addons/tyre-catalog/extras/car/${car.id}`).send([1]);
    expect(badBody.status).toBe(400);

    const missing = await request(app).put('/api/addons/tyre-catalog/extras/car/missing').send({});
    expect(missing.status).toBe(404);
  });

  test('unexpected errors are a 500', async () => {
    const failing = express();
    failing.use(
      createExtrasRouter({
        get: () => Promise.reject(new Error('boom')),
      })
    );
    const res = await request(failing).get('/extras/car/x');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ success: false, error: 'boom' });
  });
});
