import { EventEmitter } from 'node:events';
import { jest } from '@jest/globals';
import { PiperSpeech, workerEnvironment } from '../lib/piperSpeech.js';

function fixture(timeout = 1000) {
  const child = new EventEmitter();
  child.exitCode = null;
  child.stderr = new EventEmitter();
  child.send = jest.fn((message, callback) => callback?.());
  child.kill = jest.fn(() => {
    child.exitCode = 0;
    child.emit('exit', 0);
  });
  const forkWorker = jest.fn(() => child);
  const speech = new PiperSpeech({ forkWorker, timeout, idleTimeout: 5000 });
  return { child, forkWorker, speech, voice: { home: '/fixture', id: 'de_DE-thorsten-medium' } };
}
function wav() {
  const data = Buffer.alloc(44);
  data.write('RIFF');
  data.write('WAVE', 8);
  return data;
}

test('one Node worker, bounded jobs, voice-specific cache and awaited removal cleanup', async () => {
  const f = fixture();
  const first = f.speech.speak(f.voice, 'hello', 1.1);
  f.child.emit('message', { id: 1, audio: wav() });
  await expect(first).resolves.toEqual(wav());
  await expect(f.speech.speak(f.voice, 'hello', 1.1)).resolves.toEqual(wav());
  expect(f.child.send).toHaveBeenCalledTimes(1);
  const jobs = Array.from({ length: 4 }, (_, i) =>
    f.speech.speak({ ...f.voice, id: 'fr_FR-siwis-medium' }, 'job' + i, 1.1).catch((error) => error)
  );
  await expect(f.speech.speak(f.voice, 'excess', 1.1)).rejects.toMatchObject({ status: 429 });
  expect(f.forkWorker).toHaveBeenCalledTimes(1);
  await f.speech.close();
  expect(f.child.kill).toHaveBeenCalledTimes(1);
  expect(await Promise.all(jobs)).toEqual(expect.arrayContaining([expect.any(Error)]));
  expect(f.speech.jobs.size).toBe(0);
});

test('timeouts and corrupt worker output reject safely and release jobs', async () => {
  const f = fixture(15);
  const pending = f.speech.speak(f.voice, 'timeout', 1.1);
  await expect(pending).rejects.toThrow(/stopped/);
  expect(f.child.kill).toHaveBeenCalled();
  const g = fixture();
  const bad = g.speech.speak(g.voice, 'invalid', 1.1);
  g.child.emit('message', { id: 1, audio: Buffer.from('invalid') });
  await expect(bad).rejects.toThrow(/Invalid/);
  await g.speech.close();
});

test('platform library paths preserve inherited environment and Windows Path casing', () => {
  expect(workerEnvironment('/home', 'linux', 'x64', { LD_LIBRARY_PATH: '/old' }).LD_LIBRARY_PATH).toContain('/old');
  expect(workerEnvironment('/home', 'darwin', 'arm64', {}).DYLD_LIBRARY_PATH).toContain('sherpa-onnx-darwin-arm64');
  const env = workerEnvironment('/home', 'win32', 'x64', { Path: 'C:\\Windows' });
  expect(env.Path).toContain(';C:\\Windows');
  expect(env.PATH).toBeUndefined();
});
