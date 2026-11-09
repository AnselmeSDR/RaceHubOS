import EventEmitter from 'events';
import noble from '@abandonware/noble';

// UUIDs du Control Unit Carrera (format Noble: minuscules sans tirets)
const OUTPUT_UUID = '39df8888b1b4b90b57f17144ae4e4a6a';
const NOTIFY_UUID = '39df9999b1b4b90b57f17144ae4e4a6a';
const DEVICE_NAME = 'Control_Unit';
const PEER_TIMEOUT = 10000;

/** A peripheral's address; on macOS it is empty and the uuid stands in. */
export const addressOf = (peripheral) => peripheral.address || peripheral.uuid || peripheral.id;

const sameUuid = (uuid) => (characteristic) => characteristic.uuid.replace(/-/g, '').toLowerCase() === uuid;

/** Runs a noble call taking a node-style callback; resolves with the callback's results. */
const call = (fn) =>
  new Promise((resolve, reject) => fn((error, ...results) => (error ? reject(error) : resolve(results))));

/**
 * Service de connexion Bluetooth LE au Control Unit Carrera
 * Gère la découverte, connexion, et communication avec le dispositif
 *
 * Events: discovered, connecting, connected, ready, data, error, disconnect, reconnect-failed.
 */
export class BLEService extends EventEmitter {
  constructor() {
    super();
    this.peripheral = null;
    this.outputCharacteristic = null;
    this.notifyCharacteristic = null;
    this.connected = false;
    this.connecting = false;
    this.reconnectTimer = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 3000;
  }

  /** Finds the Control Unit, once the adapter is on; resolves with its peripheral. */
  async scan(timeout = PEER_TIMEOUT) {
    console.log('🔍 Starting BLE scan for Control Unit...');
    console.log('   Noble state:', noble.state);

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        console.log('⏰ Scan timeout - Control Unit not found');
        noble.stopScanning();
        noble.removeListener('discover', onDiscover);
        reject(new Error('Timeout: Control Unit not found'));
      }, timeout);

      const onDiscover = (peripheral) => {
        const name = peripheral.advertisement.localName || 'unknown';
        const address = addressOf(peripheral);
        console.log(`   Found device: ${name} (${address})`);
        if (name !== DEVICE_NAME) return;

        console.log('✅ Control Unit found! Address:', address);
        clearTimeout(timer);
        noble.stopScanning();
        noble.removeListener('discover', onDiscover);
        this.lastFoundPeripheral = peripheral; // reused by connect()
        this.emit('discovered', address);
        resolve(peripheral);
      };
      noble.on('discover', onDiscover);

      const startScan = () => {
        console.log('   Starting noble scan...');
        noble.startScanning([], false, (err) => {
          if (!err) return;
          console.error('❌ Scan error:', err);
          clearTimeout(timer);
          reject(err);
        });
      };

      if (noble.state === 'poweredOn') return startScan();
      console.log('   Waiting for Bluetooth adapter...');
      noble.once('stateChange', (state) => {
        console.log('   Bluetooth state changed:', state);
        if (state === 'poweredOn') return startScan();
        clearTimeout(timer);
        reject(new Error(`Bluetooth adapter not ready: ${state}`));
      });
    });
  }

  /** Scans for `address`, or any Control Unit. */
  findPeripheral(address) {
    console.log('🔍 Scanning for peripheral with address:', address);
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        noble.stopScanning();
        noble.removeListener('discover', onDiscover);
        reject(new Error('Timeout waiting for peripheral'));
      }, PEER_TIMEOUT);

      const onDiscover = (peripheral) => {
        const name = peripheral.advertisement?.localName;
        console.log(`   Checking: ${name || 'unknown'} (${addressOf(peripheral)}) vs ${address}`);
        if (addressOf(peripheral) !== address && name !== DEVICE_NAME) return;
        clearTimeout(timeout);
        noble.stopScanning();
        noble.removeListener('discover', onDiscover);
        resolve(peripheral);
      };
      noble.on('discover', onDiscover);
      noble.startScanning([], false);
    });
  }

  /**
   * Connects to the Control Unit: the one a scan found, else the peripheral at `address`, else
   * the first one found. Subscribes to its notifications, then emits `ready`.
   */
  async connect(address = null) {
    if (this.connected) throw new Error('Already connected');
    if (this.connecting) throw new Error('Connection already in progress');

    try {
      this.connecting = true;
      this.emit('connecting');

      const cached = this.lastFoundPeripheral;
      if (cached && (!address || address === addressOf(cached))) {
        console.log('📱 Using cached peripheral');
        this.peripheral = cached;
      }
      this.peripheral ??= address ? await this.findPeripheral(address) : await this.scan();

      await call((done) => this.peripheral.connect(done));
      this.emit('connected');

      console.log('🔎 Discovering services and characteristics...');
      const [services, characteristics] = await call((done) =>
        this.peripheral.discoverAllServicesAndCharacteristics(done)
      );
      this._discoveredServices = services.map((s) => s.uuid);
      console.log('📋 Found services:', this._discoveredServices);
      console.log(
        '📋 Found characteristics:',
        characteristics.map((c) => c.uuid)
      );

      this.outputCharacteristic = characteristics.find(sameUuid(OUTPUT_UUID));
      this.notifyCharacteristic = characteristics.find(sameUuid(NOTIFY_UUID));
      console.log('📍 Output characteristic:', this.outputCharacteristic?.uuid);
      console.log('📍 Notify characteristic:', this.notifyCharacteristic?.uuid);
      if (!this.outputCharacteristic || !this.notifyCharacteristic) {
        throw new Error('Required characteristics not found');
      }

      console.log('🔔 Subscribing to notifications on characteristic:', this.notifyCharacteristic.uuid);
      try {
        await call((done) => this.notifyCharacteristic.subscribe(done));
      } catch (error) {
        console.error('❌ Subscribe error:', error);
        throw error;
      }
      console.log('✅ Subscribed to notifications');

      this.notifyCharacteristic.on('data', (data) => {
        console.log('🔵 BLE Raw data:', data.toString('hex'));
        this.handleNotification(data);
      });
      this.peripheral.once('disconnect', () => this.handleDisconnect());

      this.connected = true;
      this.connecting = false;
      this.reconnectAttempts = 0;
      this.emit('ready');
      console.log('✅ Connected to Control Unit');
    } catch (error) {
      this.connecting = false;
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * A notification ends with `$` and lacks the command letter of its answer: `0` for the version
   * (5 bytes), `?` for the rest.
   */
  handleNotification(data) {
    try {
      if (data[data.length - 1] !== 0x24) return this.emit('data', data);
      const body = data.subarray(0, -1);
      this.emit('data', Buffer.concat([Buffer.from(body.length === 5 ? '0' : '?'), body]));
    } catch (error) {
      this.emit('error', error);
    }
  }

  /** BLE metadata of the peripheral. */
  getPeripheralInfo() {
    if (!this.peripheral) return null;
    const p = this.peripheral;
    const ad = p.advertisement || {};
    return {
      name: ad.localName || null,
      address: p.address || null,
      uuid: p.uuid || p.id || null,
      rssi: p.rssi || null,
      serviceUuids: ad.serviceUuids || [],
      manufacturerData: ad.manufacturerData ? ad.manufacturerData.toString('hex') : null,
      services: this._discoveredServices || [],
    };
  }

  async send(data) {
    if (!this.connected || !this.outputCharacteristic) throw new Error('Not connected');
    try {
      console.log('🔴 BLE Sending:', data.toString('hex'), '| ASCII:', data.toString('ascii'));
      // true = withoutResponse, required by the Control Unit
      await call((done) => this.outputCharacteristic.write(data, true, done));
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /** The link is lost: tries to reconnect every `reconnectDelay`, up to `maxReconnectAttempts` times. */
  handleDisconnect() {
    console.log('⚠️  Disconnected from Control Unit');
    this.connected = false;
    this.connecting = false;
    this.outputCharacteristic = null;
    this.notifyCharacteristic = null;
    this.peripheral = null; // lastFoundPeripheral stays, for the reconnection
    this.emit('disconnect');

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached');
      this.reconnectAttempts = 0;
      this.emit('reconnect-failed');
      return;
    }
    this.reconnectAttempts++;
    console.log(`🔄 Attempting reconnection (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
    this.reconnectTimer = setTimeout(() => {
      this.connect().catch((error) => {
        console.error(`❌ Reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} failed:`, error.message);
        this.handleDisconnect();
      });
    }, this.reconnectDelay);
  }

  async disconnect() {
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;

    if (this.peripheral && this.connected) {
      await new Promise((resolve) => {
        this.peripheral.disconnect(() => {
          this.connected = false;
          this.outputCharacteristic = null;
          this.notifyCharacteristic = null;
          resolve();
        });
      });
    }
    console.log('Disconnected from Control Unit');
  }

  isConnected() {
    return this.connected;
  }
}

export default BLEService;
