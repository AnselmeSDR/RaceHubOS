import { jest } from '@jest/globals';
import { createSpeechPlayer } from '../../../frontend/src/lib/piperPlayer.js';
import { selectLocalVoice, normalizeVoiceIds } from '../../../frontend/src/lib/piperSelection.js';
import { selectPiperVoice } from '../lib/piperVoices.js';

const voices = [{ id: 'de_DE-thorsten-medium', language: 'de' }];
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
function fixture() {
  const audios = [];
  const utterance = {};
  const browserSpeak = jest.fn(() => utterance);
  const env = {
    AbortController,
    speechSynthesis: { speaking: false, cancel: jest.fn() },
    URL: { createObjectURL: () => 'blob:fixture', revokeObjectURL: jest.fn() },
    fetch: jest.fn(async () => ({ ok: true, blob: async () => ({}) })),
    Audio: class {
      constructor() {
        audios.push(this);
      }
      play() {
        return Promise.resolve();
      }
      pause() {}
    },
  };
  return { env, audios, utterance, browserSpeak, player: createSpeechPlayer({ env, browserSpeak }) };
}

test('local voices are opt-in and language matched; legacy preferences retain their scope', () => {
  expect(selectLocalVoice(voices, '', 'de')).toBeNull();
  expect(selectLocalVoice(voices, '_piper-auto', 'fr')).toBeNull();
  expect(selectPiperVoice(voices, 'fr', '_piper-thorsten')).toBeNull();
  expect(selectLocalVoice(voices, '_piper-thorsten', 'de').id).toBe(voices[0].id);
  expect(normalizeVoiceIds('Browser FR')).toEqual({ fr: 'Browser FR' });
  expect(normalizeVoiceIds('_piper-thorsten')).toEqual({ de: '_piper-thorsten' });
  expect(normalizeVoiceIds({ en: 'selected' })).toEqual({ en: 'selected' });
});

test('missing local voice uses the unchanged browser callback defaults and completion', async () => {
  const f = fixture();
  const job = f.player.speak('hello', { language: 'en', selection: '_piper-auto', voices });
  expect(f.env.fetch).not.toHaveBeenCalled();
  expect(f.browserSpeak).toHaveBeenCalledWith('hello', { rate: 1.1, volume: 0.9, force: false });
  job.onend = jest.fn();
  f.utterance.onend();
  expect(job.onend).toHaveBeenCalledTimes(1);
  expect(f.player.speaking).toBe(false);
});

test('failed synthesis falls back once; cancelled late audio is never played', async () => {
  const f = fixture();
  f.env.fetch.mockRejectedValueOnce(new Error('offline'));
  const job = f.player.speak('Hallo', { language: 'de', selection: '_piper-auto', voices });
  job.onend = jest.fn();
  await flush();
  expect(f.browserSpeak).toHaveBeenCalledTimes(1);
  f.utterance.onend();
  expect(job.onend).toHaveBeenCalledTimes(1);
  let release;
  f.env.fetch = () =>
    new Promise((resolve) => {
      release = resolve;
    });
  f.player.speak('second', { language: 'de', selection: '_piper-auto', voices });
  f.player.cancel();
  release({ ok: true, blob: async () => ({}) });
  await flush();
  expect(f.audios).toHaveLength(0);
});

test('successful local audio honors volume, callback and busy/forced cancellation', async () => {
  const f = fixture();
  const job = f.player.speak('Hallo', { language: 'de', selection: '_piper-auto', voices, volume: 0.4 });
  job.onend = jest.fn();
  expect(f.player.speak('busy', { language: 'de' })).toBeNull();
  await flush();
  expect(f.audios[0].volume).toBe(0.4);
  f.audios[0].onended();
  expect(job.onend).toHaveBeenCalledTimes(1);
  expect(f.env.URL.revokeObjectURL).toHaveBeenCalledWith('blob:fixture');
  f.player.speak('next', { language: 'de', selection: '_piper-auto', voices });
  f.player.speak('force', { language: 'en', selection: '_piper-auto', voices, force: true });
  expect(f.browserSpeak).toHaveBeenCalledWith('force', { rate: 1.1, volume: 0.9, force: true });
  f.player.cancel();
});
