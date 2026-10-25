import { selectNobleAdapter } from '../lib/nobleAdapter.js';

const useBluez = process.platform === 'linux' && process.env.RACEHUBOS_BLE_TRANSPORT !== 'noble';
if (!useBluez) selectNobleAdapter();

export const BLEService = useBluez
  ? (await import('./bleBluez.js')).BluezBLEService
  : (await import('./ble.js')).BLEService;
