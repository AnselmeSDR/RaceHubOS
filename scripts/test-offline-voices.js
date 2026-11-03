import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { OfflineVoices, installedVoices } from '../packages/backend/src/lib/offlineVoices.js';
import { PiperSpeech } from '../packages/backend/src/lib/piperSpeech.js';

// Explicit manual integration test; never called by application startup or npm install.
if (!process.argv.includes('--install')) {
  console.error(
    'Use --install to explicitly download the pinned engine and three voices into a temporary test directory. Add --keep to retain WAV files and models.'
  );
  process.exitCode = 1;
} else {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'racehubos-voice-smoke-'));
  const speech = new PiperSpeech({ timeout: 60000 });
  const manager = new OfflineVoices({ home: path.join(directory, 'voices'), beforeChange: () => speech.close() });
  try {
    console.log(
      JSON.stringify({ platform: process.platform, arch: process.arch, downloadBytes: manager.status().downloadBytes })
    );
    await manager.install();
    for (const voice of installedVoices(manager.home)) {
      const text = {
        de: 'Neue Bestzeit für Fahrer eins.',
        en: 'New best lap for driver one.',
        fr: 'Meilleur tour pour le pilote un.',
      }[voice.language];
      const audio = await speech.speak(voice, text, 1.1);
      assert.equal(audio.toString('ascii', 0, 4), 'RIFF');
      assert.equal(audio.toString('ascii', 8, 12), 'WAVE');
      assert.ok(audio.length > 1000);
      assert.ok(audio.subarray(44).some((byte) => byte !== 0));
      fs.writeFileSync(path.join(directory, voice.language + '.wav'), audio);
      console.log(JSON.stringify({ voice: voice.id, bytes: audio.length, sampleRate: audio.readUInt32LE(24) }));
    }
    assert.equal(installedVoices(manager.home).length, 3);
  } finally {
    await speech.close();
    if (process.argv.includes('--keep')) console.log(`Kept test files in ${directory}`);
    else {
      await manager.remove();
      fs.rmSync(directory, { recursive: true, force: true });
    }
  }
}
