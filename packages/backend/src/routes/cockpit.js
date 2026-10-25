import express from 'express';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID, createHash } from 'node:crypto';
import Database from 'better-sqlite3';
import { cockpitPlan as buildCockpitPlan, cockpitSummary as summary, cockpitSignature } from '../lib/cockpitPlan.js';
import { readCockpitArchive } from '../lib/cockpitHistory.js';
import { getDatabasePath } from '../lib/database-url.js';
import { createBackup } from '../lib/dataBackup.js';
import { insertCockpitData } from '../lib/cockpitData.js';

export function createCockpitRouter({
  databasePath = getDatabasePath(),
  uploadsPath = fileURLToPath(new URL('../../public/uploads/', import.meta.url)),
  backupDirectory = path.join(path.dirname(databasePath), 'cockpit-import-backups'),
  sessionService,
  io,
} = {}) {
  const dataDirectory = backupDirectory;
  const uploads = uploadsPath;
  const service = sessionService,
    socket = io;
  const converter = fileURLToPath(new URL('../../scripts/cockpit_import.py', import.meta.url));
  const router = express.Router(),
    previews = new Map();
  router.get('/cockpit/history', (req, res) => {
    const db = new Database(databasePath, { readonly: true });
    try {
      res.set('Cache-Control', 'no-store');
      res.json({ success: true, data: readCockpitArchive(db) });
    } catch (e) {
      fail(res, e);
    } finally {
      db.close();
    }
  });
  router.use((req, res, next) => {
    const address = req.socket.remoteAddress,
      origin = req.get('origin');
    if (
      !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address) ||
      (origin && origin !== `${req.protocol}://${req.get('host')}`)
    )
      return res.status(403).json({ success: false, error: 'Datensicherung nur lokal auf diesem Rechner öffnen.' });
    res.set('Cache-Control', 'no-store');
    next();
  });
  const backupName = /^racehubos-[a-z0-9-]+\.json$/;
  const digest = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
  function checkIdle() {
    if (service?.isActive()) throw new Error('Bitte die laufende oder pausierte Sitzung zuerst beenden.');
  }
  function saveLocalBackup(prefix = 'sicherung') {
    checkIdle();
    const backup = createBackup(databasePath, uploads);
    fs.mkdirSync(dataDirectory, { recursive: true, mode: 0o700 });
    const id = `racehubos-${prefix}-${Date.now()}-${randomUUID().slice(0, 8)}.json`;
    fs.writeFileSync(path.join(dataDirectory, id), JSON.stringify(backup), { mode: 0o600 });
    return { id, backup };
  }
  function remember(value) {
    for (const [id, entry] of previews) if (entry.expires < Date.now()) previews.delete(id);
    while (previews.size >= 3) previews.delete(previews.keys().next().value);
    const id = randomUUID();
    previews.set(id, { ...value, expires: Date.now() + 30 * 60000 });
    return id;
  }
  function entry(id, kind) {
    const value = previews.get(id);
    if (!value || value.kind !== kind || value.expires < Date.now())
      throw new Error('Vorschau abgelaufen. Bitte erneut prüfen.');
    return value;
  }
  function fail(res, error) {
    return res.status(400).json({ success: false, error: error.message || 'Vorgang fehlgeschlagen.' });
  }
  router.get('/download/:id', (req, res) => {
    if (!backupName.test(req.params.id)) return res.status(400).end();
    res.download(path.join(dataDirectory, req.params.id), req.params.id, (e) => {
      if (e && !res.headersSent) res.status(404).json({ success: false, error: 'Sicherung nicht gefunden.' });
    });
  });
  const cockpitPlan = (data, options) => buildCockpitPlan(databasePath, uploads, data, options);
  // Private directory: uploaded backups can contain personal information.
  const uploadDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'racehub-cockpit-'));
  const upload = multer({ dest: uploadDirectory, limits: { fileSize: 180 * 1024 * 1024, files: 1 } });
  router.post('/cockpit/preview', upload.single('file'), async (req, res) => {
    try {
      checkIdle();
      if (!req.file) throw new Error('Bitte eine Cockpit-XP-ZIP-Sicherung auswählen.');
      const { stdout } = await promisify(execFile)('python3', [converter, req.file.path], {
        timeout: 60000,
        maxBuffer: 45 * 1024 * 1024,
      });
      const data = JSON.parse(stdout);
      data.source = req.file.originalname;
      const options = JSON.parse(req.body.options || '{}'),
        plan = cockpitPlan(data, options);
      res.json({
        success: true,
        id: remember({ kind: 'cockpit', data, options, before: digest(cockpitSignature(plan)) }),
        summary: summary(plan),
      });
    } catch (e) {
      fail(res, new Error(e.stderr?.trim() || e.message));
    } finally {
      if (req.file?.path) fs.rmSync(req.file.path, { force: true });
    }
  });
  router.post('/cockpit/import', (req, res) => {
    try {
      checkIdle();
      if (req.body.confirmed !== true) throw new Error('Datenübernahme bitte bestätigen.');
      const value = entry(req.body.id, 'cockpit'),
        plan = cockpitPlan(value.data, value.options);
      if (!Object.values(summary(plan).counts).some((n) => n > 0))
        throw new Error(
          'Keine neuen zuordenbaren Daten vorhanden. Bereits importierte Daten werden nicht doppelt übernommen.'
        );
      if (digest(cockpitSignature(plan)) !== value.before)
        throw new Error('Daten wurden seit der Vorschau geändert. Bitte erneut prüfen.');
      const previous = saveLocalBackup('vor-cockpit-import');
      insertCockpitData(databasePath, uploads, plan);
      previews.delete(req.body.id);
      socket?.emit('data:restored');
      res.json({ success: true, previous: previous.id, summary: summary(plan) });
    } catch (e) {
      fail(res, e);
    }
  });
  router.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    fail(res, new Error(error.code === 'LIMIT_FILE_SIZE' ? 'Datei zu groß. Maximal 180 MB.' : error.message));
  });
  return router;
}
