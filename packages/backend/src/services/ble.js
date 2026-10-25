import EventEmitter from 'events';
import noble from '@abandonware/noble';

// UUIDs du Control Unit Carrera (format Noble: minuscules sans tirets)
const SERVICE_UUID = '39df7777b1b4b90b57f17144ae4e4a6a';
const OUTPUT_UUID = '39df8888b1b4b90b57f17144ae4e4a6a';
const NOTIFY_UUID = '39df9999b1b4b90b57f17144ae4e4a6a';
const DEVICE_NAME = 'Control_Unit';

/**
 * Service de connexion Bluetooth LE au Control Unit Carrera
 * Gère la découverte, connexion, et communication avec le dispositif
 */
export class BLEService extends EventEmitter {
  constructor({ adapter, operationTimeout = 10000 } = {}) {
    super();
    adapter ??= noble;
    this.adapter = adapter;
    this.operationTimeout = operationTimeout;
    this.connectionGeneration = 0;
    this.cancelConnection = null;
    this.manualDisconnect = false;
    this.peripheral = null;
    this.outputCharacteristic = null;
    this.notifyCharacteristic = null;
    this.onNotification = null;
    this.connected = false;
    this.connecting = false;
    this.reconnectTimer = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 3000; // 3 secondes
  }

  /**
   * Scanner pour trouver le Control Unit
   * @returns {Promise<string>} L'adresse du peripheral trouvé
   */
  async scan(timeout = 10000) {
    if (this.connecting) throw new Error('Connection already in progress');
    const peripheral = await this.discoverPeripheral(null, timeout);
    this.lastFoundPeripheral = peripheral;
    this.emit('discovered', peripheral.address || peripheral.uuid || peripheral.id);
    return peripheral;
  }

  async discoverPeripheral(address, timeout = this.operationTimeout) {
    let ready;
    if (this.adapter.state !== 'poweredOn') {
      try {
        await this.waitForConnection(
          (done) => {
            ready = (state) => {
              if (state === 'poweredOn') done();
            };
            this.adapter.on('stateChange', ready);
          },
          'Bluetooth adapter',
          timeout
        );
      } finally {
        this.adapter.off('stateChange', ready);
      }
    }
    let discover;
    try {
      return await this.waitForConnection(
        (done) => {
          discover = (peripheral) => {
            const found = peripheral.address || peripheral.uuid || peripheral.id;
            const matches = address
              ? String(found).toLowerCase() === String(address).toLowerCase()
              : peripheral.advertisement?.localName === DEVICE_NAME;
            if (matches) done(null, peripheral);
          };
          this.adapter.on('discover', discover);
          this.adapter.startScanning([], false, (error) => {
            if (error) done(error);
          });
        },
        'Bluetooth discovery',
        timeout
      );
    } finally {
      this.adapter.off('discover', discover);
      // Connecting before the controller acknowledges scan-stop races the HCI command.
      let stopped;
      try {
        await this.waitForConnection(
          (done) => {
            stopped = () => done();
            this.adapter.once('scanStop', stopped);
            this.adapter.stopScanning();
          },
          'Bluetooth scan stop',
          timeout
        );
      } catch {
        // Some backends never acknowledge an inactive scan. Cleanup must not
        // replace either a discovered peripheral or the discovery error.
      } finally {
        this.adapter.off('scanStop', stopped);
      }
    }
  }

  /**
   * Se connecter au Control Unit
   * @param {string} address - Adresse/UUID du peripheral (optionnel, scan automatique si non fourni)
   */
  async connect(address = null) {
    if (this.connected) {
      throw new Error('Already connected');
    }

    if (this.connecting) {
      throw new Error('Connection already in progress');
    }

    const generation = ++this.connectionGeneration;
    const assertCurrent = () => {
      if (generation !== this.connectionGeneration) throw new Error('CU connection cancelled');
    };
    try {
      this.connecting = true;
      this.manualDisconnect = false;
      this.emit('connecting');

      // Utiliser le peripheral déjà trouvé si disponible et correspondant
      if (this.lastFoundPeripheral) {
        const lastAddr =
          this.lastFoundPeripheral.address || this.lastFoundPeripheral.uuid || this.lastFoundPeripheral.id;
        if (!address || String(address).toLowerCase() === String(lastAddr).toLowerCase()) {
          console.log('📱 Using cached peripheral');
          this.peripheral = this.lastFoundPeripheral;
        }
      }

      if (!this.peripheral) this.peripheral = await this.discoverPeripheral(address);

      assertCurrent();
      const peripheral = this.peripheral;
      await this.waitForConnection((done) => peripheral.connect(done), 'Bluetooth connection');
      assertCurrent();

      const { services, characteristics } = await this.waitForConnection((done) => {
        peripheral.discoverSomeServicesAndCharacteristics(
          [SERVICE_UUID],
          [OUTPUT_UUID, NOTIFY_UUID],
          (error, services, characteristics) => {
            done(error, { services, characteristics });
          }
        );
      }, 'AppConnect discovery');
      assertCurrent();

      this._discoveredServices = services.map((s) => s.uuid);
      console.log('📋 Found services:', this._discoveredServices);
      console.log(
        '📋 Found characteristics:',
        characteristics.map((c) => c.uuid)
      );

      // Trouver les caractéristiques (comparer sans tirets, en minuscules)
      this.outputCharacteristic = characteristics.find(
        (c) => c.uuid.replace(/-/g, '').toLowerCase() === OUTPUT_UUID.replace(/-/g, '').toLowerCase()
      );
      this.notifyCharacteristic = characteristics.find(
        (c) => c.uuid.replace(/-/g, '').toLowerCase() === NOTIFY_UUID.replace(/-/g, '').toLowerCase()
      );

      console.log('📍 Output characteristic:', this.outputCharacteristic?.uuid);
      console.log('📍 Notify characteristic:', this.notifyCharacteristic?.uuid);

      if (!this.outputCharacteristic || !this.notifyCharacteristic) {
        throw new Error('Required characteristics not found');
      }

      // S'abonner aux notifications
      console.log('🔔 Subscribing to notifications on characteristic:', this.notifyCharacteristic.uuid);
      await this.waitForConnection((done) => this.notifyCharacteristic.subscribe(done), 'AppConnect subscribe');
      assertCurrent();

      // Écouter les données
      this.onNotification = (data) => {
        if (generation === this.connectionGeneration && this.peripheral === peripheral && this.connected) {
          this.handleNotification(data);
        }
      };
      this.notifyCharacteristic.on('data', this.onNotification);

      // Gérer les déconnexions
      peripheral.once('disconnect', () => {
        if (this.peripheral === peripheral) this.handleDisconnect();
      });

      this.connected = true;
      this.connecting = false;
      this.reconnectAttempts = 0;
      this.emit('ready');

      console.log('✅ Connected to Control Unit');
    } catch (error) {
      if (generation === this.connectionGeneration) {
        const failed = this.peripheral;
        this.peripheral = null;
        this.lastFoundPeripheral = null;
        this.outputCharacteristic = null;
        if (this.onNotification) this.notifyCharacteristic?.off('data', this.onNotification);
        this.notifyCharacteristic = null;
        this.onNotification = null;
        this.connected = false;
        this.connecting = false;
        try {
          failed?.cancelConnect?.();
          failed?.disconnect(() => {});
        } catch {
          /* retry discovers afresh */
        }
        this.emit('error', error);
      }
      throw error;
    }
  }

  waitForConnection(start, label, timeout = this.operationTimeout) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (error, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (this.cancelConnection === cancel) this.cancelConnection = null;
        if (error) reject(error);
        else resolve(value);
      };
      const cancel = () => finish(new Error('CU connection cancelled'));
      const timer = setTimeout(() => finish(new Error(`${label} timed out`)), timeout);
      this.cancelConnection = cancel;
      try {
        start(finish);
      } catch (error) {
        finish(error);
      }
    });
  }

  /**
   * Gérer les notifications BLE du Control Unit
   * @param {Buffer} data - Données reçues
   */
  handleNotification(data) {
    try {
      // Les notifications BLE se terminent par '$' selon le protocole
      let buffer = data;

      if (buffer[buffer.length - 1] === 0x24) {
        // '$'
        // Retirer le '$' final
        buffer = buffer.slice(0, -1);

        // Ajouter le préfixe selon la longueur
        if (buffer.length === 5) {
          buffer = Buffer.concat([Buffer.from('0'), buffer]);
        } else {
          buffer = Buffer.concat([Buffer.from('?'), buffer]);
        }
      }

      this.emit('data', buffer);
    } catch (error) {
      this.emit('error', error);
    }
  }

  /**
   * Get peripheral info (BLE metadata)
   */
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

  /**
   * Envoyer des données au Control Unit
   * @param {Buffer} data - Données à envoyer
   */
  async send(data) {
    if (!this.connected || !this.outputCharacteristic) {
      throw new Error('Not connected');
    }

    try {
      console.log('🔴 BLE Sending:', data.toString('hex'), '| ASCII:', data.toString('ascii'));
      await new Promise((resolve, reject) => {
        // true = withoutResponse (requis par le Control Unit Carrera)
        this.outputCharacteristic.write(data, true, (error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Gérer la déconnexion
   */
  handleDisconnect() {
    console.log('⚠️  Disconnected from Control Unit');
    this.connected = false;
    this.connecting = false;
    this.outputCharacteristic = null;
    if (this.onNotification) this.notifyCharacteristic?.off('data', this.onNotification);
    this.notifyCharacteristic = null;
    this.onNotification = null;
    // Keep lastFoundPeripheral but clear peripheral for fresh reconnect
    this.peripheral = null;
    this.emit('disconnect');

    if (this.manualDisconnect || this.externalRecovery) return;

    // Tentative de reconnexion automatique
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`🔄 Attempting reconnection (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

      this.reconnectTimer = setTimeout(() => {
        this.connect().catch((error) => {
          console.error(
            `❌ Reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} failed:`,
            error.message
          );
          // Trigger next attempt
          this.handleDisconnect();
        });
      }, this.reconnectDelay);
    } else {
      console.error('❌ Max reconnection attempts reached');
      this.reconnectAttempts = 0;
      this.emit('reconnect-failed');
    }
  }

  /**
   * Se déconnecter du Control Unit
   */
  async disconnect() {
    this.manualDisconnect = true;
    this.connectionGeneration += 1;
    this.cancelConnection?.();
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    const peripheral = this.peripheral;
    const wasConnected = this.connected;
    this.peripheral = null;
    this.lastFoundPeripheral = null;
    this.connected = false;
    this.connecting = false;
    this.outputCharacteristic = null;
    if (this.onNotification) this.notifyCharacteristic?.off('data', this.onNotification);
    this.notifyCharacteristic = null;
    this.onNotification = null;
    if (wasConnected) this.emit('disconnect');
    if (peripheral) {
      await this.waitForConnection((done) => peripheral.disconnect(done), 'Bluetooth disconnect');
    }
  }

  /**
   * Obtenir l'état de la connexion
   */
  isConnected() {
    return this.connected;
  }
}

export default BLEService;
