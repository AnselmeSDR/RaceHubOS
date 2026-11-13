// Contracts of the published site: a page per language, the files it links to, the add-ons and changes it lists, the
// installers it offers.
// Run: node --test 'site/tests/*.test.mjs'
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { LANGS, loadTexts } from '../scripts/texts.mjs';
import {
  CHANGE_KINDS,
  NEWS_VERSIONS,
  MAC_DOWNLOAD,
  MAC_INSTALLER,
  PAGES,
  SITE_URL,
  WINDOWS_INSTALLER,
  appVersion,
  buildSite,
  readCatalog,
  readChangelog,
  recentVersions,
  rootDir,
} from '../scripts/build.mjs';

const siteDir = path.join(rootDir, 'site');
const page = fs.readFileSync(path.join(siteDir, 'index.html'), 'utf-8');

const texts = loadTexts();
let outDir;
// The built page of each language
const built = {};

before(() => {
  outDir = buildSite(fs.mkdtempSync(path.join(os.tmpdir(), 'racehubos-site-')));
  for (const lang of LANGS) built[lang] = fs.readFileSync(path.join(outDir, PAGES[lang], 'index.html'), 'utf-8');
});

/** The text a part of a page shows, without its tags: words go on through inline tags, not past a block. */
const plain = (html) =>
  html
    .replace(/<\/?(?:a|b|code)\b[^>]*>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&amp;', '&')
    .replace(/\s+/g, ' ')
    .trim();

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
  // Texts the build writes: the sections of the changelog, the note on its language
  const build = fs.readFileSync(path.join(siteDir, 'scripts/build.mjs'), 'utf-8');
  const inScript = [...`${script}\n${build}`.matchAll(/'([a-z]+\.[a-zA-Z]+)'|data-i18n="([a-z]+\.[a-zA-Z]+)"/g)].map(
    (m) => m[1] ?? m[2]
  );
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

test('the built site holds every file each page points to', () => {
  const missing = [];
  const local = (ref) => !/^(https?:|mailto:|#)/.test(ref);
  const css = fs.readFileSync(path.join(outDir, 'styles.css'), 'utf-8');
  for (const ref of [...css.matchAll(/url\('([^']+)'\)/g)].map((m) => m[1]).filter(local)) {
    if (!fs.existsSync(path.join(outDir, ref))) missing.push(`styles.css: ${ref}`);
  }
  for (const lang of LANGS) {
    const html = built[lang];
    // A page in a folder reaches the shared files with ../
    const refs = [...html.matchAll(/\s(?:src|href)="([^"]+)"/g)].map((m) => m[1]).filter(local);
    // The captures of every screen of the tour, in the language of the page and in both themes
    const shots = [...html.matchAll(/data-(?:shot|screen)="([^"]+)"/g)].map((m) => m[1]);
    for (const shot of new Set(shots)) {
      for (const theme of ['', 'dark/']) {
        const capture = `img/${lang}/${theme}${shot}.webp`;
        if (!fs.existsSync(path.join(outDir, capture))) missing.push(`${lang}: ${capture}`);
      }
    }
    for (const ref of new Set(refs)) {
      const file = path.join(outDir, PAGES[lang], ref.endsWith('/') ? `${ref}index.html` : ref);
      if (!fs.existsSync(file)) missing.push(`${lang}: ${ref}`);
    }
    for (const [, image] of html.matchAll(/property="og:image" content="([^"]+)"/g)) {
      assert.ok(image.startsWith(`${SITE_URL}img/${lang}/`), `${lang}: shared with ${image}`);
      if (!fs.existsSync(path.join(outDir, image.slice(SITE_URL.length)))) missing.push(`${lang}: ${image}`);
    }
  }
  assert.deepEqual(missing, []);
});

test('each language has its page, in that language, and tells search engines where the others are', () => {
  const url = (lang) => SITE_URL + PAGES[lang];
  for (const lang of LANGS) {
    const html = built[lang];
    assert.match(html, new RegExp(`<html lang="${lang}"`));
    assert.ok(html.includes(`<title data-i18n="meta.title">${texts[lang]['meta.title']}</title>`), lang);
    assert.ok(html.includes(`<link rel="canonical" href="${url(lang)}" />`), lang);
    for (const other of LANGS) {
      assert.ok(
        html.includes(`<link rel="alternate" hreflang="${other}" href="${url(other)}" />`),
        `${lang} > ${other}`
      );
    }
    assert.ok(html.includes(`<link rel="alternate" hreflang="x-default" href="${SITE_URL}" />`), lang);
    // The language links lead to the pages, this one marked as the current one
    const links = [...html.matchAll(/<a\b[^>]*data-lang="(\w+)"[^>]*>/g)];
    assert.deepEqual(links.map((m) => m[1]).sort(), LANGS);
    for (const [tag, other] of links) {
      const href = tag.match(/href="([^"]*)"/)[1];
      assert.equal(new URL(href, url(lang)).href, url(other), `${lang}: link to ${other}`);
      assert.equal(tag.includes('aria-current="page"'), other === lang, `${lang}: link to ${other}`);
    }
  }
  const sitemap = fs.readFileSync(path.join(outDir, 'sitemap.xml'), 'utf-8');
  assert.deepEqual([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).sort(), LANGS.map(url).sort());
});

test('each page lists the add-ons of the catalog the app installs from, in its language, with their code', () => {
  const addons = readCatalog();
  assert.ok(addons.length > 0);
  for (const lang of LANGS) {
    const catalog = built[lang].match(/<ul class="catalog">([\s\S]*?)<\/ul>/)[1];
    assert.equal(catalog.match(/<li>/g).length, addons.length, lang);
    for (const addon of addons) {
      assert.ok(catalog.includes(`<a href="${addon.repo}">`), `${lang}: ${addon.id}`);
      assert.ok(plain(catalog).includes(`${addon.name[lang]} ${addon.description[lang]}`), `${lang}: ${addon.id}`);
    }
  }
});

test('each page shows the changes of the last versions, the one it offers first, with their date', () => {
  const versions = recentVersions(appVersion(), NEWS_VERSIONS);
  assert.equal(versions[0], appVersion());
  assert.equal(versions.length, NEWS_VERSIONS);
  for (const lang of LANGS) {
    const news = built[lang].match(/<section class="news"[\s\S]*?<\/section>/)[0];
    const releases = [...news.matchAll(/<article class="release">[\s\S]*?<\/article>/g)].map((m) => m[0]);
    assert.equal(releases.length, NEWS_VERSIONS, lang);
    versions.forEach((version, n) => {
      const { date, sections } = readChangelog(version);
      assert.match(date, /^\d{4}-\d{2}-\d{2}$/);
      assert.ok(plain(releases[n]).startsWith(`Version ${version}`), `${lang}: ${version}`);
      assert.ok(releases[n].includes(`<time datetime="${date}">`), `${lang}: ${version}`);
      for (const section of sections.filter((s) => s.entries.length)) {
        assert.ok(plain(releases[n]).includes(texts[lang][CHANGE_KINDS[section.kind]]), `${lang}: ${section.kind}`);
        for (const entry of section.entries) {
          assert.ok(plain(releases[n]).includes(plain(entry.replaceAll('`', ''))), `${lang}: ${entry}`);
        }
      }
    });
    assert.ok(plain(news).includes(texts[lang]['news.title']), lang);
    // The notes are in English: the other pages say so
    assert.equal(news.includes(texts[lang]['news.english']), lang !== 'en', lang);
  }
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

test('each page shows the version of the app it offers', () => {
  for (const lang of LANGS) {
    assert.ok(!built[lang].includes('%VERSION%'), lang);
    assert.ok(built[lang].includes(`${texts[lang]['hero.version']}</span> ${appVersion()}<`), lang);
  }
});
