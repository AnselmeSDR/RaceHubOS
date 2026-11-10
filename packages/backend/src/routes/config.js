import express from 'express';
import { HttpError, route } from '../lib/http.js';

/** Driver and car of each controller, by track — not used by the interface (docs/TASKS.md). */
const router = express.Router();
let configService;

export function setConfigService(service) {
  configService = service;
}

function trackIdOf(source) {
  if (!source.trackId) throw new HttpError(400, 'trackId is required');
  return source.trackId;
}
const answer = (handler) => route(null, async (req, res) => res.json({ success: true, data: await handler(req) }));

router.get(
  '/',
  answer((req) => configService.getAllConfigs(trackIdOf(req.query)))
);

// /bulk and /validate before /:controller
router.put(
  '/bulk',
  answer((req) => {
    const trackId = trackIdOf(req.body);
    if (!Array.isArray(req.body.controllers)) throw new HttpError(400, 'controllers array is required');
    return configService.updateBulk(trackId, req.body.controllers);
  })
);

router.get(
  '/validate',
  answer((req) => configService.validateConfiguration(trackIdOf(req.query)))
);

router.get(
  '/:controller',
  answer((req) => configService.getConfig(req.params.controller, trackIdOf(req.query)))
);

router.put(
  '/:controller',
  answer((req) => {
    const { driverId, carId } = req.body;
    return configService.updateConfig(req.params.controller, trackIdOf(req.body), driverId, carId);
  })
);

router.delete(
  '/',
  route(null, async (req, res) => {
    await configService.clearAll(trackIdOf(req.query));
    res.json({ success: true, message: 'All configurations cleared' });
  })
);

export default router;
