import express from 'express';
import { createPrismaClient } from '../lib/prisma.js';
import { SIMULATOR_ADDRESS } from '../services/simulator.js';
import { HttpError, route } from '../lib/http.js';

const router = express.Router();
const prisma = createPrismaClient();

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

const SIMULATOR_DEVICE = { address: SIMULATOR_ADDRESS, name: 'Simulateur (Virtual)', type: 'simulator' };
const refuse = (error) => {
  throw new HttpError(400, error);
};
const currentDevice = () => syncService?.getDevice();

router.get('/status', (req, res) => {
  const device = currentDevice();
  const isSimulator = device === simulator;
  res.json({
    available: true,
    connected: syncService?.isConnected() || false,
    deviceType: device ? (isSimulator ? 'simulator' : 'controlUnit') : null,
    deviceAddress: device ? (isSimulator ? SIMULATOR_ADDRESS : device.address) : null,
    lastStatus: syncService?.getCuStatus(),
  });
});

// GET /api/bluetooth/devices - the simulator, and the control unit when there is one
router.get('/devices', (req, res) => {
  const devices = [{ ...SIMULATOR_DEVICE, connected: simulator?.isConnected() || false }];
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

// POST /api/bluetooth/scan - Body: { timeout }; the simulator, and the control unit if one answers
router.post('/scan', async (req, res) => {
  const devices = [SIMULATOR_DEVICE];
  if (controlUnit) {
    try {
      const address = await controlUnit.scan(req.body.timeout ?? 10000);
      devices.push({ address, name: 'Control Unit', type: 'controlUnit' });
    } catch (error) {
      console.warn('[Bluetooth] Scan error:', error.message);
    }
  }
  res.json({ success: true, devices });
});

/** Connects the simulator or the control unit at `address`, and returns its device type. */
async function connectTo(address) {
  if (address === SIMULATOR_ADDRESS) {
    if (!simulator) refuse('Simulator not available');
    await simulator.connect();
    syncService?.setDevice(simulator);
    return 'simulator';
  }
  if (!controlUnit) refuse('Control Unit not available');
  await controlUnit.connect(address);
  syncService?.setDevice(controlUnit);
  syncService?.startPolling();
  return 'controlUnit';
}

const ALREADY_CONNECTING = ['Already connected', 'Connection already in progress'];

// POST /api/bluetooth/connect - Body: { address }; the device is handed to the sync service and remembered
router.post(
  '/connect',
  route(null, async (req, res) => {
    const { address } = req.body;
    if (!address) refuse('Address is required');

    let deviceType;
    try {
      deviceType = await connectTo(address);
    } catch (error) {
      if (ALREADY_CONNECTING.includes(error.message)) return res.json({ success: true, message: error.message });
      throw error;
    }

    const simulated = deviceType === 'simulator';
    const device = await prisma.device.upsert({
      where: { address },
      update: { lastConnected: new Date() },
      create: {
        address,
        name: simulated ? 'Simulateur' : 'Control Unit',
        type: simulated ? 'simulator' : 'cu',
        lastConnected: new Date(),
      },
    });
    res.json({ success: true, message: `Connected to ${deviceType}`, deviceType, address, device });
  })
);

router.post(
  '/disconnect',
  route(null, async (req, res) => {
    const device = currentDevice();
    if (device) {
      await device.disconnect();
      syncService?.setDevice(null);
    }
    res.json({ success: true, message: 'Disconnected' });
  })
);

router.get(
  '/version',
  route(null, async (req, res) => {
    const device = currentDevice();
    if (!device?.isConnected?.()) refuse('No device connected');
    res.json({ success: true, version: await device.version() });
  })
);

// GET /api/bluetooth/info - version (when connected), BLE details and connection
router.get(
  '/info',
  route(null, async (req, res) => {
    const device = currentDevice();
    if (!device) refuse('No device connected');
    const ble = device.ble?.getPeripheralInfo?.() || null;
    const connected = device.isConnected?.() || false;
    const version = connected ? await device.version().catch(() => null) : null;
    res.json({ success: true, data: { version, ble, connected } });
  })
);

// POST /api/bluetooth/start-race | esc | reset-timer
for (const [path, command, message] of [
  ['start-race', 'startRace', 'Race started'],
  ['esc', 'stopRace', 'ESC pressed'],
  ['reset-timer', 'reset', 'Timer reset'],
]) {
  router.post(
    `/${path}`,
    route(null, async (req, res) => {
      await syncService?.[command]();
      res.json({ success: true, message });
    })
  );
}

router.post(
  '/clear-position',
  route(null, async (req, res) => {
    await currentDevice()?.clearPosition?.();
    res.json({ success: true, message: 'Position cleared' });
  })
);

router.post(
  '/button/:id',
  route(null, async (req, res) => {
    const buttonId = parseInt(req.params.id);
    if (isNaN(buttonId) || buttonId < 1 || buttonId > 8) refuse('Invalid button ID (1-8)');
    await syncService?.pressButton(buttonId);
    res.json({ success: true, message: `Button ${buttonId} pressed` });
  })
);

// POST /api/bluetooth/set-speed | set-brake | set-fuel - Body: { address, value }
for (const [path, command, label] of [
  ['set-speed', 'setSpeed', 'Speed'],
  ['set-brake', 'setBrake', 'Brake'],
  ['set-fuel', 'setFuel', 'Fuel'],
]) {
  router.post(
    `/${path}`,
    route(null, async (req, res) => {
      const device = currentDevice();
      if (!device?.[command]) refuse(`Device does not support ${command}`);
      const { address, value } = req.body;
      await device[command](address, value);
      res.json({ success: true, message: `${label} set for controller ${address}` });
    })
  );
}

// ==================== Simulator-specific routes ====================

/** The connected simulator, or a 400. */
function connectedSimulator() {
  if (!simulator?.isConnected()) refuse('Simulator not connected');
  return simulator;
}

/** The simulator, or a 400. */
function availableSimulator() {
  if (!simulator) refuse('Simulator not available');
  return simulator;
}

const inRange = (value, max) => typeof value === 'number' && value >= 0 && value <= max;

// POST /api/bluetooth/simulator/state - Body: { state } (0-9), set by hand
router.post(
  '/simulator/state',
  route(null, async (req, res) => {
    const sim = connectedSimulator();
    const { state } = req.body;
    if (!inRange(state, 9)) refuse('Invalid state (0-9)');
    sim.cuState = state;
    sim.raceActive = state === 0; // RACING
    sim.emitCuStatus();
    res.json({ success: true, state });
  })
);

// POST /api/bluetooth/simulator/lap - Body: { controller } (0-5), a lap triggered by hand
router.post(
  '/simulator/lap',
  route(null, async (req, res) => {
    const sim = connectedSimulator();
    const { controller } = req.body;
    if (!inRange(controller, 5)) refuse('Invalid controller (0-5)');
    const car = sim.cars[controller];
    if (!car) refuse('Car not found');
    sim.completeLap(car);
    res.json({ success: true, message: `Lap triggered for controller ${controller}` });
  })
);

router.post(
  '/simulator/reset',
  route(null, async (req, res) => {
    availableSimulator().reset();
    res.json({ success: true, message: 'Simulator reset' });
  })
);

router.get(
  '/simulator/state',
  route(null, async (req, res) => {
    res.json({ success: true, data: availableSimulator().getState() });
  })
);

export default router;
