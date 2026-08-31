#!/usr/bin/env node
/**
 * Checks the rules in docs/CONVENTIONS.md that a machine can check.
 *
 * Every rule here exists because breaking it already cost this project
 * something: a race PC that would not start, laps missing from the statistics,
 * a database silently rewritten. The guide explains the why; this file is what
 * makes the rules binding.
 *
 * Usage: npm run check            all rules
 *        npm run check -- --push  adds the rules that only apply before pushing
 */
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const beforePush = process.argv.includes('--push');
// Le CLI Prisma est appele en JavaScript : npx est un .cmd sous Windows, que
// execFileSync ne resout pas et que node refuse de lancer sans shell
const prismaCli = () => path.join(rootDir, 'node_modules', 'prisma', 'build', 'index.js');

const read = (rel) => fs.readFileSync(path.join(rootDir, rel), 'utf-8');
const exists = (rel) => fs.existsSync(path.join(rootDir, rel));

function git(args) {
  try {
    return execFileSync('git', args, { cwd: rootDir, encoding: 'utf-8', stdio: 'pipe' }).trim();
  } catch {
    return null;
  }
}

/** Source files, excluding what is generated or vendored. */
function sourceFiles(dirs, extensions = ['.js', '.jsx']) {
  const out = [];
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (['node_modules', 'dist', '.git', 'generated'].includes(entry.name)) continue;
        walk(full);
      } else if (extensions.includes(path.extname(entry.name))) {
        out.push(full);
      }
    }
  };
  dirs.forEach((d) => walk(path.join(rootDir, d)));
  return out;
}

const rel = (file) => path.relative(rootDir, file);

// ---------------------------------------------------------------------------

const rules = [];
const rule = (id, title, check, { onlyBeforePush = false } = {}) =>
  rules.push({ id, title, check, onlyBeforePush });

rule('migrations-only', 'Le schéma ne change que par une migration', () => {
  const offenders = [];
  const files = [
    ...sourceFiles(['packages/backend/src', 'packages/backend/scripts', 'scripts']),
    ...['RaceHubOS-install-win.bat', 'RaceHubOS-install-mac.command', 'README.md']
      .filter(exists).map((f) => path.join(rootDir, f)),
  ];
  for (const file of files) {
    for (const [i, line] of read(rel(file)).split('\n').entries()) {
      if (/prisma\s+db\s+push/.test(line) && !line.trim().startsWith('//')) {
        offenders.push(`${rel(file)}:${i + 1} — ${line.trim()}`);
      }
    }
  }
  return offenders;
});

rule('schema-matches-migrations', 'schema.prisma est couvert par les migrations', () => {
  if (!exists('packages/backend/prisma/schema.prisma')) return [];
  try {
    const diff = execFileSync(process.execPath, [prismaCli(), 'migrate', 'diff',
      '--from-migrations', 'prisma/migrations', '--to-schema', 'prisma/schema.prisma', '--script'],
      { cwd: path.join(rootDir, 'packages/backend'), encoding: 'utf-8', stdio: 'pipe' });
    return /empty migration/i.test(diff)
      ? []
      : ['schema.prisma décrit un schéma qu\'aucune migration ne produit — créer la migration avec "npm run prisma:migrate -w @racehubos/backend"'];
  } catch (err) {
    return [`impossible de comparer le schéma aux migrations (${err.message.split('\n')[0]})`];
  }
});

rule('session-types-from-shared', 'Les types de session viennent de @racehubos/shared', () => {
  const V = 'practice|qualif|race|balancing';
  // Cible les contextes ou la valeur designe a coup sur un type de session.
  // "race" sert aussi de mode de tri et d'identifiant d'onglet : ces emplois-la
  // ne sont pas des types de session et ne relevent pas de cette regle.
  const contexts = [
    new RegExp(`(?:\\w+\\.)?(?:sessionType|currentPhase|type|phase)\\s*(?:===|!==|==|!=|=|:)\\s*'(?:${V})'`),
    new RegExp(`\\btype=\"(?:${V})\"`),
  ];
  const offenders = [];
  const skip = (file) => /packages\/shared|i18n\/locales|__tests__|check-rules\.js/.test(rel(file));

  for (const file of sourceFiles(['packages/backend/src', 'packages/frontend/src'])) {
    if (skip(file)) continue;
    for (const [i, line] of read(rel(file)).split('\n').entries()) {
      const code = line.trim();
      if (code.startsWith('*') || code.startsWith('//') || /code=/.test(code)) continue;
      if (contexts.some((re) => re.test(line))) offenders.push(`${rel(file)}:${i + 1} — ${code.slice(0, 90)}`);
    }
  }
  return offenders;
});

rule('shared-symbols-imported', 'Tout symbole partagé utilisé est importé', () => {
  // Un build Vite réussi ne détecte pas ce cas : ce n'est pas une erreur de
  // compilation en JS, seulement une ReferenceError a l'execution
  const symbols = ['SessionType', 'SESSION_TYPES', 'STANDARD_SESSION_TYPES',
    'isSessionType', 'sessionTypeKey', 'sessionTypeFullKey'];
  const offenders = [];

  for (const file of sourceFiles(['packages/backend/src', 'packages/frontend/src'])) {
    if (/packages\/shared|i18n\/locales/.test(rel(file))) continue;
    const text = read(rel(file));
    const imported = new Set();
    for (const m of text.matchAll(/import\s*\{([^}]*)\}\s*from\s*'@racehubos\/shared'/g)) {
      m[1].split(',').forEach((s) => imported.add(s.trim()));
    }
    const body = text.split('\n')
      .filter((l) => !l.includes('@racehubos/shared') && !l.trim().startsWith('*') && !l.trim().startsWith('//'))
      .join('\n');
    for (const symbol of symbols) {
      if (new RegExp(`\\b${symbol}\\b`).test(body) && !imported.has(symbol)) {
        offenders.push(`${rel(file)} — ${symbol} utilisé sans import`);
      }
    }
  }
  return offenders;
});

rule('installer-batch-syntax', 'L\'installeur Windows a des blocs valides', () => {
  if (!exists('RaceHubOS-install-win.bat')) return [];
  const offenders = [];
  let depth = 0;

  for (const [i, raw] of read('RaceHubOS-install-win.bat').split('\n').entries()) {
    const line = raw.trim();
    // cmd.exe refuse un label :: a l'interieur d'un bloc parenthese
    if (depth > 0 && line.startsWith('::')) {
      offenders.push(`RaceHubOS-install-win.bat:${i + 1} — ":: " dans un bloc, utiliser REM`);
    }
    if (line.startsWith('::') || line.toLowerCase().startsWith('rem ')) continue;
    const code = line.replace(/"[^"]*"/g, '');
    depth += (code.match(/\(/g) ?? []).length - (code.match(/\)/g) ?? []).length;
  }
  if (depth !== 0) offenders.push(`RaceHubOS-install-win.bat — parenthèses non équilibrées (${depth})`);
  return offenders;
});

rule('installers-declare-version', 'Les installeurs déclarent INSTALLER_VERSION', () => {
  const offenders = [];
  for (const [name, prefix] of [['RaceHubOS-install-win.bat', '::'], ['RaceHubOS-install-mac.command', '#']]) {
    if (!exists(name)) continue;
    const line = read(name).split('\n').find((l) => l.startsWith(`${prefix} INSTALLER_VERSION`));
    if (!/^\d+$/.test(line?.split(/\s+/)[2] ?? '')) {
      offenders.push(`${name} — INSTALLER_VERSION absent ou non numérique`);
    }
  }
  return offenders;
});

rule('installer-version-bumped', 'Un installeur modifié voit son INSTALLER_VERSION incrémenté', () => {
  const base = git(['rev-parse', '--verify', 'origin/main']);
  if (!base) return [];
  const offenders = [];

  for (const [name, prefix] of [['RaceHubOS-install-win.bat', '::'], ['RaceHubOS-install-mac.command', '#']]) {
    if (!exists(name)) continue;
    const changed = git(['diff', '--name-only', `${base}..HEAD`, '--', name]);
    if (!changed) continue;

    const versionOf = (text) => Number(
      text?.split('\n').find((l) => l.startsWith(`${prefix} INSTALLER_VERSION`))?.split(/\s+/)[2] ?? NaN);
    const before = versionOf(git(['show', `${base}:${name}`]));
    const after = versionOf(read(name));
    // Sans cela un poste garde son installeur perime pour toujours
    if (Number.isFinite(before) && !(after > before)) {
      offenders.push(`${name} — modifié mais INSTALLER_VERSION reste à ${after}`);
    }
  }
  return offenders;
}, { onlyBeforePush: true });

rule('version-and-changelog', 'Version incrémentée et changelog à jour', () => {
  const base = git(['rev-parse', '--verify', 'origin/main']);
  if (!base) return [];
  const changed = git(['diff', '--name-only', `${base}..HEAD`]);
  if (!changed) return [];

  const touchesCode = changed.split('\n').some((f) =>
    f.startsWith('packages/') || f.startsWith('scripts/') || f.endsWith('.bat') || f.endsWith('.command'));
  if (!touchesCode) return [];

  const offenders = [];
  const version = JSON.parse(read('package.json')).version;
  const previous = JSON.parse(git(['show', `${base}:package.json`]) ?? '{}').version;
  if (version === previous) offenders.push(`la version est restée à ${version}`);
  if (!read('CHANGELOG.md').includes(`## [${version}]`)) {
    offenders.push(`CHANGELOG.md n'a pas d'entrée pour la version ${version}`);
  }
  return offenders;
}, { onlyBeforePush: true });

rule('no-npx-through-execfile', 'Prisma n\'est pas lancé par npx via execFile', () => {
  // Sous Windows npx est un .cmd : execFileSync ne resout pas l'extension
  // (ENOENT) et, depuis les correctifs BatBadBut, node refuse de lancer un .cmd
  // sans shell (EINVAL). Les deux echecs sont invisibles sur macOS et Linux, et
  // les deux se sont produits sur le PC de course, en pleine migration.
  // La parade : appeler le CLI en JavaScript avec process.execPath.
  const offenders = [];
  const bad = /(?:execFileSync|execFile|spawnSync|spawn)\(\s*(?:'(npx|npm)'|NPX)/;

  for (const file of sourceFiles(['packages/backend/src', 'packages/backend/scripts', 'packages/frontend/src', 'scripts'], ['.js', '.jsx', '.mjs'])) {
    if (/check-rules\.mjs$/.test(rel(file))) continue;
    for (const [i, line] of read(rel(file)).split('\n').entries()) {
      if (bad.test(line)) {
        offenders.push(`${rel(file)}:${i + 1} — passer par prismaCli() et process.execPath`);
      }
    }
  }
  return offenders;
});

rule('translations-cover-both-languages', 'Chaque clé existe en français et en anglais', () => {
  const localesDir = path.join(rootDir, 'packages/frontend/src/i18n/locales');
  if (!fs.existsSync(localesDir)) return [];

  const flatten = (value, prefix = '') => {
    if (value === null || typeof value !== 'object') return [prefix];
    return Object.entries(value).flatMap(([k, v]) => flatten(v, prefix ? `${prefix}.${k}` : k));
  };

  const offenders = [];
  for (const name of fs.readdirSync(path.join(localesDir, 'fr'))) {
    const en = path.join(localesDir, 'en', name);
    if (!fs.existsSync(en)) {
      offenders.push(`${name} — absent en anglais`);
      continue;
    }
    const keysFr = new Set(flatten(JSON.parse(fs.readFileSync(path.join(localesDir, 'fr', name), 'utf-8'))));
    const keysEn = new Set(flatten(JSON.parse(fs.readFileSync(en, 'utf-8'))));
    for (const key of keysFr) if (!keysEn.has(key)) offenders.push(`${name} — ${key} manque en anglais`);
    for (const key of keysEn) if (!keysFr.has(key)) offenders.push(`${name} — ${key} manque en français`);
  }
  return offenders;
});

rule('tests-use-a-test-database', 'Les tests tournent sur une base de test', () => {
  const pkg = JSON.parse(read('packages/backend/package.json'));
  const offenders = [];
  for (const [name, script] of Object.entries(pkg.scripts ?? {})) {
    if (!name.startsWith('test')) continue;
    // setup.js vide toutes les tables : dev.db contient les vraies courses
    if (!/DATABASE_URL="file:\.\/test\.db"/.test(script)) {
      offenders.push(`packages/backend > ${name} — ne fixe pas DATABASE_URL sur test.db`);
    }
  }
  return offenders;
});

// ---------------------------------------------------------------------------

let failed = 0;
const skipped = [];

console.log('\n  Vérification des règles (docs/CONVENTIONS.md)\n');

for (const { id, title, check, onlyBeforePush } of rules) {
  if (onlyBeforePush && !beforePush) {
    skipped.push(id);
    continue;
  }
  let offenders;
  try {
    offenders = check();
  } catch (err) {
    offenders = [`la vérification a échoué : ${err.message.split('\n')[0]}`];
  }

  if (offenders.length === 0) {
    console.log(`  \x1b[32m✓\x1b[0m ${title}`);
  } else {
    failed += 1;
    console.log(`  \x1b[31m✗\x1b[0m ${title}  \x1b[2m(${id})\x1b[0m`);
    for (const line of offenders.slice(0, 12)) console.log(`      ${line}`);
    if (offenders.length > 12) console.log(`      … et ${offenders.length - 12} autre(s)`);
  }
}

if (skipped.length) {
  console.log(`\n  \x1b[2m${skipped.length} règle(s) réservée(s) au push : ${skipped.join(', ')} — "npm run check:push"\x1b[0m`);
}

if (failed > 0) {
  console.log(`\n  \x1b[31m${failed} règle(s) non respectée(s).\x1b[0m Chacune est expliquée dans docs/CONVENTIONS.md.\n`);
  process.exit(1);
}
console.log('\n  Toutes les règles sont respectées.\n');
