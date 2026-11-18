import express from 'express';
import { inspectFirmware } from './CuFirmwareService.js';


export function createCuFirmwareRouter(service, { checkInstallation = async () => ({ compatible: true }) } = {}) {
  const router = express.Router();
  // A browser from another origin must never start a hardware update. Requests
  // from the local add-on use this same origin; no permissive CORS mutation.
  router.use(async (req, res, next) => {
    try {
      await service.ready;
      if (!(await checkInstallation(undefined, 'cu-firmware')).compatible)
        return res.status(409).json({ success: false, error: 'Kompatibles CU-Firmware-Add-on installieren' });
      if (req.method !== 'GET') {
        const origin = req.get('origin');
        const expected = `${req.protocol}://${req.get('host')}`;
        if (!origin || origin !== expected || !req.is('application/json'))
          return res
            .status(403)
            .json({ success: false, error: 'Firmware-Aktionen nur aus der lokalen RaceHubOS-Oberfläche' });
      }
      res.set('Cache-Control', 'no-store');
      next();
    } catch (error) {
      next(error);
    }
  });
  router.get('/status', (req, res) => res.json({ success: true, data: service.snapshot() }));
  router.post('/inspect', (req, res) => {
    try {
      res.json({ success: true, data: inspectFirmware(req.body.text).info });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });
  router.post('/start', async (req, res) => {
    try {
      res.status(202).json({ success: true, data: await service.start(req.body) });
    } catch (error) {
      res.status(409).json({ success: false, error: error.message });
    }
  });
  return router;
}
