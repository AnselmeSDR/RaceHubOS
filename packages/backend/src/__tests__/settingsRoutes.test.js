import { jest } from '@jest/globals';
import { apiFor } from './helpers/entityFixtures.js';

const previous = process.env.USE_MOCK_DEVICE;
process.env.USE_MOCK_DEVICE = 'true';
const { default: router, setSettingsIo } = await import('../routes/settings.js');
const api = apiFor('/api/settings', router);
const io = { emit: jest.fn() };
afterAll(() => {
  process.env.USE_MOCK_DEVICE = previous;
});

test('the connection state starts from the environment', async () => {
  expect((await api.get('/api/settings')).body).toEqual({
    success: true,
    data: { useMockDevice: true, connectedDevice: null, connectionStatus: 'disconnected' },
  });
});

test('a Bluetooth device is recorded as connected, then disconnected', async () => {
  const connected = await api.post('/api/settings/bluetooth-device').send({
    deviceId: 'AA',
    deviceName: 'CU',
    connected: true,
  });
  const expected = { device: { id: 'AA', name: 'CU' }, status: 'connected' };
  expect(connected.body).toEqual({ success: true, data: expected });
  expect((await api.get('/api/settings/bluetooth-device')).body.data).toEqual(expected);

  await api.post('/api/settings/bluetooth-device').send({ connected: false });
  expect((await api.get('/api/settings/bluetooth-device')).body.data).toEqual({ device: null, status: 'disconnected' });
});

test('the mock device is switched, and the browsers told', async () => {
  const res = await api.post('/api/settings/mock-device').send({ enabled: false });
  expect(res.body).toEqual({ success: true, data: { useMockDevice: false } });
  expect(process.env.USE_MOCK_DEVICE).toBe('false');

  setSettingsIo(io);
  await api.post('/api/settings/mock-device').send({ enabled: true });
  expect(process.env.USE_MOCK_DEVICE).toBe('true');
  expect(io.emit).toHaveBeenCalledWith('race:status', {
    running: false,
    active: false,
    raceTime: 0,
    carCount: 6,
    isMockDevice: true,
  });
  expect((await api.get('/api/settings')).body.data.useMockDevice).toBe(true);
});
