#!/usr/bin/env node
/**
 * App screenshots for the website, for fr, en and de, in the two themes of the site: site/img/<lang>/<name>.webp
 * (light) and site/img/<lang>/dark/<name>.webp.
 *
 *   node site/scripts/screenshots.mjs                      the screens of the website (SITE_SCREENS)
 *   node site/scripts/screenshots.mjs --only=race,podium   some of them, or of EXTRA_SCREENS (the others are kept)
 *   node site/scripts/screenshots.mjs --keep               keep the work folder (logs, database)
 *
 * Run from anywhere; needs sqlite3, git, cwebp and the Playwright Chromium (`npx playwright install chromium`).
 *
 * What it does, all in a temporary folder removed at the end:
 * 1. Copies the race database packages/backend/prisma/dev.db, read-only (`sqlite3 -readonly … VACUUM INTO`),
 *    then anonymizes the copy: KEPT_DRIVERS and the drivers already under a fictional name keep their name and
 *    illustrated portrait; any other driver gets a fictional name and no photo; no email.
 *    dev.db itself is never opened for writing, migrated, nor served.
 * 2. Applies pending core migrations to the copy, clones the public add-on car-service at a fixed tag into
 *    its own add-ons folder and marks it installed from the catalog.
 * 3. Starts the backend (port 3301, mock device) and Vite (port 5301) on that copy and folder, the same pair
 *    as packages/frontend/playwright.config.js, then gives a few cars a service interval or a service.
 *    The backend loads BACKEND_PATCH: a dropped image download crashes the server (see there).
 * 4. Captures each screen in each language with Playwright (1440x900, x2), in light then dark mode (THEMES),
 *    converts it to WebP.
 *    Silent: Chromium muted, speech synthesis stubbed (the app announces the race out loud).
 *    The sessions shown get their type word in the language of the capture ("Course 3" → "Race 3").
 *
 * The race (screens race and podium) is driven like a user would, once per language:
 *   - POST /api/bluetooth/connect { address: 'SIMULATOR' }            Settings > Device > Simulator
 *   - POST /api/sessions { trackId, type: 'race', status: 'draft' }   Free Mode, type Race, "New session"
 *   - PUT  /api/sessions/:id/drivers { drivers: [{ controller, driverId, carId }] }   the controllers table
 *   - open /race (Free Mode, the track, type Race), click "Start" (POST /api/sessions/:id/start: lights 1/5),
 *     click "START" on the lights (POST /api/bluetooth/start-race: countdown, then racing), race ~30 s
 *   - click "Finish" (POST /api/sessions/:id/stop): the session ends and its podium shows
 */
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

// ==================== Settings ====================

/** Drivers shown under their real name, first on the grid of the race. */
const KEPT_DRIVERS = ['Anselme SDR', 'Romain DAN'];

/**
 * Fictional names of the other drivers: a common first name and a three-letter code, like the real ones. No
 * celebrity, no racing driver. The race database uses them, each with an illustrated portrait: those drivers are
 * shown as they are. A driver under any other name gets the first name of the list still free, and no photo.
 */
const FICTIONAL_NAMES = [
  'Émilie DUV',
  'Lukas BRE',
  'Sophie HAR',
  'Damien PEL',
  'Hannah KRA',
  'Oliver ASH',
  'Manon LEF',
  'Felix WAG',
  'Grace MOL',
  'Hugo BLA',
  'Lena FIS',
  'Thomas RIV',
  'Clara STE',
  'Nathan COR',
  'Amelia GRE',
  'Maxime DUR',
  'Marie LAN',
  'Jonas HOF',
  'Léa BOU',
  'Tobias KEL',
  'Sarah MIL',
  'Antoine GIR',
  'Anna ZIM',
  'Henry WAL',
  'Inès ROU',
  'Moritz BEC',
  'Lucy PAR',
  'Mathis KRO',
  'Jana WEI',
  'Adrien FAU',
  'Ella COO',
  'Niklas VOG',
  'Océane PIC',
  'Samuel DRE',
  'Leonie HAU',
  'Quentin MEU',
  'Mia ROT',
  'Arthur LEM',
  'Lily HOL',
  'Jakob NEU',
];

const LANGS = { fr: 'fr-FR', en: 'en-GB', de: 'de-DE' };

/** The free race: KEPT_DRIVERS and the four other drivers with the most laps, on these cars, controller 0 to 5. */
const RACE = {
  track: 'CREUTZWALD RING open',
  cars: [
    'Porsche 911 GT3 R #75',
    'Ferrari 488 GT3 #23',
    'BMW M4 GT3 #11',
    'Lamborghini Huracán GT3 evo II #92',
    'McLaren 720S GT3 #02',
    'Audi R8 LMS GT3 #8',
  ],
  // Racing time before the race screenshot, once every car has MIN_LAPS laps (at most MAX_SECONDS)
  seconds: 30,
  minLaps: 3,
  maxSeconds: 75,
};

const CHAMPIONSHIP = 'FINALE C200';

/** Balancing chart: laps slower than this (crashes, cars back on the track) are left out. */
const BALANCING_MAX_LAP_MS = 15000;

const ADDON = {
  id: 'car-service',
  repo: 'https://github.com/AnselmeSDR/racehubos-car-service',
  ref: 'v0.2.0',
};

/**
 * Car service add-on, set through its API: intervals (laps), and services done — each then dated back to
 * when the car had the given number of laps left to drive until today, so the page shows real dates and
 * cars at every stage of their interval, not only "never serviced".
 */
const CAR_SERVICE = {
  intervals: {
    'Audi R8 LMS GT3 #8': 2000,
    'McLaren 720S GT3 #02': 1500,
    'Chevrolet Corvette C7R #3': 1000,
    'Audi R8 LMS GT3 #16': 1200,
    'BMW M1 Procar #1': 500,
    'BMW M1 Procar #7': 500,
  },
  serviced: {
    'Lamborghini Huracán GT3 evo II #92': 255,
    'Porsche 911 GT3 R #75': 180,
    'BMW M4 GT3 #11': 150,
    'Ferrari 488 GT3 #23': 60,
  },
};

/** The screens the website shows, captured by default. */
const SITE_SCREENS = ['race', 'podium', 'championship', 'stats', 'balancing', 'addons', 'car-service'];
/** Not on the website: only with --only. */
const EXTRA_SCREENS = ['dashboard', 'championship-results', 'addons-installed'];
const STATIC_SCREENS = [
  'dashboard',
  'stats',
  'championship',
  'championship-results',
  'balancing',
  'addons',
  'addons-installed',
];
const SCREENS = [...SITE_SCREENS, ...EXTRA_SCREENS];

const BACKEND_PORT = 3301;
const FRONTEND_PORT = 5301;
const API = `http://localhost:${BACKEND_PORT}`;
const APP = `http://localhost:${FRONTEND_PORT}`;
const VIEWPORT = { width: 1440, height: 900 };
const WEBP_QUALITY = 82;
const WEBP_MAX_BYTES = 400 * 1024;

const ROOT = path.resolve(import.meta.dirname, '../..');
const BACKEND_DIR = path.join(ROOT, 'packages/backend');
const FRONTEND_DIR = path.join(ROOT, 'packages/frontend');
const LOCALES_DIR = path.join(FRONTEND_DIR, 'src/i18n/locales');
const DEV_DB = path.join(BACKEND_DIR, 'prisma/dev.db');
const OUT_DIR = path.join(ROOT, 'site/img');
const CWEBP = process.env.CWEBP || 'cwebp';

const args = process.argv.slice(2);
const KEEP = args.includes('--keep');
const only = args
  .find((a) => a.startsWith('--only='))
  ?.slice('--only='.length)
  .split(',')
  .filter(Boolean);
const wanted = (name) => (only ? only.includes(name) : SITE_SCREENS.includes(name));

// ==================== Helpers ====================

const started = Date.now();
const log = (...parts) => console.log(`[${((Date.now() - started) / 1000).toFixed(1).padStart(6)}s]`, ...parts);
const problems = [];
const problem = (text) => {
  problems.push(text);
  log(`⚠️  ${text}`);
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const sqlText = (value) => `'${String(value).replace(/'/g, "''")}'`;

/** Runs SQL on a database with the sqlite3 command line; rows as objects with `json`. */
function sqlite(db, sql, { json = false, readonly = false } = {}) {
  const flags = [...(readonly ? ['-readonly'] : []), ...(json ? ['-json'] : [])];
  const out = execFileSync('sqlite3', [...flags, db, sql], { encoding: 'utf-8' });
  return json ? (out.trim() ? JSON.parse(out) : []) : out;
}

const localeCache = new Map();
/** A text of the interface, from its locale files. */
function t(lang, ns, key) {
  const file = path.join(LOCALES_DIR, lang, `${ns}.json`);
  if (!localeCache.has(file)) localeCache.set(file, JSON.parse(fs.readFileSync(file, 'utf-8')));
  const value = key.split('.').reduce((node, part) => node?.[part], localeCache.get(file));
  if (typeof value !== 'string') throw new Error(`No text ${lang}/${ns}:${key}`);
  return value;
}

/**
 * A session name in `lang`: its leading type word ("Course 3 - Div 2", named by the interface language of
 * the day) given in that language; other names unchanged.
 */
function sessionNameIn(lang, name) {
  if (!name) return name;
  for (const type of ['practice', 'qualif', 'race', 'balancing']) {
    for (const key of [`sessionType.${type}`, `sessionTypeFull.${type}`]) {
      for (const from of Object.keys(LANGS)) {
        const word = t(from, 'glossary', key);
        if (name === word || name.startsWith(`${word} `)) return t(lang, 'glossary', key) + name.slice(word.length);
      }
    }
  }
  return name;
}

/** Names the sessions shown on a screen in the language of the capture, as a user of that language would. */
async function nameSessions(lang, sessions) {
  for (const { id, name } of sessions) {
    const named = sessionNameIn(lang, name);
    if (named !== name) await api('PUT', `/api/sessions/${id}`, { name: named });
  }
}

async function api(method, url, body) {
  const res = await fetch(`${API}${url}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) throw new Error(`${method} ${url}: ${res.status} ${data.error ?? ''}`);
  return data;
}

function portFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => server.close(() => resolve(true)));
    server.listen(port);
  });
}

async function waitUntil(what, check, { timeout = 60000, every = 500 } = {}) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await check().catch(() => false)) return;
    await sleep(every);
  }
  throw new Error(`Timed out waiting for ${what}`);
}

// ==================== Processes ====================

let tmp = null;
let browser = null;
let stopping = false;
const children = [];

function startProcess(name, command, commandArgs, { cwd, env }) {
  const logFile = path.join(tmp, `${name}.log`);
  const out = fs.openSync(logFile, 'a');
  // Its own process group: npx and Node children all go with it
  const child = spawn(command, commandArgs, { cwd, env, detached: true, stdio: ['ignore', out, out] });
  const entry = { name, child, logFile, exited: false };
  child.on('exit', (code, signal) => {
    entry.exited = true;
    if (!stopping) problem(`${name} stopped (${code ?? signal}):\n${logTail(entry, 40)}`);
  });
  children.push(entry);
  return entry;
}

const logTail = (entry, lines = 30) =>
  fs.existsSync(entry.logFile) ? fs.readFileSync(entry.logFile, 'utf-8').split('\n').slice(-lines).join('\n') : '';

async function stopProcesses() {
  const signal = (entry, sig) => {
    try {
      process.kill(-entry.child.pid, sig);
    } catch {
      // already gone
    }
  };
  for (const entry of children) if (!entry.exited) signal(entry, 'SIGTERM');
  const end = Date.now() + 6000;
  while (children.some((e) => !e.exited) && Date.now() < end) await sleep(200);
  for (const entry of children) {
    // the group may outlive its leader (npx → vite)
    signal(entry, 'SIGKILL');
  }
}

async function cleanup() {
  if (stopping) return;
  stopping = true;
  await browser?.close().catch(() => {});
  await stopProcesses();
  if (tmp) {
    if (KEEP) log(`Work folder kept: ${tmp}`);
    else fs.rmSync(tmp, { recursive: true, force: true });
  }
}

for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(sig, () => {
    log(`${sig}: stopping`);
    cleanup().finally(() => process.exit(130));
  });
}

// Last resort, whatever ends the script: the servers and the work folder go with it
process.on('exit', () => {
  for (const entry of children) {
    try {
      process.kill(-entry.child.pid, 'SIGKILL');
    } catch {
      // already gone
    }
  }
  if (tmp && !KEEP) fs.rmSync(tmp, { recursive: true, force: true });
});

// ==================== Demo database ====================

function copyDatabase(db) {
  // -readonly: the race database is only read, even while the user's server holds it
  sqlite(DEV_DB, `VACUUM INTO ${sqlText(db)}`, { readonly: true });
  log(`Database copied to ${db}`);
}

/** A fictional name for the n-th renamed driver; past the list, first names and codes are recombined. */
function fictionalName(n) {
  const count = FICTIONAL_NAMES.length;
  if (n < count) return FICTIONAL_NAMES[n];
  const first = FICTIONAL_NAMES[n % count].split(' ')[0];
  const code = FICTIONAL_NAMES[(n + Math.floor(n / count) * 7) % count].split(' ').pop();
  return `${first} ${code}`;
}

/** Renames the drivers under a name of neither list, without photo, and clears what would reach a real person. */
function anonymize(db) {
  const drivers = sqlite(db, 'SELECT id, name FROM Driver ORDER BY id', { json: true });
  for (const name of KEPT_DRIVERS) {
    if (!drivers.some((d) => d.name === name)) problem(`Kept driver "${name}" not found in the database`);
  }
  const shown = drivers.filter((d) => KEPT_DRIVERS.includes(d.name) || FICTIONAL_NAMES.includes(d.name));
  const others = drivers.filter((d) => !shown.includes(d));
  const free = FICTIONAL_NAMES.filter((name) => !drivers.some((d) => d.name === name));
  const statements = others.map(
    (driver, n) =>
      `UPDATE Driver SET name = ${sqlText(free[n] ?? fictionalName(FICTIONAL_NAMES.length + n))}, img = NULL WHERE id = ${sqlText(driver.id)};`
  );

  statements.push(
    'UPDATE Driver SET email = NULL;',
    // A free-text copy of a driver's name
    'UPDATE Track SET bestLapBy = NULL;',
    // No Bluetooth attempt at start
    `INSERT INTO Preference (key, value, updatedAt) VALUES ('autoConnect', 'false', ${Date.now()})
       ON CONFLICT(key) DO UPDATE SET value = 'false';`
  );
  sqlite(db, `BEGIN;\n${statements.join('\n')}\nCOMMIT;`);

  // Any old name still written somewhere the screens show
  const texts = [
    ['Session', 'name'],
    ['Championship', 'name'],
    ['Team', 'name'],
    ['Track', 'name'],
    ['Car', 'brand'],
    ['Car', 'model'],
    ['Car', 'notes'],
    ['Device', 'name'],
    ['Preference', 'value'],
  ];
  for (const { name } of others) {
    const needles = [name, name.split(' ')[0]].filter((n) => n.length >= 4);
    for (const needle of needles) {
      for (const [table, column] of texts) {
        const found = sqlite(db, `SELECT COUNT(*) AS n FROM ${table} WHERE ${column} LIKE ${sqlText(`%${needle}%`)}`, {
          json: true,
        })[0].n;
        if (found > 0) problem(`"${needle}" still appears in ${table}.${column} (${found} rows)`);
      }
    }
  }
  log(`Anonymized: ${others.length} drivers renamed, ${shown.length} shown as in the database`);
}

function migrate(db) {
  // Never on dev.db: DATABASE_URL is the copy, passed explicitly (prisma.config.js would read .env otherwise)
  const out = execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    cwd: BACKEND_DIR,
    env: { ...process.env, DATABASE_URL: `file:${db}`, RUST_LOG: 'info' },
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const applied = /No pending migrations/i.test(out) ? 'none pending' : out.trim().split('\n').slice(-3).join(' / ');
  log(`Migrations: ${applied}`);
}

/** Ids the captures need, read from the demo database. */
function lookups(db) {
  const one = (sql, what) => {
    const rows = sqlite(db, sql, { json: true });
    if (rows.length === 0) throw new Error(`Not found in the database: ${what}`);
    return rows[0];
  };
  const trackId = one(
    `SELECT id FROM Track WHERE name = ${sqlText(RACE.track)} AND deletedAt IS NULL`,
    `track ${RACE.track}`
  ).id;
  const cars = new Map(
    sqlite(db, "SELECT id, brand || ' ' || model AS label FROM Car WHERE deletedAt IS NULL", { json: true }).map(
      (c) => [c.label, c.id]
    )
  );
  const carId = (label) => {
    if (!cars.has(label)) throw new Error(`Car not found: ${label}`);
    return cars.get(label);
  };
  const kept = KEPT_DRIVERS.map(
    (name) => one(`SELECT id FROM Driver WHERE name = ${sqlText(name)} AND deletedAt IS NULL`, `driver ${name}`).id
  );
  const others = sqlite(
    db,
    `SELECT d.id FROM Driver d LEFT JOIN Lap l ON l.driverId = d.id AND l.deletedAt IS NULL
     WHERE d.deletedAt IS NULL AND d.isReference = 0 AND d.id NOT IN (${kept.map(sqlText).join(', ')})
     GROUP BY d.id ORDER BY COUNT(l.id) DESC, d.id LIMIT ${6 - kept.length}`,
    { json: true }
  ).map((d) => d.id);
  const grid = [...kept, ...others].map((driverId, controller) => ({
    controller,
    driverId,
    carId: carId(RACE.cars[controller]),
  }));

  const championshipId = one(
    `SELECT id FROM Championship WHERE name = ${sqlText(CHAMPIONSHIP)} AND deletedAt IS NULL`,
    `championship ${CHAMPIONSHIP}`
  ).id;

  // The balancing page opens the latest balancing session of its track: the track whose latest one has most laps
  const balancingTrackId = one(
    `SELECT s.trackId AS id, (SELECT COUNT(*) FROM Lap l WHERE l.sessionId = s.id AND l.deletedAt IS NULL) AS laps
     FROM Session s
     WHERE s.type = 'balancing' AND s.championshipId IS NULL AND s.deletedAt IS NULL
       AND s.createdAt = (SELECT MAX(o.createdAt) FROM Session o WHERE o.type = 'balancing'
                          AND o.championshipId IS NULL AND o.deletedAt IS NULL AND o.trackId = s.trackId)
     ORDER BY laps DESC LIMIT 1`,
    'a balancing session'
  ).id;

  const balancingSessionId = one(
    `SELECT id FROM Session WHERE type = 'balancing' AND championshipId IS NULL AND deletedAt IS NULL
       AND trackId = ${sqlText(balancingTrackId)} ORDER BY createdAt DESC LIMIT 1`,
    'the balancing session'
  ).id;
  const championshipSessions = sqlite(
    db,
    `SELECT id, name FROM Session WHERE championshipId = ${sqlText(championshipId)} AND deletedAt IS NULL`,
    { json: true }
  );

  return { trackId, grid, carId, championshipId, championshipSessions, balancingTrackId, balancingSessionId };
}

// ==================== Add-on ====================

function installAddon(addonsDir) {
  const dir = path.join(addonsDir, ADDON.id);
  execFileSync(
    'git',
    ['-c', 'advice.detachedHead=false', 'clone', '--quiet', '--depth', '1', '--branch', ADDON.ref, ADDON.repo, dir],
    {
      // stderr kept for the error, not shown: git warns about the annotated tag of a shallow clone
      stdio: ['ignore', 'ignore', 'pipe'],
    }
  );
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'racehubos-addon.json'), 'utf-8'));
  // As the Add-ons page leaves it after an install from the catalog (packages/shared/src/addons/state.js)
  const dataDir = path.join(addonsDir, '.data');
  fs.mkdirSync(dataDir, { recursive: true });
  const state = {
    disabled: {},
    installed: {
      [manifest.id]: {
        source: 'catalog',
        repo: ADDON.repo,
        ref: ADDON.ref,
        version: manifest.version,
        at: new Date().toISOString(),
      },
    },
    purge: [],
  };
  fs.writeFileSync(path.join(dataDir, 'state.json'), JSON.stringify(state, null, 2) + '\n');
  // The local copy of the catalog, read only if GitHub can't be reached
  fs.copyFileSync(path.join(ROOT, 'addons/catalog.json'), path.join(addonsDir, 'catalog.json'));
  log(`Add-on ${manifest.id} ${manifest.version} installed in ${dir}`);
}

async function setUpCarService(ids, db, addonsDir) {
  const base = `/api/addons/${ADDON.id}/cars`;
  for (const [label, laps] of Object.entries(CAR_SERVICE.intervals)) {
    await api('PUT', `${base}/${ids.carId(label)}/interval`, { laps });
  }

  // Each service through the API, then dated back in the add-on's own database (the API only records "now")
  const services = path.join(addonsDir, '.data', ADDON.id, `${ADDON.id}.sqlite`);
  for (const [label, lapsSince] of Object.entries(CAR_SERVICE.serviced)) {
    const carId = ids.carId(label);
    await api('POST', `${base}/${carId}/service`);
    const [lap] = sqlite(
      db,
      `SELECT timestamp FROM Lap WHERE carId = ${sqlText(carId)} AND deletedAt IS NULL
       ORDER BY timestamp DESC LIMIT 1 OFFSET ${lapsSince}`,
      { json: true }
    );
    if (!lap) {
      problem(`${label}: fewer than ${lapsSince} laps, service left today`);
      continue;
    }
    // What the car had covered when serviced: its laps up to then, as the add-on counts them
    const [before] = sqlite(
      db,
      `SELECT COUNT(*) AS laps, COALESCE(SUM(t.length), 0) AS distance FROM Lap l JOIN Track t ON t.id = l.trackId
       WHERE l.carId = ${sqlText(carId)} AND l.deletedAt IS NULL AND l.timestamp <= ${lap.timestamp}`,
      { json: true }
    );
    sqlite(
      services,
      `UPDATE service SET done_at = ${lap.timestamp}, laps = ${before.laps}, distance = ${before.distance}
       WHERE car_id = ${sqlText(carId)}`
    );
  }

  const { data } = await api('GET', base);
  log(`Car service: ${data.filter((s) => s.due).length} cars due, ${data.filter((s) => !s.due).length} fine`);
}

// ==================== Servers ====================

/**
 * A fix of RaceHubOS, loaded in the capture's backend only; everything else runs unchanged.
 *
 * An image download the browser drops halfway (a page left, a context closed) kills the backend: the
 * sendFile callback of /api/img (server/coreRoutes.js) answers 404 after the headers went out, and that
 * throw is uncaught. Here sendFile callbacks are not called for a response already sent.
 */
const BACKEND_PATCH = ({ expressUrl }) => `
import express from ${JSON.stringify(expressUrl)}

const sendFile = express.response.sendFile
express.response.sendFile = function (file, options, callback) {
  const done = typeof options === 'function' ? options : callback
  if (!done) return sendFile.call(this, file, options)
  const opts = typeof options === 'function' ? undefined : options
  return sendFile.call(this, file, opts, (err) => {
    // The client went away mid-file: nothing left to answer
    if (err && this.headersSent) return
    done(err)
  })
}
`;

async function startServers(db, addonsDir) {
  for (const port of [BACKEND_PORT, FRONTEND_PORT]) {
    if (!(await portFree(port))) throw new Error(`Port ${port} is already in use`);
  }

  const backendEnv = {
    ...process.env,
    DATABASE_URL: `file:${db}`,
    PORT: String(BACKEND_PORT),
    USE_MOCK_DEVICE: 'true',
    RACEHUBOS_ADDONS_DIR: addonsDir,
  };
  // The Market reads the online catalog
  delete backendEnv.RACEHUBOS_CATALOG_URL;
  const patch = path.join(tmp, 'backend-patch.mjs');
  fs.writeFileSync(
    patch,
    BACKEND_PATCH({
      // The backend's own express (same module instance)
      expressUrl: pathToFileURL(createRequire(path.join(BACKEND_DIR, 'package.json')).resolve('express')).href,
    })
  );
  const backend = startProcess(
    'backend',
    'node',
    ['--import', './src/addons/preload.js', '--import', pathToFileURL(patch).href, 'src/index.js'],
    { cwd: BACKEND_DIR, env: backendEnv }
  );
  const frontend = startProcess('frontend', 'npx', ['vite', '--port', String(FRONTEND_PORT), '--strictPort'], {
    cwd: FRONTEND_DIR,
    env: {
      ...process.env,
      BACKEND_PORT: String(BACKEND_PORT),
      RACEHUBOS_ADDONS_DIR: addonsDir,
      // packages/frontend/.env may point the socket (or the API) at the developer's server on 3001:
      // everything goes through this Vite and its proxy instead (a variable already set wins over .env).
      // The API stays relative, as when unset: the interface adds '' or '/api' to it depending on the file
      VITE_API_URL: '',
      VITE_WS_URL: APP,
    },
  });

  const alive = (entry) => {
    if (entry.exited) throw new Error(`${entry.name} stopped:\n${logTail(entry)}`);
  };
  try {
    await waitUntil('the backend', async () => {
      alive(backend);
      const res = await fetch(`${API}/health`);
      return res.ok && (await res.json()).status === 'ok';
    });
    await waitUntil('Vite', async () => {
      alive(frontend);
      return (await fetch(APP)).ok;
    });
  } catch (error) {
    if (!error.message.includes('stopped')) {
      error.message += `\n--- backend ---\n${logTail(backend)}\n--- frontend ---\n${logTail(frontend)}`;
    }
    throw error;
  }
  log(`Servers up: backend ${API}, interface ${APP}`);
}

// ==================== Browser ====================

// The themes of the site, the first its default: each screen is captured in both, the app switched by its own button
const THEMES = ['light', 'dark'];
const HIDE_SCROLLBARS = '*{scrollbar-width:none!important}*::-webkit-scrollbar{display:none!important}';

async function openContext(lang, storage = {}) {
  const context = await browser.newContext({
    baseURL: APP,
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    locale: LANGS[lang],
    timezoneId: 'Europe/Paris',
    colorScheme: THEMES[0],
  });
  // Nothing may reach another local server (the developer's own on 3001/5173): only this Vite
  const elsewhere = new RegExp(`^(https?|wss?)://(localhost|127\\.0\\.0\\.1|\\[::1\\]):(?!${FRONTEND_PORT}\\b)\\d+`);
  await context.route(elsewhere, (route) => {
    problem(`blocked a request to ${route.request().url()}`);
    return route.abort();
  });
  await context.routeWebSocket(elsewhere, (ws) => {
    problem(`blocked a socket to ${ws.url()}`);
    return ws.close();
  });
  // Voice announcements silenced: macOS speech is not muted by --mute-audio
  await context.addInitScript(() => {
    if (!window.speechSynthesis) return;
    const silent = () => {};
    window.speechSynthesis.speak = silent;
    if (window.SpeechSynthesis) window.SpeechSynthesis.prototype.speak = silent;
  });
  await context.addInitScript(
    ({ values, css }) => {
      for (const [key, value] of Object.entries(values)) localStorage.setItem(key, value);
      document.addEventListener('DOMContentLoaded', () => {
        const style = document.createElement('style');
        style.textContent = css;
        document.head.appendChild(style);
      });
    },
    {
      values: {
        'racehubos-lang': lang,
        'racehubos-theme': THEMES[0],
        'racehubos-sidebar': 'true',
        'racehubos-show-standings': 'true',
        'racehubos-admin': 'false',
        ...storage,
      },
      css: HIDE_SCROLLBARS,
    }
  );
  return context;
}

async function open(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.getByTestId('page-header').waitFor({ timeout: 60000 });
}

/** Waits for the page to be done loading: no spinner, images and fonts in, then a moment for transitions. */
async function settle(page, ms = 1200) {
  await page
    .waitForFunction(() => !document.querySelector('.animate-spin, [data-testid$="-loading"]'), null, {
      timeout: 30000,
    })
    .catch(() => problem(`${page.url()}: still loading after 30 s`));
  await page
    .waitForFunction(() => [...document.images].every((img) => img.complete), null, { timeout: 15000 })
    .catch(() => problem(`${page.url()}: images still loading after 15 s`));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(ms);
}

/** Fails the screen when a text of its language is missing, or when an error shows. */
async function check(page, lang, name, texts) {
  const body = await page.locator('body').innerText();
  for (const text of texts) {
    if (!body.includes(text)) problem(`${lang}/${name}: "${text}" not on the page`);
  }
  if (await page.locator('vite-error-overlay').count()) problem(`${lang}/${name}: Vite error overlay`);
}

function toWebp(png, webp) {
  fs.mkdirSync(path.dirname(webp), { recursive: true });
  let quality = WEBP_QUALITY;
  for (;;) {
    execFileSync(CWEBP, ['-quiet', '-q', String(quality), png, '-o', webp]);
    if (fs.statSync(webp).size <= WEBP_MAX_BYTES || quality <= 60) break;
    quality -= 6;
  }
  fs.rmSync(png);
  return { quality, size: fs.statSync(webp).size };
}

const produced = [];

/** Day or night mode, with the button at the foot of the app's sidebar. */
async function useTheme(page, lang, theme) {
  const dark = theme === 'dark';
  await page.emulateMedia({ colorScheme: theme });
  if ((await page.evaluate(() => document.documentElement.classList.contains('dark'))) === dark) return;
  await page
    .getByRole('button', { name: t(lang, 'layout', dark ? 'theme.nightMode' : 'theme.dayMode'), exact: true })
    .click();
  await page.waitForFunction((wanted) => document.documentElement.classList.contains('dark') === wanted, dark);
}

/** Where each leaderboard row is: framer-motion slides them when places change, out of reach of `animations`. */
const rowPlaces = (page) =>
  page.$$eval('[data-testid="leaderboard-row"]', (rows) =>
    rows
      .map((row) => row.getBoundingClientRect())
      .map((box) => `${Math.round(box.x)},${Math.round(box.y)}`)
      .join(' ')
  );

/** Waits until no leaderboard row has moved for a moment. */
async function stillRows(page) {
  let last = await rowPlaces(page);
  for (let still = 0, waited = 0; still < 800 && waited < 15000; waited += 100) {
    await page.waitForTimeout(100);
    const now = await rowPlaces(page);
    still = now === last ? still + 100 : 0;
    last = now;
  }
}

/** A screenshot taken while the leaderboard stands still: again if a place changed meanwhile. */
async function stillShot(page, png) {
  for (let attempt = 1; ; attempt++) {
    await stillRows(page);
    const before = await rowPlaces(page);
    await page.screenshot({ path: png, animations: 'disabled' });
    if ((await rowPlaces(page)) === before) return;
    if (attempt === 5) return problem(`${png}: the leaderboard kept moving`);
  }
}

/** The screen as it is, in each theme of the site, then back to the first one. */
async function capture(page, lang, name, texts) {
  const down = children.find((entry) => entry.exited);
  if (down) throw new Error(`${down.name} is down: no capture`);
  await check(page, lang, name, texts);
  for (const theme of THEMES) {
    await useTheme(page, lang, theme);
    // The pointer out of the way: no hover state nor tooltip on the screen; then the colours settle
    await page.mouse.move(VIEWPORT.width - 1, VIEWPORT.height - 1);
    await page.waitForTimeout(theme === THEMES[0] ? 0 : 700);
    const png = path.join(tmp, `${lang}-${theme}-${name}.png`);
    await stillShot(page, png);
    const file = path.join(lang, theme === THEMES[0] ? '' : theme, `${name}.webp`);
    const { quality, size } = toWebp(png, path.join(OUT_DIR, file));
    produced.push({ file: path.relative(ROOT, path.join(OUT_DIR, file)), size, quality });
    log(`📸 ${file} ${(size / 1024).toFixed(0)} KB (q${quality})`);
  }
  await useTheme(page, lang, THEMES[0]);
}

// ==================== Screens ====================

/** Each route once, so Vite has compiled everything before the first capture. */
async function warmUp(ids) {
  const context = await openContext('en', {
    'racehubos-free-track': ids.trackId,
    'racehubos-free-type': 'race',
    'racehubos-balancing-track': ids.balancingTrackId,
  });
  const page = await context.newPage();
  for (const url of [
    '/',
    '/stats',
    `/championships/${ids.championshipId}`,
    '/balancing',
    '/race',
    '/addons',
    `/addons/${ADDON.id}`,
  ]) {
    await open(page, url);
    await settle(page, 300);
  }
  await context.close();
  // Slow first compilations are expected here; a blocked request is not
  problems.splice(0, problems.length, ...problems.filter((text) => text.startsWith('blocked')));
  log('Interface warmed up');
}

async function staticScreens(lang, ids) {
  const nav = (key) => t(lang, 'layout', `nav.${key}`);
  const context = await openContext(lang);
  const page = await context.newPage();

  if (wanted('dashboard')) {
    await open(page, '/');
    await settle(page, 1500);
    await capture(page, lang, 'dashboard', [nav('settings')]);
  }
  if (wanted('stats')) {
    await open(page, '/stats');
    await settle(page, 1500);
    await capture(page, lang, 'stats', [nav('settings')]);
  }
  if (wanted('championship') || wanted('championship-results')) {
    await nameSessions(lang, ids.championshipSessions);
    await open(page, `/championships/${ids.championshipId}`);
    await settle(page, 500);
    // Its last race: that race's podium, and the race standings of the championship
    await page
      .getByRole('button', { name: /^R\d+$/ })
      .last()
      .click();
    await settle(page, 1500);
    if (wanted('championship')) await capture(page, lang, 'championship', [nav('settings')]);
    if (wanted('championship-results')) {
      await page.getByRole('button', { name: t(lang, 'championships', 'detail.resultsTab'), exact: true }).click();
      await settle(page, 1500);
      await capture(page, lang, 'championship-results', [nav('settings')]);
    }
  }
  if (wanted('balancing')) {
    await api('PUT', `/api/sessions/${ids.balancingSessionId}`, {
      name: t(lang, 'glossary', 'sessionTypeFull.balancing'),
    });
    // Standings panel closed (its toggle in the toolbar): at this width its figures overlap, and the chart
    // and the car cards under it, full width, say the same
    const balancingContext = await openContext(lang, {
      'racehubos-balancing-track': ids.balancingTrackId,
      'racehubos-show-standings': 'false',
      // The chart's "max lap time" (ms): laps off the track left out, as a user sets it
      'racehubos-balancing-maxlaptime': String(BALANCING_MAX_LAP_MS),
    });
    const balancing = await balancingContext.newPage();
    await open(balancing, '/balancing');
    await settle(balancing, 2000);
    await capture(balancing, lang, 'balancing', [nav('settings')]);
    await balancingContext.close();
  }
  if (wanted('addons') || wanted('addons-installed')) {
    await open(page, '/addons');
    await page.getByTestId(`addon-${ADDON.id}`).waitFor({ timeout: 30000 });
    await settle(page);
    if (wanted('addons-installed')) {
      await capture(page, lang, 'addons-installed', [nav('settings'), t(lang, 'addons', 'tabs.installed')]);
    }
    if (wanted('addons')) {
      await page.getByTestId('addons-tab-market').click();
      await page.getByTestId(`market-${ADDON.id}`).waitFor({ timeout: 30000 });
      await settle(page);
      await capture(page, lang, 'addons', [nav('settings'), t(lang, 'addons', 'tabs.market')]);
    }
  }
  await context.close();
}

async function raceScreens(lang, ids) {
  // A new free race on the track, its line-up set: "New session", then the controllers table
  const { data: session } = await api('POST', '/api/sessions', {
    trackId: ids.trackId,
    type: 'race',
    name: t(lang, 'glossary', 'sessionTypeFull.race'),
    status: 'draft',
    maxDuration: null,
    maxLaps: null,
    gracePeriod: 30000,
  });
  await api('PUT', `/api/sessions/${session.id}/drivers`, { drivers: ids.grid });

  const context = await openContext(lang, { 'racehubos-free-track': ids.trackId, 'racehubos-free-type': 'race' });
  const page = await context.newPage();
  await open(page, '/race');
  await page.getByTestId('session-section').waitFor({ timeout: 30000 });
  await settle(page, 500);

  // Start: lights 1/5, then START on the lights: the countdown, then the race
  await page
    .getByRole('button', { name: t(lang, 'championships', 'sessionSection.start'), exact: true })
    .click({ timeout: 30000 });
  // The big START of the lights, over the page (the session panel has one too, under it)
  await page
    .getByRole('button', { name: t(lang, 'race', 'startLights.start'), exact: true })
    .last()
    .click({ timeout: 30000 });
  // CU status 0: racing
  await waitUntil('the race to start', async () => (await api('GET', '/api/sync/state')).cuStatus?.start === 0, {
    timeout: 20000,
  });
  const go = Date.now();
  log(`${lang}: race started (session ${session.id})`);

  await waitUntil(
    'laps on every car',
    async () => {
      const board = await api('GET', '/api/sync/leaderboard');
      const elapsed = (Date.now() - go) / 1000;
      const enough = Array.isArray(board) && board.length === 6 && board.every((e) => e.totalLaps >= RACE.minLaps);
      return (elapsed >= RACE.seconds && enough) || elapsed >= RACE.maxSeconds;
    },
    { timeout: (RACE.maxSeconds + 10) * 1000 }
  );
  await page.waitForTimeout(600);
  const finish = t(lang, 'championships', 'sessionSection.finish');
  if (wanted('race')) await capture(page, lang, 'race', [finish]);

  // Finish: the session ends, its podium shows
  await page.getByRole('button', { name: finish, exact: true }).click();
  await waitUntil('the session to finish', async () => {
    const { data } = await api('GET', `/api/sessions/${session.id}`);
    return data.status === 'finished';
  });
  await page
    .getByText(t(lang, 'race', 'podium.winner'), { exact: true })
    .first()
    .waitFor({ timeout: 20000 });
  await settle(page, 2500);
  if (wanted('podium')) await capture(page, lang, 'podium', [t(lang, 'layout', 'nav.settings')]);
  await context.close();
}

async function carServiceScreen(lang) {
  const context = await openContext(lang);
  const page = await context.newPage();
  await open(page, `/addons/${ADDON.id}`);
  await settle(page, 1500);
  await capture(page, lang, 'car-service', [t(lang, 'layout', 'nav.settings')]);
  await context.close();
}

// ==================== Main ====================

async function main() {
  if (only) {
    const unknown = only.filter((name) => !SCREENS.includes(name));
    if (unknown.length) throw new Error(`Unknown screens: ${unknown.join(', ')} (known: ${SCREENS.join(', ')})`);
  }
  execFileSync(CWEBP, ['-version'], { stdio: 'ignore' });

  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'racehubos-screens-'));
  const db = path.join(tmp, 'demo.db');
  const addonsDir = path.join(tmp, 'addons');

  copyDatabase(db);
  anonymize(db);
  migrate(db);
  const ids = lookups(db);
  installAddon(addonsDir);
  await startServers(db, addonsDir);

  await api('POST', '/api/bluetooth/connect', { address: 'SIMULATOR' });
  await setUpCarService(ids, db, addonsDir);

  browser = await chromium.launch({
    // No sound out of the Mac (start lights, finish jingle)
    args: ['--mute-audio'],
    // Playwright would exit on these before cleanup() stops the servers
    handleSIGINT: false,
    handleSIGTERM: false,
    handleSIGHUP: false,
  });
  await warmUp(ids);

  const langs = Object.keys(LANGS);
  if (STATIC_SCREENS.some(wanted)) for (const lang of langs) await staticScreens(lang, ids);
  // Always run: the car service page shows the laps of these races
  if (wanted('race') || wanted('podium') || wanted('car-service')) {
    for (const lang of langs) await raceScreens(lang, ids);
  }
  if (wanted('car-service')) for (const lang of langs) await carServiceScreen(lang);
}

let failed = false;
try {
  await main();
} catch (error) {
  failed = true;
  console.error(error);
} finally {
  await cleanup();
}

if (produced.length) {
  console.log('\nScreenshots:');
  for (const { file, size, quality } of produced) {
    console.log(`  ${file.padEnd(36)} ${(size / 1024).toFixed(0).padStart(4)} KB  q${quality}`);
  }
}
if (problems.length) {
  console.log(`\n${problems.length} problem(s):`);
  for (const text of problems) console.log(`  - ${text}`);
}
process.exit(failed || problems.length ? 1 : 0);
