import express from 'express';
import { SIMULATOR_ADDRESS } from '../services/simulator.js';

const router = express.Router();

// Device references (set from index.js)
let controlUnit = null;
let simulator = null;
let syncService = null;

export function setControlUnit(cu) {
  controlUnit = cu;
}

export function setSimulator(sim) {
  simulator = sim;
}

export function setSyncService(sync) {
  syncService = sync;
}

/**
 * GET /api/bluetooth/status
 */
router.get('/status', async (req, res) => {
  const currentDevice = syncService?.getDevice();
  const isSimulator = currentDevice === simulator;

  res.json({
    available: true,
    connected: syncService?.isConnected() || false,
    deviceType: currentDevice ? (isSimulator ? 'simulator' : 'controlUnit') : null,
    lastStatus: syncService?.getCuStatus(),
  });
});

/**
 * GET /api/bluetooth/devices
 * List available devices (real CU + simulator)
 */
router.get('/devices', async (req, res) => {
  const devices = [];

  // Add simulator as virtual device
  devices.push({
    address: SIMULATOR_ADDRESS,
    name: 'Simulateur (Virtual)',
    type: 'simulator',
    connected: simulator?.isConnected() || false,
  });

  // Add real CU if available
  if (controlUnit) {
    devices.push({
      address: controlUnit.ble?.peripheral?.address || 'CONTROL_UNIT',
      name: 'Control Unit',
      type: 'controlUnit',
      connected: controlUnit.isConnected(),
    });
  }

  res.json({ success: true, devices });
});

/**
 * POST /api/bluetooth/scan
 * Scan for real BLE devices + include simulator
 */
router.post('/scan', async (req, res) => {
  const devices = [];

  // Always include simulator
  devices.push({
    address: SIMULATOR_ADDRESS,
    name: 'Simulateur (Virtual)',
    type: 'simulator',
  });

  // Scan for real CU if available
  if (controlUnit) {
    try {
      const { timeout = 10000 } = req.body;
      const address = await controlUnit.scan(timeout);

      devices.push({
        address,
        name: 'Control Unit',
        type: 'controlUnit',
      });
    } catch (error) {
      console.warn('[Bluetooth] Scan error:', error.message);
      // Continue - still return simulator
    }
  }

  res.json({ success: true, devices });
});

/**
 * POST /api/bluetooth/connect
 * Connect to a device (simulator or real CU)
 */
router.post('/connect', async (req, res) => {
  const { address } = req.body;

  if (!address) {
    return res.status(400).json({ success: false, error: 'Address is required' });
  }

  try {
    let device;
    let deviceType;

    if (address === SIMULATOR_ADDRESS) {
      // Connect to simulator
      if (!simulator) {
        return res.status(400).json({ success: false, error: 'Simulator not available' });
      }
      await simulator.connect();
      device = simulator;
      deviceType = 'simulator';
    } else {
      // Connect to real CU
      if (!controlUnit) {
        return res.status(400).json({ success: false, error: 'Control Unit not available' });
      }
      await controlUnit.connect(address);
      device = controlUnit;
      deviceType = 'controlUnit';
    }

    // Hot-swap device in SyncService
    syncService?.setDevice(device);

    // Start polling for real CU
    if (deviceType === 'controlUnit') {
      syncService?.startPolling();
    }

    res.json({
      success: true,
      message: `Connected to ${deviceType}`,
      deviceType,
      address,
    });
  } catch (error) {
    if (error.message === 'Already connected' || error.message === 'Connection already in progress') {
      return res.json({ success: true, message: error.message });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/bluetooth/disconnect
 */
router.post('/disconnect', async (req, res) => {
  try {
    const currentDevice = syncService?.getDevice();

    if (currentDevice) {
      await currentDevice.disconnect();
      syncService?.setDevice(null);
    }

    res.json({ success: true, message: 'Disconnected' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/bluetooth/version
 */
router.get('/version', async (req, res) => {
  const currentDevice = syncService?.getDevice();

  if (!currentDevice?.isConnected?.()) {
    return res.status(400).json({ success: false, error: 'No device connected' });
  }

  try {
    const version = await currentDevice.version();
    res.json({ success: true, version });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/bluetooth/start-race
 */
router.post('/start-race', async (req, res) => {
  try {
    await syncService?.startRace();
    res.json({ success: true, message: 'Race started' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/bluetooth/esc
 */
router.post('/esc', async (req, res) => {
  try {
    await syncService?.stopRace();
    res.json({ success: true, message: 'ESC pressed' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/bluetooth/button/:id
 */
router.post('/button/:id', async (req, res) => {
  try {
    const buttonId = parseInt(req.params.id);
    if (isNaN(buttonId) || buttonId < 1 || buttonId > 8) {
      return res.status(400).json({ error: 'Invalid button ID (1-8)' });
    }

    await syncService?.pressButton(buttonId);
    res.json({ success: true, message: `Button ${buttonId} pressed` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/bluetooth/set-speed
 */
router.post('/set-speed', async (req, res) => {
  const currentDevice = syncService?.getDevice();

  if (!currentDevice?.setSpeed) {
    return res.status(400).json({ error: 'Device does not support setSpeed' });
  }

  try {
    const { address, value } = req.body;
    await currentDevice.setSpeed(address, value);
    res.json({ success: true, message: `Speed set for controller ${address}` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/bluetooth/set-brake
 */
router.post('/set-brake', async (req, res) => {
  const currentDevice = syncService?.getDevice();

  if (!currentDevice?.setBrake) {
    return res.status(400).json({ error: 'Device does not support setBrake' });
  }

  try {
    const { address, value } = req.body;
    await currentDevice.setBrake(address, value);
    res.json({ success: true, message: `Brake set for controller ${address}` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/bluetooth/set-fuel
 */
router.post('/set-fuel', async (req, res) => {
  const currentDevice = syncService?.getDevice();

  if (!currentDevice?.setFuel) {
    return res.status(400).json({ error: 'Device does not support setFuel' });
  }

  try {
    const { address, value } = req.body;
    await currentDevice.setFuel(address, value);
    res.json({ success: true, message: `Fuel set for controller ${address}` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
