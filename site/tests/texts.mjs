import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

export const LANGS = ['de', 'en', 'fr'];

/** The dictionaries of site/i18n.js, read the way the browser runs them. */
export function loadTexts() {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(import.meta.dirname, '../i18n.js'), 'utf-8'), context);
  return context.window.RACEHUBOS_TEXTS;
}
