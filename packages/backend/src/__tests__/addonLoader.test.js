import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import express from 'express';
import request from 'supertest';
import { prisma } from './setup.js';
import { readState, recordInstall, disableAddon } from '@racehubos/shared/addons';
import { getDatabasePath } from '../lib/database-url.js';
import { createAddonEvents, mirrorEmits } from '../addons/events.js';
import { createAddonDatabase } from '../addons/database.js';
import { createAddonLog, loadAddons } from '../addons/loader.js';
import { makeAddon, makeRoot, removeRoot } from './helpers/addonFixtures.js';

const quietLogger = () => ({ log: jest.fn(), warn: jest.fn(), error: jest.fn() });

describe('mirrorEmits', () => {
  test('every io.emit also reaches the mirror, and io still gets it', () => {
    const emit = jest.fn(() => true);
    const io = { emit };
    const events = mirrorEmits(io);
    const listener = jest.fn();
    events.on('race:sector', listener);

    expect(io.emit('race:sector', { car: 1 }, 'extra')).toBe(true);
    expect(listener).toHaveBeenCalledWith({ car: 1 }, 'extra');
    expect(emit).toHaveBeenCalledWith('race:sector', { car: 1 }, 'extra');
  });
});

describe('ctx.events', () => {
  let io;
  let core;
  let log;
  let events;

  beforeEach(() => {
    io = { emit: jest.fn(() => true) };
    core = mirrorEmits(io);
    log = { error: jest.fn() };
    events = createAddonEvents(core, log);
  });

  test('a throwing listener is logged and does not stop the event', () => {
    const after = jest.fn();
    events.on('race:leaderboard', () => {
      throw new Error('boom');
    });
    core.on('race:leaderboard', after);

    expect(() => io.emit('race:leaderboard', [])).not.toThrow();
    expect(log.error).toHaveBeenCalledWith('listener for "race:leaderboard" failed:', expect.any(Error));
    expect(after).toHaveBeenCalled();
    expect(io.emit).toBeDefined();
  });

  test('a rejected async listener is logged', async () => {
    events.on('session:finished', async () => {
      throw new Error('later');
    });
    io.emit('session:finished', {});
    await new Promise((resolve) => setImmediate(resolve));
    expect(log.error).toHaveBeenCalledWith('listener for "session:finished" failed:', expect.any(Error));
  });

  test('once fires a single time', () => {
    const listener = jest.fn();
    events.once('cu:status', listener);
    io.emit('cu:status', 1);
    io.emit('cu:status', 2);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(1);
  });

  test('off removes a listener, the same listener is never registered twice', () => {
    const listener = jest.fn();
    events.on('a', listener).on('a', listener);
    io.emit('a');
    expect(listener).toHaveBeenCalledTimes(1);

    events.off('a', listener);
    events.off('a', listener);
    io.emit('a');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  test('one listener on several events', () => {
    const listener = jest.fn();
    events.on('a', listener).on('b', listener);
    events.off('a', listener);
    io.emit('a');
    io.emit('b');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  test('removeAll drops every listener of the add-on only', () => {
    const mine = jest.fn();
    const coreListener = jest.fn();
    events.on('a', mine).once('b', mine);
    core.on('a', coreListener);
    events.removeAll();
    io.emit('a');
    io.emit('b');
    expect(mine).not.toHaveBeenCalled();
    expect(coreListener).toHaveBeenCalled();
  });
});

describe('createAddonLog', () => {
  test('prefixes every line with the add-on id', () => {
    const logger = quietLogger();
    const log = createAddonLog('planner', logger);
    log.info('a');
    log.warn('b');
    log.error('c', 1);
    expect(logger.log).toHaveBeenCalledWith('[addon:planner]', 'a');
    expect(logger.warn).toHaveBeenCalledWith('[addon:planner]', 'b');
    expect(logger.error).toHaveBeenCalledWith('[addon:planner]', 'c', 1);
  });

  test('defaults to the console', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    createAddonLog('x').info('hello');
    expect(spy).toHaveBeenCalledWith('[addon:x]', 'hello');
    spy.mockRestore();
  });
});

describe('add-on database', () => {
  let root;
  let database;

  beforeEach(() => {
    root = makeRoot();
    database = createAddonDatabase({
      dataDir: path.join(root, 'data'),
      id: 'stats',
      coreDatabasePath: getDatabasePath(),
    });
  });
  afterEach(() => {
    database.close();
    removeRoot(root);
  });

  test('is opened once, in the data folder, in WAL mode', () => {
    const db = database.open();
    expect(database.open()).toBe(db);
    expect(fs.existsSync(path.join(root, 'data', 'stats.sqlite'))).toBe(true);
    expect(db.pragma('journal_mode', { simple: true })).toBe('wal');
  });

  test('the core database is attached as core', async () => {
    await prisma.track.create({ data: { name: 'Attached ring' } });
    const row = database.open().prepare("SELECT name FROM core.Track WHERE name = 'Attached ring'").get();
    expect(row).toEqual({ name: 'Attached ring' });
  });

  test('without a core database, nothing is attached', () => {
    const alone = createAddonDatabase({ dataDir: path.join(root, 'alone'), id: 'x', coreDatabasePath: null });
    const names = alone
      .open()
      .pragma('database_list')
      .map((entry) => entry.name);
    expect(names).toEqual(['main']);
    alone.close();
    alone.close();
  });

  test('migrate runs each step once, in order', () => {
    const steps = ['CREATE TABLE best_sector (track_id TEXT, time INTEGER)'];
    expect(database.migrate(steps)).toBe(1);
    expect(database.migrate(steps)).toBe(0);

    steps.push('ALTER TABLE best_sector ADD COLUMN car_id TEXT', (db) =>
      db.exec("INSERT INTO best_sector VALUES ('t', 1, 'c')")
    );
    expect(database.migrate(steps)).toBe(2);
    const db = database.open();
    expect(db.pragma('user_version', { simple: true })).toBe(3);
    expect(db.prepare('SELECT * FROM best_sector').all()).toEqual([{ track_id: 't', time: 1, car_id: 'c' }]);
  });

  test('a failing step changes nothing', () => {
    expect(() => database.migrate(['CREATE TABLE a (x)', 'NOT SQL'])).toThrow();
    const db = database.open();
    expect(db.pragma('user_version', { simple: true })).toBe(0);
    expect(db.prepare("SELECT name FROM sqlite_master WHERE name = 'a'").get()).toBeUndefined();
  });

  test('removing a released step is refused', () => {
    database.migrate(['CREATE TABLE a (x)', 'CREATE TABLE b (x)']);
    expect(() => database.migrate(['CREATE TABLE a (x)'])).toThrow('released steps must never be removed');
  });

  test.each([undefined, 'CREATE TABLE a (x)', [1]])('migrate refuses %p', (steps) => {
    expect(() => database.migrate(steps)).toThrow(TypeError);
  });
});

describe('loadAddons', () => {
  let root;
  let app;
  let io;
  let logger;
  const services = { session: { name: 'session' } };

  const load = (options = {}) =>
    loadAddons({
      rootDir: root,
      app,
      io,
      events: mirrorEmits(io),
      prisma,
      services,
      version: '9.9.9',
      coreDatabasePath: getDatabasePath(),
      logger,
      ...options,
    });

  beforeEach(() => {
    root = makeRoot();
    app = express();
    app.use(express.json());
    io = { emit: jest.fn(() => true) };
    logger = quietLogger();
  });
  afterEach(() => removeRoot(root));

  test('loads an add-on and hands it a complete ctx', async () => {
    makeAddon(root, 'hello', {
      files: {
        'server/index.js': `
          export default function register(ctx) {
            globalThis.__helloCtx = ctx;
            ctx.router.get('/hello', (req, res) => res.json({ id: ctx.id, version: ctx.version }));
          }`,
      },
    });
    const result = await load();
    const ctx = globalThis.__helloCtx;
    delete globalThis.__helloCtx;

    expect(result.loaded).toEqual(['hello']);
    expect(result.failed).toEqual([]);
    expect(Object.keys(ctx).sort()).toEqual(
      [
        'id',
        'manifest',
        'version',
        'router',
        'app',
        'io',
        'events',
        'prisma',
        'extra',
        'services',
        'dataDir',
        'openDatabase',
        'migrate',
        'log',
      ].sort()
    );
    expect(ctx.manifest).toMatchObject({ id: 'hello', version: '0.1.0' });
    expect(ctx.app).toBe(app);
    expect(ctx.io).toBe(io);
    expect(ctx.services).toBe(services);
    expect(ctx.dataDir).toBe(path.join(root, 'addons', '.data', 'hello'));
    expect(fs.existsSync(ctx.dataDir)).toBe(true);

    const res = await request(app).get('/api/addons/hello/hello');
    expect(res.body).toEqual({ id: 'hello', version: '9.9.9' });
    await result.unload();
  });

  test('ctx.events receives what the core emits', async () => {
    makeAddon(root, 'listener', {
      files: {
        'server/index.js': `
          export default (ctx) => {
            ctx.events.on('race:sector', (data) => { globalThis.__sector = data; });
          }`,
      },
    });
    const result = await load();
    io.emit('race:sector', { sector: 2 });
    expect(globalThis.__sector).toEqual({ sector: 2 });
    delete globalThis.__sector;

    await result.unload();
    io.emit('race:sector', { sector: 3 });
    expect(globalThis.__sector).toBeUndefined();
  });

  test('ctx.extra, ctx.prisma and the extras route are the add-on own', async () => {
    const car = await prisma.car.create({ data: { brand: 'BMW', model: 'M4' } });
    makeAddon(root, 'tyres', {
      files: {
        'server/index.js': `
          export default async (ctx) => {
            await ctx.extra.set('car', '${car.id}', { tyre: 'soft' });
            globalThis.__count = await ctx.prisma.carExtra.count();
          }`,
      },
    });
    await prisma.carExtra.create({ data: { carId: car.id, addon: 'other', data: '{}' } });
    const result = await load();
    expect(globalThis.__count).toBe(1);
    delete globalThis.__count;

    const res = await request(app).get(`/api/addons/tyres/extras/car/${car.id}`);
    expect(res.body.data).toEqual({ tyre: 'soft' });
    await result.unload();
  });

  test('ctx.migrate and ctx.openDatabase work on the add-on database', async () => {
    makeAddon(root, 'stats', {
      files: {
        'server/index.js': `
          export default (ctx) => {
            ctx.migrate(['CREATE TABLE t (x)', "INSERT INTO t VALUES ('a')"]);
            globalThis.__rows = ctx.openDatabase().prepare('SELECT x FROM t').all();
          }`,
      },
    });
    const result = await load();
    expect(globalThis.__rows).toEqual([{ x: 'a' }]);
    delete globalThis.__rows;
    expect(fs.existsSync(path.join(root, 'addons/.data/stats/stats.sqlite'))).toBe(true);
    await result.unload();
  });

  test('an add-on without server code still gets its extras route', async () => {
    const car = await prisma.car.create({ data: { brand: 'Audi', model: 'R8' } });
    makeAddon(root, 'web-only', { files: { 'web/index.jsx': 'export default {}' } });
    const result = await load();
    expect(result.loaded).toEqual(['web-only']);
    const res = await request(app).put(`/api/addons/web-only/extras/car/${car.id}`).send({ a: 1 });
    expect(res.body.data).toEqual({ a: 1 });
  });

  test('a named register export is accepted, and async register is awaited', async () => {
    makeAddon(root, 'named', {
      files: {
        'server/index.js': `
          export async function register(ctx) {
            await new Promise((resolve) => setTimeout(resolve, 5));
            ctx.router.get('/ready', (req, res) => res.send('ready'));
          }`,
      },
    });
    await load();
    expect((await request(app).get('/api/addons/named/ready')).text).toBe('ready');
  });

  test('cleanup functions run on unload, a failing one is logged', async () => {
    makeAddon(root, 'clean', {
      files: { 'server/index.js': 'export default () => () => { globalThis.__cleaned = true; }' },
    });
    makeAddon(root, 'dirty', {
      files: {
        'server/index.js': `export default () => () => { throw new Error('cannot clean'); }`,
      },
    });
    const result = await load();
    await result.unload();
    expect(globalThis.__cleaned).toBe(true);
    delete globalThis.__cleaned;
    expect(logger.error).toHaveBeenCalledWith('[addon:dirty]', 'cleanup failed:', expect.any(Error));
  });

  test('an installed add-on that throws is disabled until enabled again', async () => {
    makeAddon(root, 'crashy', {
      files: {
        'server/index.js': `
          export default (ctx) => {
            ctx.router.get('/x', (req, res) => res.send('x'));
            ctx.events.on('race:sector', () => { globalThis.__leaked = true; });
            throw new Error('database missing\\nstack');
          }`,
      },
    });
    recordInstall(root, 'crashy', { source: 'catalog', repo: 'r', ref: 'v1.0.0' });
    const events = mirrorEmits(io);
    const result = await load({ events });

    expect(result.loaded).toEqual([]);
    expect(result.failed).toEqual([{ id: 'crashy', reason: 'database missing' }]);
    expect(readState(root).disabled.crashy.reason).toBe('database missing');
    expect((await request(app).get('/api/addons/crashy/x')).status).toBe(404);
    io.emit('race:sector', {});
    expect(globalThis.__leaked).toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith('[addon:crashy]', 'failed to load, disabled:', expect.any(Error));
  });

  test('a developer folder that throws is only skipped for this run', async () => {
    makeAddon(root, 'wip', { files: { 'server/index.js': 'export default () => { throw "plain"; }' } });
    const result = await load();
    expect(result.failed).toEqual([{ id: 'wip', reason: 'plain' }]);
    expect(readState(root).disabled).toEqual({});
  });

  test('a server file without register is refused', async () => {
    makeAddon(root, 'nothing', { files: { 'server/index.js': 'export const x = 1;' } });
    const result = await load();
    expect(result.failed[0].reason).toMatch(/must export a register\(ctx\) function/);
  });

  test('a server file that does not parse is refused', async () => {
    // Jest's ESM loader reports a real syntax error twice, so the import error is simulated
    makeAddon(root, 'syntax', { files: { 'server/index.js': '' } });
    const importModule = () => Promise.reject(new SyntaxError('Unexpected end of input'));
    const result = await load({ importModule });
    expect(result.failed).toEqual([{ id: 'syntax', reason: 'Unexpected end of input' }]);
    expect(result.loaded).toEqual([]);
  });

  test('disabled and invalid add-ons are not loaded', async () => {
    makeAddon(root, 'off', { files: { 'server/index.js': 'export default () => { globalThis.__off = true; }' } });
    makeAddon(root, 'invalid', { manifest: { version: 'nope' } });
    disableAddon(root, 'off', 'by the user');
    const result = await load();
    expect(result).toMatchObject({ loaded: [], failed: [] });
    expect(globalThis.__off).toBeUndefined();
  });

  test('add-ons load in stack order', async () => {
    const register = (id) => `export default () => { (globalThis.__order ??= []).push('${id}'); }`;
    makeAddon(root, 'b', { files: { 'server/index.js': register('b') } });
    makeAddon(root, 'a', { manifest: { order: 300 }, files: { 'server/index.js': register('a') } });
    makeAddon(root, 'c', { manifest: { order: 1 }, files: { 'server/index.js': register('c') } });
    await load();
    expect(globalThis.__order).toEqual(['c', 'b', 'a']);
    delete globalThis.__order;
  });

  test('uses the given module importer', async () => {
    makeAddon(root, 'injected', { files: { 'server/index.js': '' } });
    const importModule = jest.fn(async () => ({ default: (ctx) => ctx.router.get('/i', (req, res) => res.send('i')) }));
    await load({ importModule });
    expect(importModule).toHaveBeenCalledWith(expect.stringMatching(/^file:.*injected\/server\/index\.js$/));
    expect((await request(app).get('/api/addons/injected/i')).text).toBe('i');
  });

  test('no addons folder, nothing loaded', async () => {
    expect(await load()).toMatchObject({ loaded: [], failed: [] });
  });
});
