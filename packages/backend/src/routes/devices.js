import express from 'express';
import { createPrismaClient } from '../lib/prisma.js';
import { HttpError, findOr404, route } from '../lib/http.js';

/** Known devices: the simulator and the Control Units connected once. */
const router = express.Router();
const prisma = createPrismaClient();

router.get(
  '/',
  route('Failed to fetch devices', async (req, res) => {
    const devices = await prisma.device.findMany({ orderBy: [{ type: 'asc' }, { lastConnected: 'desc' }] });
    res.json({ success: true, data: devices, count: devices.length });
  })
);

router.get(
  '/:id',
  route('Failed to fetch device', async (req, res) => {
    res.json({ success: true, data: await findOr404(prisma.device, req.params.id, 'Device') });
  })
);

// Renames a device
router.put(
  '/:id',
  route('Failed to update device', async (req, res) => {
    const { id } = await findOr404(prisma.device, req.params.id, 'Device');
    res.json({ success: true, data: await prisma.device.update({ where: { id }, data: { name: req.body.name } }) });
  })
);

router.delete(
  '/:id',
  route('Failed to delete device', async (req, res) => {
    const device = await findOr404(prisma.device, req.params.id, 'Device');
    if (device.type === 'simulator') throw new HttpError(400, 'Cannot delete simulator device');
    await prisma.device.delete({ where: { id: device.id } });
    res.json({ success: true, message: 'Device deleted successfully' });
  })
);

export default router;
