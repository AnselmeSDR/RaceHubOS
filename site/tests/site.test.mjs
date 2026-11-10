// Contracts of the published site: its texts in three languages, the files it links to, the installers it offers.
// Run: node --test 'site/tests/*.test.mjs'
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { LANGS, loadTexts } from './texts.mjs';
import { MAC_DOWNLOAD, MAC_INSTALLER, WINDOWS_INSTALLER, appVersion, buildSite, rootDir } from '../scripts/build.mjs';

const siteDir = path.join(rootDir, 'site');
const page = fs.readFileSync(path.join(siteDir, 'index.html'), 'utf-8');

const texts = loadTexts();
let outDir;
let built;

before(() => {
  outDir = buildSite(fs.mkdtempSync(path.join(os.tmpdir(), 'racehubos-site-')));
  built = fs.readFileSync(path.join(outDir, 'index.html'), 'utf-8');
});

after(() => fs.rmSync(outDir, { recursive: true, force: true }));

test('the site speaks French, English and German, with the same texts in each', () => {
  assert.deepEqual(Object.keys(texts).sort(), LANGS);
  const reference = Object.keys(texts.en).sort();
  for (const lang of LANGS) {
    assert.deepEqual(Object.keys(texts[lang]).sort(), reference, `${lang} has other keys than en`);
    for (const [key, value] of Object.entries(texts[lang])) assert.ok(value.trim(), `${lang} ${key} is empty`);
  }
});

test('every text the page shows exists, and every text written is shown', () => {
  const inPage = [...page.matchAll(/data-i18n(?:-alt|-title|-content|-aria)?="([^"]+)"/g)].map((m) => m[1]);
  // Texts the script swaps in: statuses, results, alternative texts of the screens
  const script = fs.readFileSync(path.join(siteDir, 'main.js'), 'utf-8');
  const inScript = [...script.matchAll(/'([a-z]+\.[a-zA-Z]+)'/g)].map((m) => m[1]);
  const screens = [...page.matchAll(/data-screen="([^"]+)"/g)].map((m) => `shot.${m[1]}`);
  const used = new Set([...inPage, ...inScript, ...screens]);
  const known = Object.keys(texts.en);
  assert.deepEqual(
    inPage.filter((key) => !known.includes(key)),
    [],
    'shown but not written'
  );
  assert.deepEqual(
    known.filter((key) => !used.has(key)),
    [],
    'written but never shown'
  );
});

test('a text holding a link is set as HTML, every other text as plain text', () => {
  for (const lang of LANGS) {
    for (const [key, value] of Object.entries(texts[lang])) {
      assert.equal(/<a\s/.test(value), key.endsWith('Html'), `${lang} ${key}`);
    }
  }
});

test('the built site holds every file the page points to, in every language', () => {
  const missing = [];
  const local = (ref) => !/^(https?:|mailto:|#)/.test(ref);
  const refs = [
    ...[...built.matchAll(/\s(?:src|href)="([^"]+)"/g)].map((m) => m[1]),
    ...[...built.matchAll(/property="og:image" content="([^"]+)"/g)].map((m) => m[1]),
    ...[...fs.readFileSync(path.join(outDir, 'styles.css'), 'utf-8').matchAll(/url\('([^']+)'\)/g)].map((m) => m[1]),
  ].filter(local);
  const shots = [...built.matchAll(/data-(?:shot|screen)="([^"]+)"/g)].map((m) => m[1]);
  for (const shot of new Set(shots)) {
    for (const lang of LANGS) refs.push(`img/${lang}/${shot}.webp`, `img/${lang}/dark/${shot}.webp`);
  }
  for (const ref of new Set(refs)) if (!fs.existsSync(path.join(outDir, ref))) missing.push(ref);
  assert.deepEqual(missing, []);
});

test('only the page and its assets are published, not the scripts, tests and picture sources', () => {
  assert.ok(!fs.existsSync(path.join(outDir, 'scripts')));
  assert.ok(!fs.existsSync(path.join(outDir, 'tests')));
  assert.ok(!fs.existsSync(path.join(outDir, 'sources')));
});

/**
 * The kept sources of one kind of picture: each folder holds exactly the files listed, each a transparent PNG, and the
 * site shows exactly the pictures made from them.
 */
function checkSources(kind, list, folders) {
  const sourcesDir = path.join(siteDir, 'sources', kind);
  const items = JSON.parse(fs.readFileSync(path.join(sourcesDir, list), 'utf-8'));
  const files = items.map((item) => item.file).sort();
  for (const folder of folders) assert.deepEqual(fs.readdirSync(path.join(sourcesDir, folder)).sort(), files);
  for (const item of items) {
    // Byte 25 of a PNG is its colour type: 6 is RGBA
    const header = fs.readFileSync(path.join(sourcesDir, folders.at(-1), item.file)).subarray(0, 26);
    assert.equal(header[25], 6, `${item.file} has no transparency`);
  }
  const shown = fs.readdirSync(path.join(siteDir, 'img', kind)).map((file) => `img/${kind}/${file}`);
  const made = items.filter((item) => item.site).map((item) => item.site);
  assert.deepEqual(made.sort(), shown.sort());
  return items;
}

test('every car picture of the site can be made again from a kept source, with its prompt', () => {
  const cars = checkSources('cars', 'cars.json', ['originals', 'transparent']);
  for (const car of cars) {
    assert.match(car.prompt, new RegExp(`Race number "${car.car.split('#')[1]}"`), `${car.car}: not its prompt`);
  }
});

test('every driver portrait of the site can be made again from a kept source', () => {
  checkSources('drivers', 'drivers.json', ['portraits']);
});

test('the Windows installer offered is the one in the repository', () => {
  assert.deepEqual(
    fs.readFileSync(path.join(outDir, WINDOWS_INSTALLER)),
    fs.readFileSync(path.join(rootDir, WINDOWS_INSTALLER))
  );
});

test('the macOS installer comes zipped, unchanged and still executable', () => {
  const zip = path.join(outDir, MAC_DOWNLOAD);
  const listing = execFileSync('zipinfo', [zip], { encoding: 'utf-8' });
  const entry = listing.split('\n').find((line) => line.endsWith(MAC_INSTALLER));
  assert.ok(entry, `${MAC_INSTALLER} is not in the zip`);
  assert.match(entry, /^-rwxr-xr-x/);
  assert.deepEqual(
    execFileSync('unzip', ['-p', zip, MAC_INSTALLER]),
    fs.readFileSync(path.join(rootDir, MAC_INSTALLER))
  );
});

test('the page shows the version of the app it offers', () => {
  assert.ok(!built.includes('%VERSION%'));
  assert.match(built, new RegExp(`Version</span> ${appVersion().replaceAll('.', '\\.')}<`));
});
