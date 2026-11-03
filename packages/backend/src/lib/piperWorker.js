import path from 'node:path';
import { createRequire } from 'node:module';

const engines = new Map();
process.on('message', ({ id, voice, text, rate }) => {
  try {
    const require = createRequire(path.join(voice.home, 'node_modules/sherpa-onnx-node/package.json'));
    const sherpa = require('./sherpa-onnx.js');
    const key = voice.home + ':' + voice.id;
    if (!engines.has(key)) {
      if (engines.size >= 3) throw new Error('Too many offline voice models');
      const directory = path.join(voice.home, 'models', `vits-piper-${voice.id}`);
      const tts = new sherpa.OfflineTts({
        model: {
          vits: {
            model: path.join(directory, voice.id + '.onnx'),
            tokens: path.join(directory, 'tokens.txt'),
            dataDir: path.join(directory, 'espeak-ng-data'),
          },
          numThreads: 2,
          debug: false,
          provider: 'cpu',
        },
        maxNumSentences: 1,
      });
      engines.set(key, tts);
    }
    const audio = engines.get(key).generate({ text, sid: 0, speed: rate });
    const pcm = Buffer.alloc(audio.samples.length * 2);
    for (let i = 0; i < audio.samples.length; i++)
      pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, audio.samples[i])) * 32767), i * 2);
    const header = Buffer.alloc(44);
    header.write('RIFF');
    header.writeUInt32LE(36 + pcm.length, 4);
    header.write('WAVEfmt ', 8);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(1, 22);
    header.writeUInt32LE(audio.sampleRate, 24);
    header.writeUInt32LE(audio.sampleRate * 2, 28);
    header.writeUInt16LE(2, 32);
    header.writeUInt16LE(16, 34);
    header.write('data', 36);
    header.writeUInt32LE(pcm.length, 40);
    process.send({ id, audio: Buffer.concat([header, pcm]) });
  } catch {
    process.send({ id, error: 'Local synthesis failed' });
  }
});
