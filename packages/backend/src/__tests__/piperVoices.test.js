import { test, expect, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { discoverVoices, selectPiperVoice, PIPER_MODELS } from '../lib/piperVoices.js';
import { createVoiceRouter } from '../routes/voice.js';
import { PiperSpeech } from '../lib/piperSpeech.js';
import { selectLocalVoice, browserVoice } from '../../../frontend/src/lib/piperSelection.mjs';
const voices = PIPER_MODELS.map((v) => ({ ...v, home: '/voices', python: 'python', script: 'worker.py', model: v.id }));
test('legacy Thorsten is detected read-only; incomplete and non-German legacy voices are excluded', () => {
  const paths = new Set([
    '/old/venv/bin/python3',
    '/old/worker.py',
    '/old/voices/de_DE-thorsten-medium.onnx',
    '/old/voices/de_DE-thorsten-medium.onnx.json',
  ]);
  expect(discoverVoices(['/old'], (p) => paths.has(p)).map((v) => v.language)).toEqual(['de']);
  paths.delete('/old/voices/de_DE-thorsten-medium.onnx.json');
  expect(discoverVoices(['/old'], (p) => paths.has(p))).toEqual([]);
});
test('per-language lookup retains missing languages in later installations', () => {
  const paths = new Set();
  for (const [home, v] of [
    ['/a', voices[0]],
    ['/b', voices[1]],
    ['/b', voices[2]],
  ])
    for (const suffix of [
      '/venv/bin/python3',
      '/worker-multilang.py',
      '/voices/' + v.id + '.onnx',
      '/voices/' + v.id + '.onnx.json',
    ])
      paths.add(home + suffix);
  expect(discoverVoices(['/a', '/b'], (p) => paths.has(p)).map((v) => v.home)).toEqual(['/a', '/b', '/b']);
});
test('automatic, explicit and legacy choices never use the wrong language or arbitrary paths', () => {
  for (const v of voices) {
    expect(selectPiperVoice(voices, v.locale).id).toBe(v.id);
    expect(selectLocalVoice(voices, '_piper-auto', v.locale).id).toBe(v.id);
  }
  expect(selectPiperVoice(voices, 'fr', '_piper-thorsten')).toBeNull();
  expect(selectPiperVoice(voices, 'de', '../../secret')).toBeNull();
  expect(selectLocalVoice(voices, '_piper-thorsten', 'de').id).toBe(voices[0].id);
  expect(
    browserVoice(
      [
        { voiceURI: 'old', lang: 'de-DE' },
        { voiceURI: 'fr', lang: 'fr-FR' },
      ],
      'old',
      'fr'
    ).voiceURI
  ).toBe('fr');
});
function appFor(discover = () => voices, speech = { speak: jest.fn(async () => Buffer.from('RIFF1234WAVE')) }) {
  const app = express();
  app.use(express.json());
  app.use('/voice', createVoiceRouter({ discover, speech }));
  return { app, speech };
}
test('status advertises voices without exposing paths', async () => {
  const { app } = appFor();
  const r = await request(app).get('/voice/status');
  expect(r.body.voices).toHaveLength(3);
  expect(JSON.stringify(r.body)).not.toContain('/voices');
  expect(r.headers['cache-control']).toBe('no-store');
});
test('API rejects malformed input, foreign origins and missing or mismatched models before spawning', async () => {
  const { app, speech } = appFor();
  for (const data of [
    { text: '', language: 'de' },
    { text: 'x'.repeat(401), language: 'de' },
    { text: 'x', language: 'es' },
    { text: 'x', language: 'fr', rate: 9 },
  ])
    expect((await request(app).post('/voice/speak').send(data)).status).toBe(400);
  expect(
    (await request(app).post('/voice/speak').set('Origin', 'https://other.example').send({ text: 'x', language: 'de' }))
      .status
  ).toBe(403);
  expect(
    (await request(app).post('/voice/speak').send({ text: 'x', language: 'fr', voiceId: '_piper-thorsten' })).status
  ).toBe(503);
  expect(speech.speak).not.toHaveBeenCalled();
  expect(
    (
      await request(appFor(() => []).app)
        .post('/voice/speak')
        .send({ text: 'x', language: 'en' })
    ).status
  ).toBe(503);
});
test('API selects each language and returns WAV, busy or failure responses', async () => {
  const { app, speech } = appFor();
  for (const v of voices) {
    const r = await request(app).post('/voice/speak').send({ text: 'hello', language: v.language });
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toContain('audio/wav');
    expect(speech.speak.mock.calls.at(-1)[0].id).toBe(v.id);
  }
  speech.speak.mockRejectedValueOnce(Object.assign(new Error('private'), { status: 429 }));
  expect((await request(app).post('/voice/speak').send({ text: 'hello', language: 'en' })).status).toBe(429);
});
function worker() {
  const c = new EventEmitter();
  c.stdout = new PassThrough();
  c.stderr = new PassThrough();
  c.stdin = new PassThrough();
  c.kill = jest.fn(() => c.emit('exit'));
  return c;
}
const wav = Buffer.from('RIFF1234WAVEdata');
test('voice-specific workers and caches cannot mix languages; close stops children', async () => {
  const children = [],
    spawn = jest.fn(() => {
      const c = worker();
      children.push(c);
      c.stdin.on('data', (data) => {
        const j = JSON.parse(data);
        c.stdout.write(JSON.stringify({ id: j.id, audio: wav.toString('base64') }) + '\n');
      });
      return c;
    });
  const service = new PiperSpeech({ spawnWorker: spawn });
  for (const v of voices) expect(await service.speak(v, 'same', 1)).toEqual(wav);
  await service.speak(voices[0], 'same', 1);
  expect(spawn).toHaveBeenCalledTimes(3);
  expect(spawn.mock.calls[1][1]).toContain(voices[1].model);
  service.close();
  expect(children.every((c) => c.kill.mock.calls.length)).toBe(true);
});
test('worker crash releases jobs and permits a replacement', async () => {
  const children = [],
    service = new PiperSpeech({
      spawnWorker: () => {
        const c = worker();
        children.push(c);
        return c;
      },
    });
  const pending = service.speak(voices[0], 'x', 1);
  children[0].emit('exit');
  await expect(pending).rejects.toThrow('stopped');
  const next = service.speak(voices[0], 'x', 1);
  expect(children).toHaveLength(2);
  service.close();
  await expect(next).rejects.toThrow('stopped');
});
test('queue and timeouts remain bounded', async () => {
  const service = new PiperSpeech({ spawnWorker: worker, timeout: 20 });
  const jobs = Array.from({ length: 4 }, () => service.speak(voices[0], 'x', 1).catch((e) => e.message));
  await expect(service.speak(voices[0], 'fifth', 1)).rejects.toMatchObject({ status: 429 });
  expect((await Promise.all(jobs)).every(Boolean)).toBe(true);
  service.close();
});
