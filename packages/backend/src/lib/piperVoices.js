import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
export const PIPER_MODELS = [
  { id: 'de_DE-thorsten-medium', language: 'de', name: 'Thorsten', locale: 'de-DE' },
  { id: 'en_US-ljspeech-high', language: 'en', name: 'LJ Speech', locale: 'en-US' },
  { id: 'fr_FR-siwis-medium', language: 'fr', name: 'Siwis', locale: 'fr-FR' },
];
export function voiceHomes() {
  return [
    process.env.RACEHUBOS_PIPER_HOME,
    path.join(os.homedir(), '.local/share/racehubos-piper-multilang'),
    '/opt/racehubos-piper-multilang',
    fileURLToPath(new URL('../../../../../installation/piper/', import.meta.url)),
    '/opt/racehubos-piper',
  ].filter(Boolean);
}
export function discoverVoices(homes = voiceHomes(), exists = fs.existsSync) {
  return PIPER_MODELS.flatMap((model) => {
    for (const home of homes) {
      const python = path.join(home, process.platform === 'win32' ? 'venv/Scripts/python.exe' : 'venv/bin/python3');
      const modern = path.join(home, 'worker-multilang.py'),
        legacy = path.join(home, 'worker.py');
      const script = exists(modern) ? modern : model.language === 'de' ? legacy : null;
      const file = path.join(home, 'voices', model.id + '.onnx');
      if (script && [python, script, file, file + '.json'].every(exists))
        return [{ ...model, home, python, script, model: file, legacy: script === legacy }];
    }
    return [];
  });
}
export function selectPiperVoice(voices, language, id = '_piper-auto') {
  const lang = String(language || '').split(/[-_]/)[0];
  const wanted = id === '_piper-thorsten' ? 'de_DE-thorsten-medium' : id.replace(/^_piper:/, '');
  return voices.find((v) => v.language === lang && (id === '_piper-auto' || v.id === wanted)) || null;
}
