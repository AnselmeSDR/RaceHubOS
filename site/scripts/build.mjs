// Assembles the GitHub Pages site: a page per language, with the app's version, its add-ons and its latest changes,
// the shared assets, and the two installers.
// Usage: node site/scripts/build.mjs [output folder, default _site]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import { LANGS, loadTexts } from './texts.mjs';

export const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const siteDir = path.join(rootDir, 'site');

// What the page needs; scripts/ and tests/ stay out of the published site
const ASSETS = ['index.html', 'styles.css', 'main.js', 'i18n.js', 'fonts', 'img'];
export const WINDOWS_INSTALLER = 'RaceHubOS-install-win.bat';
export const MAC_INSTALLER = 'RaceHubOS-install-mac.command';
// A .command downloaded on its own loses its execute bit; a zip keeps it
export const MAC_DOWNLOAD = 'RaceHubOS-install-mac.zip';

/**
 * A zip holding one file, marked as made on Unix with the given mode, so that the archive utilities of macOS
 * restore it executable whatever system built it. Dated 1980-01-01, so that the same file gives the same zip.
 */
export function zipFile(name, data, mode) {
  const deflated = zlib.deflateRawSync(data);
  const crc = zlib.crc32(data);
  const nameBytes = Buffer.from(name);
  const DOS_DATE = (1 << 5) | 1;

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4); // version needed: deflate
  local.writeUInt16LE(8, 8); // method: deflate
  local.writeUInt16LE(DOS_DATE, 12);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(deflated.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(nameBytes.length, 26);

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE((3 << 8) | 20, 4); // made by Unix, so the mode below is read
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(8, 10);
  central.writeUInt16LE(DOS_DATE, 14);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(deflated.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(nameBytes.length, 28);
  central.writeUInt32LE(((0o100000 | mode) << 16) >>> 0, 38); // regular file + permissions
  central.writeUInt32LE(0, 42); // offset of the local header

  const centralOffset = local.length + nameBytes.length + deflated.length;
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length + nameBytes.length, 12);
  end.writeUInt32LE(centralOffset, 16);

  return Buffer.concat([local, nameBytes, deflated, central, nameBytes, end]);
}

export function appVersion() {
  return JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf-8')).version;
}

export const SITE_URL = 'https://anselmesdr.github.io/RaceHubOS/';
/** Where the page of each language lives: English at the root of the site, the others in their own folder. */
export const PAGES = { en: '', fr: 'fr/', de: 'de/' };
const LOCALES = { en: 'en_GB', fr: 'fr_FR', de: 'de_DE' };
export const CHANGELOG_URL = 'https://github.com/AnselmeSDR/RaceHubOS/blob/main/CHANGELOG.md';
/** The sections of a version in the changelog (Keep a Changelog), and the text that names each one. */
/** How many versions "What's new" shows, the one offered first. */
export const NEWS_VERSIONS = 5;

export const CHANGE_KINDS = {
  Added: 'news.added',
  Changed: 'news.changed',
  Deprecated: 'news.deprecated',
  Removed: 'news.removed',
  Fixed: 'news.fixed',
  Security: 'news.security',
};

const escapeHtml = (text) =>
  String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

/** Where the element opened just before `from` closes: the start of its closing tag. */
function closingTag(html, name, from) {
  const tags = new RegExp(`<(/?)${name}\\b[^>]*>`, 'gi');
  tags.lastIndex = from;
  let depth = 1;
  for (let tag; (tag = tags.exec(html));) {
    depth += tag[1] ? -1 : 1;
    if (depth === 0) return tag.index;
  }
  throw new Error(`<${name}> never closes`);
}

/** The page with every text of one dictionary in place, as the visitor reads it: no script needed. */
export function translate(html, dict) {
  const t = (key, vars) => {
    if (!(key in dict)) throw new Error(`No text for ${key}`);
    return dict[key].replace(/\{(\w+)\}/g, (_, name) => String(vars?.[name] ?? ''));
  };
  // Attributes: alt, title, content and aria-label
  html = html.replace(/<[a-z][^>]*>/gi, (tag) => {
    for (const [, kind, key] of tag.matchAll(/\sdata-i18n-(alt|title|content|aria)="([^"]+)"/g)) {
      const attr = kind === 'aria' ? 'aria-label' : kind;
      const value = `${attr}="${escapeHtml(t(key))}"`;
      const current = new RegExp(`\\s${attr}="[^"]*"`);
      tag = current.test(tag) ? tag.replace(current, ` ${value}`) : tag.replace(/\s*(\/?)>$/, ` ${value}$1>`);
    }
    return tag;
  });
  // Contents: a text set as plain text, or as HTML when it holds a link
  const opening = /<([a-z][a-z0-9]*)\b[^>]*\sdata-i18n="([^"]+)"[^>]*>/gi;
  for (let match; (match = opening.exec(html));) {
    const [tag, name, key] = match;
    const start = match.index + tag.length;
    const end = closingTag(html, name, start);
    const vars = tag.match(/\sdata-vars='([^']+)'/);
    const text = key.endsWith('Html') ? t(key) : escapeHtml(t(key, vars && JSON.parse(vars[1])));
    html = html.slice(0, start) + text + html.slice(end);
    opening.lastIndex = start + text.length;
  }
  return html;
}

/** The add-ons of the catalog the app installs from. */
export function readCatalog() {
  return JSON.parse(fs.readFileSync(path.join(rootDir, 'addons/catalog.json'), 'utf-8')).addons;
}

function catalogHtml(lang) {
  return readCatalog()
    .map(
      (addon) =>
        `<li><a href="${escapeHtml(addon.repo)}"><b>${escapeHtml(addon.name[lang])}</b></a>` +
        `<p>${escapeHtml(addon.description[lang])}</p></li>`
    )
    .join('');
}

/** A version of the changelog: its date, and its entries by section, in the order they are written. */
export function readChangelog(version) {
  const text = fs.readFileSync(path.join(rootDir, 'CHANGELOG.md'), 'utf-8');
  const start = text.indexOf(`## [${version}]`);
  if (start < 0) throw new Error(`CHANGELOG.md has no section for ${version}`);
  const end = text.indexOf('\n## [', start + 1);
  const lines = text.slice(start, end < 0 ? undefined : end).split('\n');
  const date = lines[0].match(/(\d{4}-\d{2}-\d{2})/)?.[1];
  const sections = [];
  for (const line of lines.slice(1)) {
    const heading = line.match(/^### (\w+)/);
    const entries = sections.at(-1)?.entries;
    if (heading) sections.push({ kind: heading[1], entries: [] });
    else if (line.startsWith('- ')) entries.push(line.slice(2).trim());
    // A long entry goes on over the next, indented lines
    else if (/^\s+\S/.test(line) && entries?.length) entries[entries.length - 1] += ` ${line.trim()}`;
  }
  return { date, sections };
}

/** `count` versions of the changelog from `version` down, in the order they are written. */
export function recentVersions(version, count) {
  const text = fs.readFileSync(path.join(rootDir, 'CHANGELOG.md'), 'utf-8');
  const versions = [...text.matchAll(/^## \[(\d+\.\d+\.\d+)\]/gm)].map((m) => m[1]);
  const start = versions.indexOf(version);
  if (start < 0) throw new Error(`CHANGELOG.md has no section for ${version}`);
  return versions.slice(start, start + count);
}

/** An entry of the changelog: its Markdown code, bold and links, the rest as plain text. */
const markdown = (entry) =>
  escapeHtml(entry)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2">$1</a>');

/** One version: its number, its date and its changes by section. */
function releaseHtml(lang, version) {
  const { date, sections } = readChangelog(version);
  const day = new Intl.DateTimeFormat(lang, { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(date));
  const changes = sections
    .filter((section) => section.entries.length)
    .map((section) => {
      const name = CHANGE_KINDS[section.kind];
      if (!name) throw new Error(`CHANGELOG.md: unknown section ${section.kind}`);
      const entries = section.entries.map((entry) => `<li>${markdown(entry)}</li>`).join('');
      // The changelog is written in English
      return `<div class="change"><h4 data-i18n="${name}"></h4><ul lang="en">${entries}</ul></div>`;
    })
    .join('');
  return `<article class="release"><h3>Version ${version} <time datetime="${date}">${day}</time></h3><div class="changes">${changes}</div></article>`;
}

/** The last versions, the one offered first; a note on the other pages: the changelog is written in English. */
function newsHtml(lang, version) {
  const note = lang === 'en' ? '' : '<p class="muted" data-i18n="news.english"></p>';
  return (
    note +
    recentVersions(version, NEWS_VERSIONS)
      .map((each) => releaseHtml(lang, each))
      .join('')
  );
}

/** The links of a page to itself and to its versions in the other languages, for search engines and shares. */
function headLinks(lang) {
  const url = (other) => SITE_URL + PAGES[other];
  return [
    `<link rel="canonical" href="${url(lang)}" />`,
    ...LANGS.map((other) => `<link rel="alternate" hreflang="${other}" href="${url(other)}" />`),
    `<link rel="alternate" hreflang="x-default" href="${SITE_URL}" />`,
    `<meta property="og:url" content="${url(lang)}" />`,
    `<meta property="og:locale" content="${LOCALES[lang]}" />`,
  ].join('\n    ');
}

/** The page of one language, written in its folder: its texts, its captures and the paths to the shared files. */
export function renderPage(template, lang, texts, version) {
  const up = PAGES[lang] ? '../' : '';
  let html = template
    .replaceAll('%VERSION%', version)
    .replace(/(<ul class="catalog"[^>]*>)(<\/ul>)/, `$1${catalogHtml(lang)}$2`)
    .replace(/(<div class="news-body"[^>]*>)(<\/div>)/, `$1${newsHtml(lang, version)}$2`);
  html = translate(html, texts[lang]);
  html = html
    .replace('<html lang="en">', `<html lang="${lang}"${up ? ` data-root="${up}"` : ''}>`)
    .replaceAll('src="img/en/', `src="img/${lang}/`)
    .replaceAll(`${SITE_URL}img/en/`, `${SITE_URL}img/${lang}/`)
    .replace('</head>', `  ${headLinks(lang)}\n  </head>`);
  // Every file is shared by the pages, at the root of the site
  if (up) html = html.replace(/\s(src|href)="(?!https?:|#|mailto:|data:|\/)([^"]*)"/g, ` $1="${up}$2"`);
  // The languages: a link to each page, the page's own marked as the current one
  return html.replace(/<a\b[^>]*\sdata-lang="(\w+)"[^>]*>/g, (tag, other) => {
    const href = `${up}${PAGES[other]}` || './';
    tag = tag.replace(/\shref="[^"]*"/, ` href="${href}"`);
    return other === lang ? tag.replace(/>$/, ' aria-current="page">') : tag;
  });
}

/** The pages of the site, for search engines, each with its versions in the other languages. */
function sitemap() {
  const alternates = LANGS.map(
    (lang) => `<xhtml:link rel="alternate" hreflang="${lang}" href="${SITE_URL}${PAGES[lang]}"/>`
  ).join('');
  const urls = LANGS.map((lang) => `<url><loc>${SITE_URL}${PAGES[lang]}</loc>${alternates}</url>`).join('\n');
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' +
    `${urls}\n</urlset>\n`
  );
}

export function buildSite(outDir) {
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  for (const asset of ASSETS.filter((asset) => asset !== 'index.html')) {
    fs.cpSync(path.join(siteDir, asset), path.join(outDir, asset), { recursive: true });
  }
  const template = fs.readFileSync(path.join(siteDir, 'index.html'), 'utf-8');
  const texts = loadTexts();
  const version = appVersion();
  for (const lang of LANGS) {
    const page = path.join(outDir, PAGES[lang], 'index.html');
    fs.mkdirSync(path.dirname(page), { recursive: true });
    fs.writeFileSync(page, renderPage(template, lang, texts, version));
  }
  fs.writeFileSync(path.join(outDir, 'sitemap.xml'), sitemap());

  fs.copyFileSync(path.join(rootDir, WINDOWS_INSTALLER), path.join(outDir, WINDOWS_INSTALLER));
  const installer = fs.readFileSync(path.join(rootDir, MAC_INSTALLER));
  fs.writeFileSync(path.join(outDir, MAC_DOWNLOAD), zipFile(MAC_INSTALLER, installer, 0o755));
  return outDir;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const outDir = path.resolve(process.argv[2] ?? path.join(rootDir, '_site'));
  buildSite(outDir);
  console.log(`Site built in ${outDir}`);
}
