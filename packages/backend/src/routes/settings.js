import express from 'express';

/** Live connection state, in memory — not used by the interface. */
const router = express.Router();

const connectionState = {
  useMockDevice: process.env.USE_MOCK_DEVICE === 'true',
  connectedDevice: null,
  connectionStatus: 'disconnected',
};
const bluetoothDevice = () => ({ device: connectionState.connectedDevice, status: connectionState.connectionStatus });

let ioInstance = null;

export function setSettingsIo(io) {
  ioInstance = io;
}

router.get('/', (req, res) => {
  res.json({ success: true, data: connectionState });
});

router.post('/mock-device', (req, res) => {
  const { enabled } = req.body;
  process.env.USE_MOCK_DEVICE = enabled ? 'true' : 'false';
  connectionState.useMockDevice = enabled;
  ioInstance?.emit('race:status', {
    running: false,
    active: false,
    raceTime: 0,
    carCount: enabled ? 6 : 0,
    isMockDevice: enabled,
  });
  res.json({ success: true, data: { useMockDevice: enabled } });
});

router.get('/bluetooth-device', (req, res) => {
  res.json({ success: true, data: bluetoothDevice() });
});

router.post('/bluetooth-device', (req, res) => {
  const { deviceId, deviceName, connected } = req.body;
  Object.assign(
    connectionState,
    connected
      ? { connectedDevice: { id: deviceId, name: deviceName }, connectionStatus: 'connected' }
      : { connectedDevice: null, connectionStatus: 'disconnected' }
  );
  res.json({ success: true, data: bluetoothDevice() });
});

export default router;
