import fs from 'fs';
import os from 'os';
import path from 'path';

/** A throwaway repository root, with its own `addons/` folder. */
export function makeRoot(prefix = 'racehubos-addons-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

export function removeRoot(root) {
  fs.rmSync(root, { recursive: true, force: true });
}

export function writeFile(root, relative, content = '') {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, typeof content === 'string' ? content : JSON.stringify(content, null, 2));
  return file;
}

/**
 * An add-on folder with a valid manifest, plus any other files.
 *
 * @param {string} root
 * @param {string} id
 * @param {{ manifest?: object, files?: Record<string, string|object> }} [options]
 */
export function makeAddon(root, id, { manifest = {}, files = {} } = {}) {
  writeFile(root, `addons/${id}/racehubos-addon.json`, { id, name: id, version: '0.1.0', ...manifest });
  for (const [relative, content] of Object.entries(files)) {
    writeFile(root, `addons/${id}/${relative}`, content);
  }
  return path.join(root, 'addons', id);
}
