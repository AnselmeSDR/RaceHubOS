import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const applyUpdate = jest.fn();
const checkForUpdate = jest.fn(async () => ({ currentVersion: '1.2.0', updateAvailable: false }));
jest.unstable_mockModule('../lib/update.js', () => ({ applyUpdate, checkForUpdate }));
const { default: router, setUpdateIo } = await import('../routes/update.js');

const app = express();
app.use('/api/update', router);
const api = request(app);
const io = { emit: jest.fn() };
setUpdateIo(io);

beforeEach(() => {
  io.emit.mockClear();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

/** Resolves on the progress event that ends the update. */
const ended = () =>
  new Promise((resolve) => {
    io.emit.mockImplementation((event, progress) => {
      if (progress.status !== 'running') resolve(progress);
    });
  });

test('the check answers what GitHub says', async () => {
  expect((await api.get('/api/update/check')).body).toEqual({
    success: true,
    data: { currentVersion: '1.2.0', updateAvailable: false },
  });
});

test('an applied update reports its progress, then restarts with code 42', async () => {
  const exit = jest.spyOn(process, 'exit').mockImplementation(() => {});
  const realSetTimeout = global.setTimeout;
  let restart;
  jest.spyOn(global, 'setTimeout').mockImplementation((fn, ms, ...args) => {
    if (ms !== 2000) return realSetTimeout(fn, ms, ...args);
    restart = fn;
  });
  applyUpdate.mockImplementationOnce(async ({ emit }) => {
    emit(1, 'Sauvegarde...');
    return '1.3.0';
  });
  const end = ended();
  expect((await api.post('/api/update/apply')).body).toEqual({ success: true, message: 'Mise à jour lancée' });
  expect(await end).toEqual({ step: 7, message: 'Mise à jour v1.3.0 terminée. Redémarrage...', status: 'complete' });
  expect(io.emit).toHaveBeenCalledWith('update:progress', { step: 1, message: 'Sauvegarde...', status: 'running' });

  expect(exit).not.toHaveBeenCalled();
  restart();
  expect(exit).toHaveBeenCalledWith(42);
});

test('one update at a time; a failure is reported and frees the next one', async () => {
  let fail;
  applyUpdate.mockImplementationOnce(() => new Promise((_, reject) => (fail = reject)));
  const end = ended();
  await api.post('/api/update/apply');
  const busy = await api.post('/api/update/apply');
  expect([busy.status, busy.body.error]).toEqual([409, 'Mise à jour déjà en cours']);

  fail(new Error('offline'));
  expect(await end).toEqual({ step: 0, message: 'Erreur: offline', status: 'error' });
  applyUpdate.mockRejectedValueOnce(new Error('again'));
  expect((await api.post('/api/update/apply')).status).toBe(200);
});
