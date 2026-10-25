import fs from 'node:fs';
import assert from 'node:assert/strict';
import { extensionTranslator } from '../../../frontend/src/i18n/extensionMessages.mjs';
import { normalizedCarScale, scaleVoltageHint } from '@racehubos/shared';
const dictionaries = Object.fromEntries(
  ['de', 'en', 'fr'].map((lang) => [
    lang,
    JSON.parse(
      fs.readFileSync(new URL(`../../../frontend/src/i18n/locales/${lang}/extensions.json`, import.meta.url), 'utf8')
    ),
  ])
);
test('catalogue translations have identical nonempty keys and interpolation tokens in all languages', () => {
  const keys = Object.keys(dictionaries.de).sort();
  for (const dictionary of Object.values(dictionaries)) {
    assert.deepEqual(Object.keys(dictionary).sort(), keys);
    for (const key of keys) {
      assert.ok(dictionary[key].trim());
      const tokens = (s) => [...s.matchAll(/{{(\w+)}}/g)].map((m) => m[1]).sort();
      assert.deepEqual(tokens(dictionary[key]), tokens(key), key);
    }
  }
});
test('dynamic catalogue failure messages translate nested diagnostics', () => {
  const dictionary = dictionaries.en;
  const tx = extensionTranslator(dictionaries.de, (key, values) =>
    dictionary[key].replace(/{{(\w+)}}/g, (_, name) => values[name])
  );
  const result = tx(
    'Aktualisierung fehlgeschlagen: Carrera antwortet mit HTTP 503. Der bisherige Katalog bleibt erhalten.'
  );
  assert.ok(!result.includes('fehlgeschlagen'));
  assert.ok(result.includes('503'));
  assert.ok(!result.includes('antwortet'));
});
test('scale normalization and voltage hints preserve unknown scale and distinguish the two original systems', () => {
  for (const value of ['1:32', '1 / 32', 'D132', 'EVOLUTION']) assert.equal(normalizedCarScale(value), '1:32');
  assert.equal(normalizedCarScale('DIGITAL 124'), '1:24');
  assert.equal(normalizedCarScale('other'), null);
  assert.ok(scaleVoltageHint('132').includes('14,8'));
  assert.ok(scaleVoltageHint('124').includes('18 V'));
});
