import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/devices - List all devices
router.get('/', async (req, res) => {
  try {
    const devices = await prisma.device.findMany({
      orderBy: [
        { type: 'asc' }, // simulator first
        { lastConnected: 'desc' },
      ],
    });

    res.json({
      success: true,
      data: devices,
      count: devices.length,
    });
  } catch (error) {
    console.error('Error fetching devices:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch devices',
    });
  }
});

// GET /api/devices/:id - Get device by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const device = await prisma.device.findUnique({
      where: { id },
    });

    if (!device) {
      return res.status(404).json({
        success: false,
        error: 'Device not found',
      });
    }

    res.json({
      success: true,
      data: device,
    });
  } catch (error) {
    console.error('Error fetching device:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch device',
    });
  }
});

// PUT /api/devices/:id - Update device (rename)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    const exists = await prisma.device.findUnique({
      where: { id },
    });

    if (!exists) {
      return res.status(404).json({
        success: false,
        error: 'Device not found',
      });
    }

    const device = await prisma.device.update({
      where: { id },
      data: { name },
    });

    res.json({
      success: true,
      data: device,
    });
  } catch (error) {
    console.error('Error updating device:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update device',
    });
  }
});

// DELETE /api/devices/:id - Delete device (not simulator)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const device = await prisma.device.findUnique({
      where: { id },
    });

    if (!device) {
      return res.status(404).json({
        success: false,
        error: 'Device not found',
      });
    }

    // Prevent deleting simulator
    if (device.type === 'simulator') {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete simulator device',
      });
    }

    await prisma.device.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: 'Device deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting device:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete device',
    });
  }
});

export default router;
