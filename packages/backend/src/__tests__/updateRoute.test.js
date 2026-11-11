import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const applyUpdate = jest.fn();
const checkForUpdate = jest.fn(async () => ({ currentVersion: '1.2.0', updateAvailable: false }));
const fetchMain = jest.fn(async () => ({ diverged: false }));
jest.unstable_mockModule('../lib/update.js', () => ({ applyUpdate, checkForUpdate, fetchMain }));
const { default: router, setUpdateIo } = await import('../routes/update.js');

const app = express();
app.use(express.json());
app.use('/api/update', router);
const api = request(app);
const io = { emit: jest.fn() };
setUpdateIo(io);

beforeEach(() => {
  io.emit.mockClear();
  applyUpdate.mockClear();
  fetchMain.mockReset().mockResolvedValue({ diverged: false });
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
  expect(applyUpdate).toHaveBeenCalledWith(expect.objectContaining({ replaceLocal: false }));

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

test('a checkout diverged from main is only updated once the user agrees to replace its code', async () => {
  fetchMain.mockResolvedValue({ diverged: true });
  const refused = await api.post('/api/update/apply');
  expect([refused.status, refused.body]).toEqual([409, { success: false, diverged: true }]);
  expect(applyUpdate).not.toHaveBeenCalled();

  // A failing update: what matters is how it was asked, and no restart follows
  applyUpdate.mockRejectedValueOnce(new Error('stop'));
  let end = ended();
  expect((await api.post('/api/update/apply').send({ replaceLocal: true })).status).toBe(200);
  await end;
  expect(applyUpdate).toHaveBeenCalledWith(expect.objectContaining({ replaceLocal: true }));

  // Agreeing changes nothing for a checkout that can fast-forward
  fetchMain.mockResolvedValue({ diverged: false });
  applyUpdate.mockRejectedValueOnce(new Error('stop'));
  end = ended();
  await api.post('/api/update/apply').send({ replaceLocal: true });
  await end;
  expect(applyUpdate).toHaveBeenLastCalledWith(expect.objectContaining({ replaceLocal: false }));
});

test('main out of reach answers the error and frees the next update', async () => {
  fetchMain.mockRejectedValueOnce(new Error('offline'));
  const failed = await api.post('/api/update/apply');
  expect([failed.status, failed.body.error]).toEqual([500, 'Erreur: offline']);
  expect(applyUpdate).not.toHaveBeenCalled();

  applyUpdate.mockRejectedValueOnce(new Error('again'));
  const end = ended();
  expect((await api.post('/api/update/apply')).status).toBe(200);
  await end;
});
