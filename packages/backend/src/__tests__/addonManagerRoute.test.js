import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { AddonActionError } from '../addons/manager.js';
import { createAddonManagerRouter, PROGRESS_EVENT } from '../routes/addonManager.js';

// The route only sequences: checks answer at once, the work goes on with progress events
function setup({ prepare, list } = {}) {
  const work = { resolve: null, reject: null };
  const manager = {
    list: jest.fn(list ?? (async () => ({ addons: [] }))),
    prepare: jest.fn(
      prepare ??
        (async (action, params) => ({
          addon: params.id ?? 'from-link',
          run: (emit) => {
            emit('download');
            return new Promise((resolve, reject) => Object.assign(work, { resolve, reject }));
          },
        }))
    ),
  };
  const io = { emit: jest.fn() };
  const restart = jest.fn();
  const log = { error: jest.fn() };
  const { router, whenIdle } = createAddonManagerRouter({ manager, io, restart, log });
  const app = express();
  app.use(express.json());
  app.use('/api/addon-manager', router);
  return { app, manager, io, restart, log, work, whenIdle };
}

const progress = (io) => io.emit.mock.calls.filter(([event]) => event === PROGRESS_EVENT).map(([, payload]) => payload);

test('GET lists the add-ons', async () => {
  const { app } = setup({ list: async () => ({ addons: [{ id: 'a' }] }) });
  const res = await request(app).get('/api/addon-manager');
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ success: true, data: { addons: [{ id: 'a' }] } });
});

test('GET reports a failing list', async () => {
  const { app } = setup({
    list: async () => {
      throw new Error('disk gone');
    },
  });
  const res = await request(app).get('/api/addon-manager');
  expect(res.status).toBe(500);
  expect(res.body).toEqual({ success: false, error: 'disk gone' });
});

test('an action answers once checked, reports its steps, then restarts the app', async () => {
  const { app, manager, io, restart, work, whenIdle } = setup();
  const res = await request(app).post('/api/addon-manager/install').send({ id: 'hello' });
  expect(res.status).toBe(202);
  expect(res.body).toEqual({ success: true, data: { action: 'install', addon: 'hello' } });
  expect(manager.prepare).toHaveBeenCalledWith('install', { id: 'hello', repo: undefined });

  work.resolve();
  await whenIdle();
  expect(progress(io)).toEqual([
    { action: 'install', addon: 'hello', step: 'download', status: 'running' },
    { action: 'install', addon: 'hello', step: 'restart', status: 'complete' },
  ]);
  expect(restart).toHaveBeenCalledTimes(1);

  // The app is restarting: nothing else starts meanwhile
  const again = await request(app).post('/api/addon-manager/hello/update');
  expect(again.status).toBe(409);
});

test('one action at a time', async () => {
  const { app, work, whenIdle } = setup();
  await request(app).post('/api/addon-manager/install').send({ repo: 'https://x/a.git' });
  const second = await request(app).post('/api/addon-manager/a/disable');
  expect(second.status).toBe(409);
  expect(second.body.error).toMatch(/already running|another/);
  work.reject(new Error('x'));
  await whenIdle();
});

test('a failed action reports its error, frees the route and does not restart', async () => {
  const { app, io, restart, log, work, whenIdle } = setup();
  await request(app).post('/api/addon-manager/hello/update');
  work.reject(new Error('build failed: boom'));
  await whenIdle();

  expect(progress(io).at(-1)).toEqual({
    action: 'update',
    addon: 'hello',
    step: 'error',
    status: 'error',
    error: 'build failed: boom',
  });
  expect(restart).not.toHaveBeenCalled();
  expect(log.error).toHaveBeenCalled();

  const next = await request(app).post('/api/addon-manager/hello/enable');
  expect(next.status).toBe(202);
});

test('a refused action answers with its status and frees the route', async () => {
  const { app } = setup({
    prepare: async () => {
      throw new AddonActionError(404, '"x" is not in the catalog');
    },
  });
  const res = await request(app).post('/api/addon-manager/install').send({ id: 'x' });
  expect(res.status).toBe(404);
  expect(res.body).toEqual({ success: false, error: '"x" is not in the catalog' });
  expect((await request(app).post('/api/addon-manager/install').send({ id: 'x' })).status).toBe(404);
});

test('an unexpected error while checking is a 500', async () => {
  const { app } = setup({
    prepare: async () => {
      throw new Error('state unreadable');
    },
  });
  expect((await request(app).post('/api/addon-manager/x/enable')).status).toBe(500);
});

test.each([
  ['post', '/api/addon-manager/hello/update', 'update', { id: 'hello' }],
  ['post', '/api/addon-manager/hello/enable', 'enable', { id: 'hello' }],
  ['post', '/api/addon-manager/hello/disable', 'disable', { id: 'hello' }],
  ['delete', '/api/addon-manager/hello', 'uninstall', { id: 'hello', deleteData: false }],
  ['delete', '/api/addon-manager/hello?delete_data=1', 'uninstall', { id: 'hello', deleteData: true }],
])('%s %s → %s', async (method, url, action, params) => {
  const { app, manager, work, whenIdle } = setup();
  expect((await request(app)[method](url)).status).toBe(202);
  expect(manager.prepare).toHaveBeenCalledWith(action, params);
  work.reject(new Error('stop'));
  await whenIdle();
});

test('without io, an action still runs', async () => {
  const manager = { prepare: async () => ({ addon: 'a', run: async (emit) => emit('build') }) };
  const restart = jest.fn();
  const { router, whenIdle } = createAddonManagerRouter({ manager, restart });
  const app = express().use('/m', router);
  await request(app).post('/m/a/enable');
  await whenIdle();
  expect(restart).toHaveBeenCalled();
});

test('by default a success restarts with exit code 42, for the launcher', async () => {
  jest.useFakeTimers();
  const exit = jest.spyOn(process, 'exit').mockImplementation(() => {});
  try {
    const manager = { prepare: async () => ({ addon: 'a', run: async () => {} }) };
    const { router, whenIdle } = createAddonManagerRouter({ manager });
    await request(express().use('/m', router)).post('/m/a/enable');
    await whenIdle();
    expect(exit).not.toHaveBeenCalled();
    jest.advanceTimersByTime(2000);
    expect(exit).toHaveBeenCalledWith(42);
  } finally {
    exit.mockRestore();
    jest.useRealTimers();
  }
});
