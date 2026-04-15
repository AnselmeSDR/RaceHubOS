import express from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '../../../..');

const router = express.Router();
const execAsync = promisify(exec);

let isUpdating = false;
let io = null;

export function setUpdateIo(socketIo) {
  io = socketIo;
}

function getLocalVersion() {
  const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf-8'));
  return pkg.version;
}

function emitProgress(step, message, status = 'running') {
  io?.emit('update:progress', { step, message, status });
}

/**
 * GET /api/update/check
 * Compare local version with GitHub
 */
router.get('/check', async (req, res) => {
  try {
    const currentVersion = getLocalVersion();

    const response = await fetch(
      'https://api.github.com/repos/AnselmeSDR/RaceHubOS/contents/package.json',
      { headers: { 'Accept': 'application/vnd.github.raw', 'User-Agent': 'RaceHubOS' } }
    );
    if (!response.ok) {
      return res.json({ success: true, data: { currentVersion, latestVersion: null, updateAvailable: false, error: 'Impossible de contacter GitHub' } });
    }

    const remotePkg = await response.json();
    const latestVersion = remotePkg.version;
    const updateAvailable = latestVersion !== currentVersion;

    res.json({
      success: true,
      data: { currentVersion, latestVersion, updateAvailable }
    });
  } catch (error) {
    res.json({
      success: true,
      data: { currentVersion: getLocalVersion(), latestVersion: null, updateAvailable: false, error: error.message }
    });
  }
});

/**
 * POST /api/update/apply
 * Pull latest, install, build, migrate, restart
 */
router.post('/apply', async (req, res) => {
  if (isUpdating) {
    return res.status(409).json({ success: false, error: 'Mise à jour déjà en cours' });
  }

  isUpdating = true;
  res.json({ success: true, message: 'Mise à jour lancée' });

  try {
    // Backup database
    const dbPath = path.join(rootDir, 'packages/backend/prisma/dev.db');
    if (fs.existsSync(dbPath)) {
      emitProgress(1, 'Sauvegarde de la base de données...');
      fs.copyFileSync(dbPath, dbPath + '.backup');
    }

    // Git pull (clean merge, preserve untracked files like db/uploads)
    emitProgress(2, 'Téléchargement de la mise à jour...');
    await execAsync('git fetch origin main', { cwd: rootDir, timeout: 60000 });
    // Stash any local tracked changes, then reset to remote
    await execAsync('git checkout -- .', { cwd: rootDir, timeout: 10000 }).catch(() => {});
    await execAsync('git pull origin main --ff-only', { cwd: rootDir, timeout: 60000 });

    // npm install (postinstall prisma removed — handled by startup.js on restart)
    emitProgress(3, 'Installation des dépendances...');
    await execAsync('npm install --legacy-peer-deps', { cwd: rootDir, timeout: 300000 });

    // Prisma (may fail on Windows due to locked DLL — will retry on restart)
    emitProgress(4, 'Migration de la base de données...');
    await execAsync('npx prisma generate', { cwd: path.join(rootDir, 'packages/backend'), timeout: 60000 }).catch(() => {});
    await execAsync('npx prisma db push --accept-data-loss', { cwd: path.join(rootDir, 'packages/backend'), timeout: 60000 }).catch(() => {});

    // Build frontend
    emitProgress(5, 'Build du frontend...');
    await execAsync('npm run build', { cwd: rootDir, timeout: 120000 });

    const newVersion = getLocalVersion();

    // Regenerate launcher .bat from template (Windows only)
    const templatePath = path.join(rootDir, 'RaceHubOS.bat.template');
    if (fs.existsSync(templatePath)) {
      emitProgress(6, 'Mise à jour du lanceur...');
      const batContent = fs.readFileSync(templatePath, 'utf-8')
        .replace(/__VERSION__/g, `v${newVersion}`)
        .replace(/__TARGET_DIR__/g, rootDir.replace(/\//g, '\\'));
      const batFiles = fs.readdirSync(rootDir).filter(f => /^RaceHubOS-v.*\.bat$/.test(f));
      for (const batFile of batFiles) {
        fs.writeFileSync(path.join(rootDir, batFile), batContent);
      }
    }

    emitProgress(7, `Mise à jour v${newVersion} terminée. Redémarrage...`, 'complete');

    isUpdating = false;

    // Exit with code 42 so launcher restarts
    setTimeout(() => process.exit(42), 2000);
  } catch (error) {
    console.error('Update error:', error);
    isUpdating = false;
    emitProgress(0, `Erreur: ${error.message}`, 'error');
  }
});

export default router;
