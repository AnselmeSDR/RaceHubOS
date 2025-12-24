import express from 'express';
import { syncService } from '../index.js';

const router = express.Router();
let controlUnit = null;
let simulator = null;

export function setControlUnit(cu) {
  controlUnit = cu;
}

export function setSimulator(sim) {
  simulator = sim;
}

/**
 * GET /api/bluetooth/status
 */
router.get('/status', async (req, res) => {
  if (controlUnit) {
    return res.json({
      available: true,
      connected: controlUnit.isConnected(),
      lastStatus: syncService?.getCuStatus(),
    });
  }

  if (simulator) {
    return res.json({
      available: true,
      connected: true,
      simulator: true,
      lastStatus: simulator.getState().lastStatus,
    });
  }

  return res.json({
    available: false,
    connected: false,
    message: 'No CU or simulator available',
  });
});

/**
 * POST /api/bluetooth/scan
 */
router.post('/scan', async (req, res) => {
  if (!controlUnit) {
    return res.status(400).json({ error: 'Not available in simulator mode' });
  }

  try {
    const { timeout = 10000, autoConnect = true } = req.body;
    const address = await controlUnit.scan(timeout);

    if (autoConnect) {
      console.log('🔗 Auto-connecting to Control Unit...');
      await controlUnit.connect();
    }

    res.json({
      success: true,
      address,
      connected: autoConnect,
      message: autoConnect ? 'Control Unit found and connected' : 'Control Unit found',
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/bluetooth/connect
 */
router.post('/connect', async (req, res) => {
  if (!controlUnit) {
    return res.status(400).json({ error: 'Not available in simulator mode' });
  }

  try {
    const { address } = req.body;
    await controlUnit.connect(address);
    res.json({ success: true, message: 'Connected to Control Unit' });
  } catch (error) {
    // These are not really errors - just return success
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
  if (!controlUnit) {
    return res.status(400).json({ error: 'Not available in simulator mode' });
  }

  try {
    await controlUnit.disconnect();
    res.json({ success: true, message: 'Disconnected from Control Unit' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/bluetooth/version
 */
router.get('/version', async (req, res) => {
  if (!controlUnit) {
    return res.status(400).json({ error: 'Not available in simulator mode' });
  }

  try {
    const version = await controlUnit.version();
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
    if (controlUnit) {
      await controlUnit.start();
    } else if (simulator) {
      simulator.start();
    } else {
      return res.status(400).json({ error: 'No CU or simulator available' });
    }
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
    if (controlUnit) {
      await controlUnit.request(Buffer.from('T1$'));
    } else if (simulator) {
      simulator.stop();
    } else {
      return res.status(400).json({ error: 'No CU or simulator available' });
    }
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

    if (controlUnit) {
      await controlUnit.request(Buffer.from(`T${buttonId}$`));
    } else if (simulator) {
      // Simulator button handling
      if (buttonId === 2) simulator.start();
      else if (buttonId === 1) simulator.stop();
    } else {
      return res.status(400).json({ error: 'No CU or simulator available' });
    }
    res.json({ success: true, message: `Button ${buttonId} pressed` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/bluetooth/set-speed
 */
router.post('/set-speed', async (req, res) => {
  if (!controlUnit) {
    return res.status(400).json({ error: 'Not available in simulator mode' });
  }

  try {
    const { address, value } = req.body;
    await controlUnit.setSpeed(address, value);
    res.json({ success: true, message: `Speed set for controller ${address}` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/bluetooth/set-brake
 */
router.post('/set-brake', async (req, res) => {
  if (!controlUnit) {
    return res.status(400).json({ error: 'Not available in simulator mode' });
  }

  try {
    const { address, value } = req.body;
    await controlUnit.setBrake(address, value);
    res.json({ success: true, message: `Brake set for controller ${address}` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/bluetooth/set-fuel
 */
router.post('/set-fuel', async (req, res) => {
  if (!controlUnit) {
    return res.status(400).json({ error: 'Not available in simulator mode' });
  }

  try {
    const { address, value } = req.body;
    await controlUnit.setFuel(address, value);
    res.json({ success: true, message: `Fuel set for controller ${address}` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
