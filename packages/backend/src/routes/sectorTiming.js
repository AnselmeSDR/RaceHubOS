import express from 'express';
import { RUNNING_SESSION_STATUSES } from '@racehubos/shared';
import { createPrismaClient } from '../lib/prisma.js';

/** Explicit option; all lap processing follows main until enabled. */
export async function createSectorTimingRouter({ syncService, sessionService, prisma = createPrismaClient() }) {
  const router = express.Router();
  const key = 'sectorTiming:enabled';
  const previous = await prisma.preference.findUnique({ where: { key } });
  let enabled = previous && JSON.parse(previous.value) === true;
  enabled = !!enabled;
  const apply = (value) => {
    syncService.setSectorTimingEnabled(value);
    sessionService.setSectorTimingEnabled(value);
  };
  apply(enabled);
  router.get('/', (req, res) => res.json({ success: true, data: { enabled } }));
  router.put('/', async (req, res, next) => {
    try {
      if (typeof req.body.enabled !== 'boolean')
        return res.status(400).json({ success: false, error: 'Invalid sector timing flag' });
      if (
        sessionService.isActive() ||
        (await prisma.session.count({ where: { status: { in: RUNNING_SESSION_STATUSES } } }))
      )
        return res.status(409).json({ success: false, error: 'Finish active sessions before changing sector timing' });
      const value = req.body.enabled;
      await prisma.preference.upsert({
        where: { key },
        create: { key, value: JSON.stringify(value) },
        update: { value: JSON.stringify(value) },
      });
      enabled = value;
      apply(value);
      res.json({ success: true, data: { enabled } });
    } catch (error) {
      next(error);
    }
  });
  return router;
}
