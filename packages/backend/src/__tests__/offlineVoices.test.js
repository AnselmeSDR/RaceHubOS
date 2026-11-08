import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { jest } from '@jest/globals';
import { Header } from 'tar';
import express from 'express';
import request from 'supertest';
import { OfflineVoices, VOICE_MANIFEST, runtimePackage, installedVoices } from '../lib/offlineVoices.js';
import { createVoiceRouter } from '../routes/voice.js';

let directory;
beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'racehubos-offline-'));
});
afterEach(() => {
  fs.rmSync(directory, { recursive: true, force: true });
});
function fixture({ badHash = false, extract } = {}) {
  const payload = Buffer.from('verified fixture archive');
  const file = {
    url: 'https://fixture.invalid/file',
    bytes: payload.length,
    sha256: createHash('sha256')
      .update(badHash ? 'wrong' : payload)
      .digest('hex'),
  };
  const manifest = {
    ...VOICE_MANIFEST,
    runtime: Object.fromEntries(Object.keys(VOICE_MANIFEST.runtime).map((key) => [key, file])),
    voices: VOICE_MANIFEST.voices.map((voice) => ({ ...voice, ...file })),
  };
  const fetchFile = jest.fn(async () => ({ ok: true, body: Readable.toWeb(Readable.from([payload])) }));
  const beforeChange = jest.fn(async () => {});
  const fakeExtract = async (archive, destination) => {
    fs.mkdirSync(destination, { recursive: true });
    if (destination.endsWith('models')) {
      const file = (manager.activePlan || manager.plan())[parseInt(path.basename(archive))];
      for (const voice of manifest.voices.filter((voice) => voice.id === file.id)) {
        const model = path.join(destination, 'vits-piper-' + voice.id);
        fs.mkdirSync(path.join(model, 'espeak-ng-data'), { recursive: true });
        for (const name of [voice.id + '.onnx', 'tokens.txt', 'espeak-ng-data/phontab'])
          fs.writeFileSync(path.join(model, name), 'fixture');
      }
    } else
      fs.writeFileSync(
        path.join(destination, destination.endsWith('sherpa-onnx-node') ? 'sherpa-onnx.js' : 'sherpa-onnx.node'),
        'fixture'
      );
  };
  const manager = new OfflineVoices({
    home: path.join(directory, 'voices'),
    manifest,
    fetchFile,
    beforeChange,
    extract: extract || fakeExtract,
  });
  return { manager, manifest, fetchFile, beforeChange };
}

test('status and all supported platform plans are read-only: no install, mkdir or download', () => {
  const { manager, fetchFile } = fixture();
  expect(manager.status()).toMatchObject({ supported: true, installed: false, available: false });
  expect(fs.existsSync(manager.home)).toBe(false);
  expect(new OfflineVoices({ home: manager.home + path.sep }).home).toBe(manager.home);
  expect(fetchFile).not.toHaveBeenCalled();
  for (const [platform, arch] of [
    ['win32', 'x64'],

    ['win32', 'ia32'],
    ['darwin', 'x64'],
    ['darwin', 'arm64'],
    ['linux', 'x64'],
    ['linux', 'arm64'],
  ]) {
    expect(runtimePackage(platform, arch)).toBeTruthy();
    const plan = new OfflineVoices({ platform, arch, home: manager.home }).status();
    expect(plan.supported).toBe(true);
    expect(plan.downloadBytes).toBeGreaterThan(250000000);
  }
  expect(new OfflineVoices({ platform: 'linux', arch: 'arm', home: manager.home }).status().supported).toBe(false);
});

test('only explicit install downloads verified archives, publishes atomically and is removable', async () => {
  const { manager, fetchFile, beforeChange } = fixture();
  expect(manager.startInstall()).toBe(true);
  expect(manager.startInstall()).toBe(false);
  await manager.operation;
  expect(fetchFile).toHaveBeenCalledTimes(5);
  expect(beforeChange).toHaveBeenCalledTimes(1);
  expect(manager.status()).toMatchObject({ installed: true, removable: true, phase: 'idle', error: null });
  expect(installedVoices(manager.home).map((voice) => voice.language)).toEqual(['de', 'en', 'fr']);
  expect(await manager.remove()).toBe(true);
  expect(fs.existsSync(manager.home)).toBe(false);
  expect(beforeChange).toHaveBeenCalledTimes(2);
});

test('checksum mismatch, truncated download and incomplete extraction preserve the previous installation', async () => {
  const good = fixture();
  await good.manager.install();
  fs.writeFileSync(path.join(good.manager.home, 'keep.txt'), 'previous');
  const bad = fixture({ badHash: true });
  await expect(bad.manager.install()).rejects.toThrow(/checksum/);
  expect(fs.readFileSync(path.join(good.manager.home, 'keep.txt'), 'utf8')).toBe('previous');
  const truncated = fixture();
  truncated.manager.fetchFile = async () => ({ ok: true, body: Readable.toWeb(Readable.from([Buffer.from('short')])) });
  await expect(truncated.manager.install()).rejects.toThrow(/checksum/);
  const incomplete = fixture({ extract: async () => {} });
  await expect(incomplete.manager.install()).rejects.toThrow(/Incomplete/);
  expect(good.manager.status().installed).toBe(true);
  expect(fs.readdirSync(directory).some((name) => name.includes('-install-'))).toBe(false);
});

test('unmanaged folders and unsafe archive entries cannot be overwritten or removed', async () => {
  const { manager } = fixture();
  fs.mkdirSync(manager.home);
  fs.writeFileSync(path.join(manager.home, 'important.txt'), 'keep');
  await expect(manager.install()).rejects.toThrow();
  await expect(manager.remove()).rejects.toThrow();
  expect(fs.readFileSync(path.join(manager.home, 'important.txt'), 'utf8')).toBe('keep');
  const header = new Header({ path: '../escape', size: 0, type: 'File', mode: 0o644 });
  header.encode();
  const payload = gzipSync(Buffer.concat([header.block, Buffer.alloc(1024)]));
  const file = {
    url: 'https://fixture.invalid/archive',
    bytes: payload.length,
    sha256: createHash('sha256').update(payload).digest('hex'),
  };
  const manifest = {
    ...VOICE_MANIFEST,
    runtime: Object.fromEntries(Object.keys(VOICE_MANIFEST.runtime).map((key) => [key, file])),
  };
  const unsafe = new OfflineVoices({
    home: path.join(directory, 'unsafe'),
    manifest,
    fetchFile: async () => ({ ok: true, body: Readable.toWeb(Readable.from([payload])) }),
  });
  await expect(unsafe.install()).rejects.toThrow();
  expect(fs.existsSync(path.join(directory, 'escape'))).toBe(false);
});

test('HTTP status is passive, install is explicit, and cross-origin mutations are refused', async () => {
  const { manager, fetchFile } = fixture();
  const app = express();
  app.use(express.json());
  app.use('/api/voice', createVoiceRouter({ manager, speech: { close: async () => {}, speak: jest.fn() } }));
  const api = request(app);
  await api.get('/api/voice/status').expect(200);
  expect(fetchFile).not.toHaveBeenCalled();
  await api.post('/api/voice/install').set('Origin', 'https://other.example').expect(403);
  await api.delete('/api/voice/installation').set('Origin', 'https://other.example').expect(403);
  await api
    .post('/api/voice/speak')
    .send({ text: 'hello', language: 'en', voiceId: '_piper:en_US-ljspeech-high' })
    .expect(503);
  await api.post('/api/voice/install').expect(400);
  await api
    .post('/api/voice/install')
    .send({ languages: ['xx'] })
    .expect(400);
  await api
    .post('/api/voice/install')
    .send({ languages: ['de', 'en', 'fr'] })
    .expect(202);
  await manager.operation;
  expect(manager.status().installed).toBe(true);
  await api.post('/api/voice/speak').send({ text: '', language: 'en', voiceId: '_piper-auto' }).expect(400);
  await api.delete('/api/voice/installation').expect(200);
  expect(manager.status().available).toBe(false);
});

test('installation exposes byte and verification progress only after verified downloads', async () => {
  const { manager } = fixture();
  const originalExtract = manager.extract;
  const progress = [];
  manager.extract = async (...args) => {
    progress.push(manager.status());
    await originalExtract(...args);
  };
  manager.startInstall();
  await manager.operation;
  expect(progress.map((item) => item.stage)).toEqual(Array(5).fill('extracting'));
  expect(progress.map((item) => item.verifiedFiles)).toEqual([1, 2, 3, 4, 5]);
  expect(progress.map((item) => item.fileIndex)).toEqual([1, 2, 3, 4, 5]);
  expect(manager.status()).toMatchObject({ phase: 'idle', stage: 'idle', verifiedFiles: 5, cancelled: false });
  expect(manager.status().downloadedBytes).toBe(manager.status().downloadBytes);
  const bad = fixture({ badHash: true });
  bad.manager.startInstall();
  await bad.manager.operation;
  expect(bad.manager.status().verifiedFiles).toBe(0);
});

test('explicit cancellation aborts the download, cleans staging and preserves an installed voice set', async () => {
  const { manager, fetchFile } = fixture();
  await manager.install();
  fs.writeFileSync(path.join(manager.home, 'keep.txt'), 'previous');
  let started;
  const downloading = new Promise((resolve) => {
    started = resolve;
  });
  manager.fetchFile = async (url, { signal }) => {
    started();
    return new Promise((resolve, reject) =>
      signal.addEventListener('abort', () => reject(signal.reason), { once: true })
    );
  };
  manager.startInstall();
  const operation = manager.operation;
  await downloading;
  const app = express();
  app.use('/api/voice', createVoiceRouter({ manager, speech: {} }));
  expect((await request(app).post('/api/voice/cancel').set('Origin', 'https://outside.invalid')).status).toBe(403);
  expect(manager.cancelled).toBe(false);
  expect((await request(app).post('/api/voice/cancel')).status).toBe(202);
  await operation;
  expect(manager.status()).toMatchObject({ installed: true, phase: 'idle', cancelled: true, error: null });
  expect(fs.readFileSync(path.join(manager.home, 'keep.txt'), 'utf8')).toBe('previous');
  expect(fs.readdirSync(directory).filter((name) => name.includes('-install-'))).toEqual([]);
  expect((await request(app).post('/api/voice/cancel')).status).toBe(409);
  manager.fetchFile = fetchFile;
  manager.startInstall();
  await manager.operation;
  expect(manager.status()).toMatchObject({ installed: true, cancelled: false, verifiedFiles: 5 });
});

test('interface-language installation downloads only that voice; optional additions reuse the runtime and preserve voices', async () => {
  const { manager, fetchFile } = fixture();
  const dePlan = manager.plan(['de'], true);
  expect(dePlan).toHaveLength(3);
  expect(dePlan.filter((file) => file.language).map((file) => file.language)).toEqual(['de']);
  manager.startInstall(['de'], { onlyMissing: true });
  await manager.operation;
  expect(fetchFile).toHaveBeenCalledTimes(3);
  expect(installedVoices(manager.home).map((voice) => voice.language)).toEqual(['de']);
  expect(manager.status(['de'])).toMatchObject({ installed: true, downloadBytes: 0 });
  expect(manager.status(['en']).installed).toBe(false);
  fs.writeFileSync(path.join(manager.home, 'keep.txt'), 'previous');
  const addPlan = manager.plan(['de', 'fr'], true);
  expect(addPlan).toHaveLength(1);
  expect(addPlan[0].language).toBe('fr');
  manager.startInstall(['de', 'fr'], { onlyMissing: true });
  await manager.operation;
  expect(fetchFile).toHaveBeenCalledTimes(4);
  expect(installedVoices(manager.home).map((voice) => voice.language)).toEqual(['de', 'fr']);
  expect(fs.readFileSync(path.join(manager.home, 'keep.txt'), 'utf8')).toBe('previous');
  expect(manager.startInstall(['de', 'fr'], { onlyMissing: true })).toBe(false);
  expect(manager.status(['en']).downloadBytes).toBe(
    manager.manifest.voices.find((voice) => voice.language === 'en').bytes
  );
});
