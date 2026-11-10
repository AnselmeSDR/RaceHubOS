import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { refreshDesktopInstaller } from './desktopInstaller.js';
import { backupDatabase } from './backupDatabase.js';
import { isNewerVersion } from './version.js';
import { buildApp } from '../addons/build.js';

const execAsync = promisify(exec);
const REMOTE_PACKAGE = 'https://api.github.com/repos/AnselmeSDR/RaceHubOS/contents/package.json';

export const localVersion = (rootDir) =>
  JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf-8')).version;

/** The version on GitHub's main, and whether it is newer than this one. Never throws. */
export async function checkForUpdate(rootDir, { fetch = globalThis.fetch } = {}) {
  const currentVersion = localVersion(rootDir);
  const unknown = (error) => ({ currentVersion, latestVersion: null, updateAvailable: false, error });
  try {
    const response = await fetch(REMOTE_PACKAGE, {
      headers: { Accept: 'application/vnd.github.raw', 'User-Agent': 'RaceHubOS' },
    });
    if (!response.ok) return unknown('Impossible de contacter GitHub');
    const latestVersion = (await response.json()).version;
    // Strict comparison: an older remote version must never look like an update
    return { currentVersion, latestVersion, updateAvailable: isNewerVersion(latestVersion, currentVersion) };
  } catch (error) {
    return unknown(error.message);
  }
}

/**
 * Undo a failed update: back to the previous commit, with dependencies and
 * build restored. Runs before any schema migration, so the database is untouched.
 */
export async function rollback(previousCommit, reason, { cwd, run = execAsync, emit = () => {} }) {
  console.error(`⚠️  Mise à jour échouée (${reason}) — retour à ${previousCommit.slice(0, 8)}`);
  emit(0, 'Échec de la mise à jour, restauration de la version précédente...');
  try {
    await run(`git reset --hard ${previousCommit}`, { cwd, timeout: 60000 });
    await run('npm install --legacy-peer-deps', { cwd, timeout: 300000 });
    await run('npm run build', { cwd, timeout: 120000 });
    console.log('✅ Version précédente restaurée');
  } catch (err) {
    // Nothing else we can do automatically — make it loud rather than silent
    console.error('❌ Restauration impossible:', err.message);
    emit(0, `Restauration impossible: ${err.message}. Relancez l'installeur.`, 'error');
    throw err;
  }
}

/** Rewrites the Windows launchers `RaceHubOS-v*.bat` from the template, for the new version. */
function refreshLaunchers(rootDir, version, emit) {
  const templatePath = path.join(rootDir, 'RaceHubOS.bat.template');
  if (!fs.existsSync(templatePath)) return;
  emit(6, 'Mise à jour du lanceur...');
  const content = fs
    .readFileSync(templatePath, 'utf-8')
    .replace(/__VERSION__/g, `v${version}`)
    .replace(/__TARGET_DIR__/g, rootDir.replace(/\//g, '\\'));
  for (const file of fs.readdirSync(rootDir).filter((f) => /^RaceHubOS-v.*\.bat$/.test(f))) {
    fs.writeFileSync(path.join(rootDir, file), content);
  }
}

/**
 * Pulls main, installs, builds, migrates; returns the new version. A failure before the
 * migration rolls the code back. `emit(step, message, status)` reports the progress.
 */
export async function applyUpdate({
  rootDir,
  emit = () => {},
  run = execAsync,
  backup = backupDatabase,
  build = buildApp,
  refreshInstaller = refreshDesktopInstaller,
}) {
  const backendDir = path.join(rootDir, 'packages/backend');
  const git = (args, timeout) => run(`git ${args}`, { cwd: rootDir, timeout });

  // Dated snapshot in prisma/db-old/, the last 10 kept
  emit(1, 'Sauvegarde de la base de données...');
  const backupPath = backup({ reason: 'update' });
  if (backupPath) console.log(`💾 Sauvegarde avant mise à jour: ${backupPath}`);

  // Where we stand, so a failed update can be undone
  const previousCommit = (await git('rev-parse HEAD', 10000)).stdout.trim();

  // Local edits of tracked files are dropped; untracked ones (database, uploads) stay
  emit(2, 'Téléchargement de la mise à jour...');
  await git('fetch origin main', 60000);
  await git('checkout -- .', 10000).catch(() => {});
  await git('pull origin main --ff-only', 60000);

  // From here the working tree is on the new version: any failure must roll back,
  // otherwise the next restart runs on a half-installed app.
  try {
    // Prisma generate is left to startup.js on restart
    emit(3, 'Installation des dépendances...');
    await run('npm install --legacy-peer-deps', { cwd: rootDir, timeout: 300000 });

    // A build failing on an add-on file disables that add-on instead of rolling the core
    // back — docs/ADDONS.md § When something breaks
    emit(4, 'Build du frontend...');
    const { disabled } = await build(rootDir);
    if (disabled.length > 0) console.warn(`[update] Add-ons désactivés, leur build échouait : ${disabled.join(', ')}`);
  } catch (error) {
    await rollback(previousCommit, error.message, { cwd: rootDir, run, emit });
    throw new Error(`Mise à jour annulée, version précédente restaurée (${error.message})`, { cause: error });
  }

  // The schema migration comes last, once the code is installed and built: it is the only
  // irreversible step, and startup.js retries it on restart. scripts/migrate.js baselines a
  // database predating migrations, which plain `migrate deploy` refuses (P3005).
  emit(5, 'Migration de la base de données...');
  await run('npx prisma generate', { cwd: backendDir, timeout: 60000 }).catch(() => {});
  await run('node scripts/migrate.js', { cwd: backendDir, timeout: 120000 }).catch(() => {});

  const version = localVersion(rootDir);
  refreshLaunchers(rootDir, version, emit);

  // Bootstraps the installer's self-update on desktops still holding a copy that predates it
  try {
    const { copied, target } = refreshInstaller({ rootDir });
    if (copied) console.log(`[update] Installeur du bureau mis à jour: ${target}`);
  } catch (err) {
    console.warn('[update] Installeur du bureau non mis à jour:', err.message);
  }
  return version;
}
