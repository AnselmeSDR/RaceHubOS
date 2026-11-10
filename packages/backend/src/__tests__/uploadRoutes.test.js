import fs from 'fs';
import os from 'os';
import path from 'path';
import { apiFor } from './helpers/entityFixtures.js';
import { createUploadRouter } from '../routes/upload.js';

let uploadsDir, api;

beforeEach(() => {
  uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'racehubos-upload-'));
  api = apiFor('/api/upload', createUploadRouter(uploadsDir));
});
afterEach(() => fs.rmSync(uploadsDir, { recursive: true, force: true }));

const PNG = Buffer.from('89504e470d0a1a0a', 'hex');

test('an image is stored under its type and served by /api/img', async () => {
  const res = await api.post('/api/upload/cars').attach('img', PNG, { filename: 'gt.png', contentType: 'image/png' });
  const { url, filename, originalName, size } = res.body.data;
  expect(filename).toMatch(/^\d+-\d+\.png$/);
  expect([url, originalName, size]).toEqual([`/api/img/cars/${filename}`, 'gt.png', PNG.length]);
  expect(fs.readFileSync(path.join(uploadsDir, 'cars', filename))).toEqual(PNG);

  expect((await api.delete(`/api/upload/cars/${filename}`)).body).toEqual({ success: true, message: 'File deleted' });
  expect(fs.existsSync(path.join(uploadsDir, 'cars', filename))).toBe(false);
  expect((await api.delete(`/api/upload/cars/${filename}`)).status).toBe(404);
});

test('only images of a known type, up to 5 MB', async () => {
  let res = await api.post('/api/upload/cars').attach('img', Buffer.from('hi'), 'notes.txt');
  expect([res.status, res.body.error]).toEqual([500, 'Only image files are allowed (jpeg, jpg, png, gif, webp)']);

  const big = Buffer.alloc(5 * 1024 * 1024 + 1);
  res = await api.post('/api/upload/cars').attach('img', big, { filename: 'big.png', contentType: 'image/png' });
  expect([res.status, res.body.error]).toEqual([400, 'File too large. Maximum size is 5MB']);

  res = await api.post('/api/upload/cars');
  expect([res.status, res.body.error]).toEqual([400, 'No file uploaded']);

  for (res of [
    await api.post('/api/upload/secrets').attach('img', PNG, { filename: 'x.png', contentType: 'image/png' }),
    await api.delete('/api/upload/secrets/x.png'),
  ]) {
    expect([res.status, res.body.error]).toEqual([400, 'Invalid type']);
  }
  expect(fs.readdirSync(uploadsDir, { recursive: true }).filter((f) => f.includes('.'))).toEqual([]);
});

test('a deletion never leaves the folder of its type', async () => {
  fs.writeFileSync(path.join(uploadsDir, 'keep.db'), 'data');
  const res = await api.delete('/api/upload/cars/..%2Fkeep.db');
  expect(res.status).toBe(404);
  expect(fs.existsSync(path.join(uploadsDir, 'keep.db'))).toBe(true);
});
