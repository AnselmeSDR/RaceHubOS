import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { applyUpdate, checkForUpdate, fetchMain } from '../lib/update.js';

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

/** Self-update from GitHub's main: check, then apply and restart (exit code 42). */
const router = express.Router();

let isUpdating = false;
let io = null;

export function setUpdateIo(socketIo) {
  io = socketIo;
}

function emitProgress(step, message, status = 'running') {
  io?.emit('update:progress', { step, message, status });
}

router.get('/check', async (req, res) => {
  res.json({ success: true, data: await checkForUpdate(rootDir) });
});

// Answers once main is fetched; the progress follows on `update:progress`
router.post('/apply', async (req, res) => {
  if (isUpdating) return res.status(409).json({ success: false, error: 'Mise à jour déjà en cours' });

  isUpdating = true;
  let diverged;
  try {
    ({ diverged } = await fetchMain(rootDir));
  } catch (error) {
    isUpdating = false;
    console.error('Update error:', error);
    return res.status(500).json({ success: false, error: `Erreur: ${error.message}` });
  }
  // A checkout that cannot fast-forward (main rewritten upstream) is replaced only once the user agreed
  if (diverged && req.body?.replaceLocal !== true) {
    isUpdating = false;
    return res.status(409).json({ success: false, diverged: true });
  }

  res.json({ success: true, message: 'Mise à jour lancée' });
  try {
    const version = await applyUpdate({ rootDir, replaceLocal: diverged, emit: emitProgress });
    emitProgress(7, `Mise à jour v${version} terminée. Redémarrage...`, 'complete');
    // The launcher restarts the app on code 42
    setTimeout(() => process.exit(42), 2000);
  } catch (error) {
    console.error('Update error:', error);
    emitProgress(0, `Erreur: ${error.message}`, 'error');
  } finally {
    isUpdating = false;
  }
});

export default router;
