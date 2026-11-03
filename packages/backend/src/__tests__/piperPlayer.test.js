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

test('preview unlocks one audio element before synthesis and reuses it after the response', async () => {
  const f = fixture();
  const plays = [];
  let release;
  f.env.Audio = class {
    constructor(src) {
      this.src = src;
      f.audios.push(this);
    }
    play() {
      plays.push(this.src);
      return Promise.resolve();
    }
    pause() {}
  };
  f.env.fetch = () =>
    new Promise((resolve) => {
      release = resolve;
    });
  const job = f.player.speak('Hallo', { language: 'de', selection: '_piper-auto', voices, preview: true });
  job.onend = jest.fn();
  expect(plays).toHaveLength(1);
  expect(plays[0]).toMatch(/^data:audio\/wav/);
  release({ ok: true, blob: async () => ({}) });
  await flush();
  expect(f.audios).toHaveLength(1);
  expect(plays[1]).toBe('blob:fixture');
  f.audios[0].onended({ type: 'ended' });
  expect(job.onend).toHaveBeenCalledTimes(1);
});

test('fallback reports browser failure and does not mistake normal end events for errors', async () => {
  const f = fixture();
  const job = f.player.speak('Fallback', { language: 'en' });
  job.onend = jest.fn();
  job.onerror = jest.fn();
  f.utterance.onerror({ error: 'synthesis-unavailable' });
  expect(job.onerror).toHaveBeenCalledTimes(1);
  expect(job.onend).not.toHaveBeenCalled();
  const next = f.player.speak('Next', { language: 'en' });
  next.onend = jest.fn();
  f.utterance.onend({ type: 'end' });
  expect(next.onend).toHaveBeenCalledTimes(1);
});

test('Web Audio preview resumes during the click, decodes the delayed WAV and releases its context', async () => {
  const f = fixture();
  const events = [];
  const source = { connect: jest.fn(), disconnect: jest.fn(), start: jest.fn(), stop: jest.fn() };
  const gain = { gain: { value: 1 }, connect: jest.fn() };
  const close = jest.fn(async () => {});
  f.env.AudioContext = class {
    resume() {
      events.push('resume');
      return Promise.resolve();
    }
    decodeAudioData() {
      events.push('decode');
      return Promise.resolve({});
    }
    createBufferSource() {
      return source;
    }
    createGain() {
      return gain;
    }
    close() {
      return close();
    }
  };
  let release;
  f.env.fetch = () => {
    events.push('fetch');
    return new Promise((resolve) => {
      release = resolve;
    });
  };
  const job = f.player.speak('Hallo', { language: 'de', selection: '_piper-auto', voices, preview: true, volume: 0.4 });
  job.onend = jest.fn();
  expect(events).toEqual(['resume', 'fetch']);
  release({ ok: true, blob: async () => ({ arrayBuffer: async () => new ArrayBuffer(4) }) });
  await flush();
  expect(source.start).toHaveBeenCalledTimes(1);
  expect(gain.gain.value).toBe(0.4);
  expect(f.audios).toHaveLength(0);
  source.onended();
  expect(job.onend).toHaveBeenCalledTimes(1);
  expect(close).toHaveBeenCalledTimes(1);
  expect(source.disconnect).toHaveBeenCalledTimes(1);
});
