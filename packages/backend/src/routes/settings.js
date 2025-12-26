import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// Live connection state (in-memory, not persisted)
let connectionState = {
  useMockDevice: process.env.USE_MOCK_DEVICE === 'true',
  connectedDevice: null,
  connectionStatus: 'disconnected'
};

// Store io instance for emitting events
let ioInstance = null;

export function setSettingsIo(io) {
  ioInstance = io;
}

// Update connection state (called by bluetooth.js or controlUnit)
export function updateConnectionState(updates) {
  connectionState = { ...connectionState, ...updates };
  if (ioInstance && updates.connectionStatus) {
    ioInstance.emit('cu:connection', {
      status: connectionState.connectionStatus,
      device: connectionState.connectedDevice
    });
  }
}

// GET /api/settings - Get current settings
router.get('/', async (req, res) => {
  try {
    res.json({
      success: true,
      data: connectionState
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get settings' });
  }
});

// POST /api/settings/mock-device - Toggle mock device
router.post('/mock-device', async (req, res) => {
  try {
    const { enabled } = req.body;

    process.env.USE_MOCK_DEVICE = enabled ? 'true' : 'false';
    connectionState.useMockDevice = enabled;

    if (!enabled && connectionState.connectedDevice?.isMock) {
      connectionState.connectedDevice = null;
      connectionState.connectionStatus = 'disconnected';
    }

    if (ioInstance) {
      ioInstance.emit('race:status', {
        running: false,
        active: false,
        raceTime: 0,
        carCount: enabled ? 6 : 0,
        isMockDevice: enabled
      });
    }

    res.json({ success: true, data: { useMockDevice: enabled } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to toggle mock device' });
  }
});

// GET /api/settings/bluetooth-device - Get current connection info
router.get('/bluetooth-device', async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        device: connectionState.connectedDevice,
        status: connectionState.connectionStatus
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get bluetooth device' });
  }
});

// POST /api/settings/bluetooth-device - Update connection info (internal use)
router.post('/bluetooth-device', async (req, res) => {
  try {
    const { deviceId, deviceName, connected } = req.body;

    if (connected) {
      connectionState.connectedDevice = { id: deviceId, name: deviceName };
      connectionState.connectionStatus = 'connected';
    } else {
      connectionState.connectedDevice = null;
      connectionState.connectionStatus = 'disconnected';
    }

    res.json({
      success: true,
      data: {
        device: connectionState.connectedDevice,
        status: connectionState.connectionStatus
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update bluetooth device' });
  }
});

// ==================== Known Devices (Persisted) ====================

// GET /api/settings/known-devices - Get list of known devices
router.get('/known-devices', async (req, res) => {
  try {
    const devices = await prisma.bluetoothDevice.findMany({
      orderBy: { lastConnected: 'desc' }
    });
    res.json({ success: true, data: devices });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get known devices' });
  }
});

// POST /api/settings/known-devices - Add/update a known device
router.post('/known-devices', async (req, res) => {
  try {
    const { address, name } = req.body;

    if (!address) {
      return res.status(400).json({ success: false, error: 'Address is required' });
    }

    const device = await prisma.bluetoothDevice.upsert({
      where: { address },
      update: {
        name: name || undefined,
        lastConnected: new Date()
      },
      create: {
        address,
        name: name || 'Control_Unit',
        lastConnected: new Date()
      }
    });

    res.json({ success: true, data: device });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to add known device' });
  }
});

// DELETE /api/settings/known-devices/:id - Remove a known device
router.delete('/known-devices/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.bluetoothDevice.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to remove known device' });
  }
});

export default router;
