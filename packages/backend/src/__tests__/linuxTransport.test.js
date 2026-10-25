import { jest } from '@jest/globals';
import { BluezBLEService } from '../services/bleBluez.js';

(process.platform === 'linux' && process.env.RACEHUBOS_BLE_TRANSPORT !== 'noble' ? test : test.skip)(
  'default Linux transport never loads Noble or opens a raw HCI socket',
  async () => {
    jest.unstable_mockModule('@abandonware/noble', () => {
      throw new Error('Noble must not load on Linux');
    });
    const { BLEService } = await import('../services/bluetoothTransport.js');
    const ble = new BLEService();
    expect(ble).toBeInstanceOf(BluezBLEService);
    expect(ble.session).toBeNull();
  }
);
