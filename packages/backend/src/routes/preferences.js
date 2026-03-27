import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/preferences/:key
router.get('/:key', async (req, res) => {
  try {
    const pref = await prisma.preference.findUnique({
      where: { key: req.params.key },
    });
    res.json({ success: true, data: pref ? JSON.parse(pref.value) : null });
  } catch (error) {
    console.error('Error fetching preference:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/preferences/:key
router.put('/:key', async (req, res) => {
  try {
    const pref = await prisma.preference.upsert({
      where: { key: req.params.key },
      update: { value: JSON.stringify(req.body.value) },
      create: { key: req.params.key, value: JSON.stringify(req.body.value) },
    });
    res.json({ success: true, data: JSON.parse(pref.value) });
  } catch (error) {
    console.error('Error saving preference:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
