import { test, expect, jest } from '@jest/globals';
import { createSpeechPlayer } from '../../../frontend/src/lib/piperPlayer.mjs';
function fixture() {
  const utterances = [],
    audios = [],
    states = [];
  const env = {
    AbortController,
    URL: { createObjectURL: jest.fn(() => 'blob:fixture'), revokeObjectURL: jest.fn() },
    fetch: jest.fn(async () => ({ ok: true, blob: async () => ({}) })),
    SpeechSynthesisUtterance: class {
      constructor(text) {
        this.text = text;
      }
    },
    Audio: class {
      constructor() {
        audios.push(this);
      }
      play() {
        return Promise.resolve();
      }
      pause() {}
    },
    speechSynthesis: {
      speaking: false,
      getVoices: () => [{ voiceURI: 'fr', lang: 'fr-FR' }],
      speak: (u) => utterances.push(u),
      cancel: jest.fn(),
    },
  };
  return { env, utterances, audios, states, player: createSpeechPlayer({ env, onState: (s) => states.push(s) }) };
}
const flush = () => new Promise((r) => setTimeout(r, 0));
test('missing model uses a matching-language browser voice and preserves completion', () => {
  const f = fixture();
  const job = f.player.speak('bonjour', {
    language: 'fr',
    selection: '_piper-thorsten',
    voices: [{ id: 'de_DE-thorsten-medium', language: 'de' }],
  });
  expect(f.env.fetch).not.toHaveBeenCalled();
  expect(f.utterances[0].lang).toBe('fr-FR');
  expect(f.states).toContain('fallback');
  job.onend = jest.fn();
  f.utterances[0].onend();
  expect(job.onend).toHaveBeenCalledTimes(1);
});
test('local playback sends model and language and releases audio after playback', async () => {
  const f = fixture();
  const job = f.player.speak('hello', {
    language: 'en',
    selection: '_piper-auto',
    voices: [{ id: 'en_US-ljspeech-high', language: 'en' }],
  });
  await flush();
  expect(JSON.parse(f.env.fetch.mock.calls[0][1].body).language).toBe('en');
  expect(f.audios).toHaveLength(1);
  job.onend = jest.fn();
  f.audios[0].onended();
  expect(job.onend).toHaveBeenCalledTimes(1);
  expect(f.env.URL.revokeObjectURL).toHaveBeenCalled();
});
test('synthesis failure falls back without switching language', async () => {
  const f = fixture();
  f.env.fetch.mockResolvedValue({ ok: false });
  f.player.speak('bonjour', { language: 'fr', selection: '_piper-auto', voices: [{ id: 'fr', language: 'fr' }] });
  await flush();
  expect(f.utterances).toHaveLength(1);
  expect(f.states).toContain('fallback');
});
test('forced replacement and cancellation discard stale synthesis responses', async () => {
  const f = fixture();
  let resolve;
  f.env.fetch.mockImplementationOnce(() => new Promise((r) => (resolve = r)));
  f.player.speak('old', { language: 'en', selection: '_piper-auto', voices: [{ id: 'en', language: 'en' }] });
  expect(f.player.speak('busy')).toBeNull();
  f.player.speak('new', { language: 'fr', force: true });
  resolve({ ok: true, blob: async () => ({}) });
  await flush();
  expect(f.audios).toHaveLength(0);
  expect(f.utterances[0].text).toBe('new');
  f.player.cancel();
  expect(f.env.speechSynthesis.cancel).toHaveBeenCalled();
});

import { speechDuration } from '../../../frontend/src/lib/speechDuration.mjs';
test('spoken times use complete translated units and decimal separators', () => {
  expect(speechDuration(62345, 'de')).toBe('1 Minute 2,345 Sekunden');
  expect(speechDuration(123456, 'en')).toBe('2 minutes 3.456 seconds');
  expect(speechDuration(12345, 'fr')).toBe('12,345 secondes');
  expect(speechDuration(NaN, 'en')).toBe('');
});
test('missing browser speech reports unavailability and completes queued announcements', async () => {
  const f = fixture();
  delete f.env.speechSynthesis;
  const job = f.player.speak('x', { language: 'en' });
  job.onend = jest.fn();
  await flush();
  expect(job.onend).toHaveBeenCalledTimes(1);
  expect(f.states.at(-1)).toBe('unavailable');
});

import { normalizeVoiceIds } from '../../../frontend/src/lib/piperSelection.mjs';
test('legacy local preferences migrate without losing automatic language switching', () => {
  expect(normalizeVoiceIds('_piper-auto')).toEqual({ de: '_piper-auto', en: '_piper-auto', fr: '_piper-auto' });
  expect(normalizeVoiceIds('_piper-thorsten')).toEqual({ de: '_piper-thorsten' });
  expect(normalizeVoiceIds('browser-fr')).toEqual({ fr: 'browser-fr' });
  const saved = { de: '_piper:de_DE-thorsten-medium', en: 'browser-en' };
  expect(normalizeVoiceIds(saved)).toEqual(saved);
});
