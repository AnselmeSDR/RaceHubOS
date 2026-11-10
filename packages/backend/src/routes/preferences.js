import express from 'express';
import { createPrismaClient } from '../lib/prisma.js';
import { route } from '../lib/http.js';

/** Interface preferences, any JSON value by key. */
const router = express.Router();
const prisma = createPrismaClient();

router.get(
  '/:key',
  route(null, async (req, res) => {
    const preference = await prisma.preference.findUnique({ where: { key: req.params.key } });
    res.json({ success: true, data: preference ? JSON.parse(preference.value) : null });
  })
);

router.put(
  '/:key',
  route(null, async (req, res) => {
    const { key } = req.params;
    const value = JSON.stringify(req.body.value);
    const preference = await prisma.preference.upsert({ where: { key }, update: { value }, create: { key, value } });
    res.json({ success: true, data: JSON.parse(preference.value) });
  })
);

export default router;
