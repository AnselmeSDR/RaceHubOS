import express from 'express';

const router = express.Router();

// Store settings in memory (could be moved to DB later)
let settings = {
  useMockDevice: process.env.USE_MOCK_DEVICE === 'true',
  connectedDevice: null,
  connectionStatus: 'disconnected'
};

// Store io instance for emitting events
let ioInstance = null;

export function setSettingsIo(io) {
  ioInstance = io;
}

// Mock Bluetooth devices for development
const mockDevices = [
  { id: 'CARRERA-30369-001', name: 'Carrera AppConnect 30369' },
  { id: 'CARRERA-30369-002', name: 'Carrera AppConnect 30369 (2)' }
];

// GET /api/settings - Get current settings
router.get('/', async (req, res) => {
  try {
    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get settings'
    });
  }
});

// POST /api/settings/mock-device - Toggle mock device
router.post('/mock-device', async (req, res) => {
  try {
    const { enabled } = req.body;

    // Update environment variable (for current session only)
    process.env.USE_MOCK_DEVICE = enabled ? 'true' : 'false';
    settings.useMockDevice = enabled;

    // If disabling mock device and was connected to mock, disconnect
    if (!enabled && settings.connectedDevice?.isMock) {
      settings.connectedDevice = null;
      settings.connectionStatus = 'disconnected';
    }

    // Emit update to all connected clients
    if (ioInstance) {
      ioInstance.emit('race:status', {
        running: false,
        active: false,
        raceTime: 0,
        carCount: enabled ? 6 : 0,
        isMockDevice: enabled
      });
    }

    res.json({
      success: true,
      data: { useMockDevice: enabled }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to toggle mock device'
    });
  }
});

// POST /api/bluetooth/scan - Scan for Bluetooth devices
router.post('/scan', async (req, res) => {
  try {
    // If using mock device, return mock devices
    if (settings.useMockDevice) {
      setTimeout(() => {
        res.json({
          success: true,
          devices: mockDevices.map(d => ({ ...d, isMock: true }))
        });
      }, 1500); // Simulate scan delay
      return;
    }

    // TODO: Implement real Bluetooth scanning
    // For now, return empty array for real mode
    res.json({
      success: true,
      devices: []
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to scan for devices'
    });
  }
});

// POST /api/bluetooth/connect - Connect to a Bluetooth device
router.post('/connect', async (req, res) => {
  try {
    const { deviceId } = req.body;

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        error: 'Device ID is required'
      });
    }

    // If using mock device
    if (settings.useMockDevice) {
      const device = mockDevices.find(d => d.id === deviceId);
      if (device) {
        settings.connectedDevice = { ...device, isMock: true };
        settings.connectionStatus = 'connected';

        res.json({
          success: true,
          data: {
            device: settings.connectedDevice,
            status: 'connected'
          }
        });
      } else {
        res.status(404).json({
          success: false,
          error: 'Device not found'
        });
      }
      return;
    }

    // TODO: Implement real Bluetooth connection
    res.status(501).json({
      success: false,
      error: 'Real Bluetooth connection not yet implemented'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to connect to device'
    });
  }
});

// POST /api/bluetooth/disconnect - Disconnect from Bluetooth device
router.post('/disconnect', async (req, res) => {
  try {
    settings.connectedDevice = null;
    settings.connectionStatus = 'disconnected';

    res.json({
      success: true,
      data: {
        status: 'disconnected'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to disconnect device'
    });
  }
});

export default router;