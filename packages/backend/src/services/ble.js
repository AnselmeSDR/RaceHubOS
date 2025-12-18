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
    this.reconnectDelay = 3000; // 3 secondes
  }

  /**
   * Scanner pour trouver le Control Unit
   * @returns {Promise<string>} L'adresse du peripheral trouvé
   */
  async scan(timeout = 10000) {
    console.log('🔍 Starting BLE scan for Control Unit...');
    console.log('   Noble state:', noble.state);

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        console.log('⏰ Scan timeout - Control Unit not found');
        noble.stopScanning();
        noble.removeAllListeners('discover');
        reject(new Error('Timeout: Control Unit not found'));
      }, timeout);

      const onDiscover = (peripheral) => {
        const name = peripheral.advertisement.localName || 'unknown';
        const address = peripheral.address || peripheral.uuid || peripheral.id;
        console.log(`   Found device: ${name} (${address})`);

        if (name === DEVICE_NAME) {
          console.log('✅ Control Unit found! Address:', address);
          clearTimeout(timer);
          noble.stopScanning();
          noble.removeListener('discover', onDiscover);
          // Stocker le peripheral pour pouvoir le réutiliser
          this.lastFoundPeripheral = peripheral;
          this.emit('discovered', address);
          resolve(peripheral);
        }
      };

      noble.on('discover', onDiscover);

      const startScan = () => {
        console.log('   Starting noble scan...');
        noble.startScanning([], false, (err) => {
          if (err) {
            console.error('❌ Scan error:', err);
            clearTimeout(timer);
            reject(err);
          }
        });
      };

      if (noble.state === 'poweredOn') {
        startScan();
      } else {
        console.log('   Waiting for Bluetooth adapter...');
        noble.once('stateChange', (state) => {
          console.log('   Bluetooth state changed:', state);
          if (state === 'poweredOn') {
            startScan();
          } else {
            clearTimeout(timer);
            reject(new Error(`Bluetooth adapter not ready: ${state}`));
          }
        });
      }
    });
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

    try {
      this.connecting = true;
      this.emit('connecting');

      // Utiliser le peripheral déjà trouvé si disponible et correspondant
      if (this.lastFoundPeripheral) {
        const lastAddr = this.lastFoundPeripheral.address || this.lastFoundPeripheral.uuid || this.lastFoundPeripheral.id;
        if (!address || address === lastAddr) {
          console.log('📱 Using cached peripheral');
          this.peripheral = this.lastFoundPeripheral;
        }
      }

      // Sinon, scanner pour trouver le peripheral
      if (!this.peripheral) {
        if (!address) {
          this.peripheral = await this.scan();
        } else {
          // Attendre que le peripheral soit découvert
          console.log('🔍 Scanning for peripheral with address:', address);
          this.peripheral = await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              noble.stopScanning();
              noble.removeAllListeners('discover');
              reject(new Error('Timeout waiting for peripheral'));
            }, 10000);

            const onDiscover = (peripheral) => {
              const pAddr = peripheral.address || peripheral.uuid || peripheral.id;
              console.log(`   Checking: ${pAddr} vs ${address}`);
              if (pAddr === address || peripheral.advertisement.localName === DEVICE_NAME) {
                clearTimeout(timeout);
                noble.stopScanning();
                noble.removeListener('discover', onDiscover);
                resolve(peripheral);
              }
            };

            noble.on('discover', onDiscover);
            noble.startScanning([], false);
          });
        }
      }

      // Se connecter au peripheral
      await new Promise((resolve, reject) => {
        this.peripheral.connect((error) => {
          if (error) reject(error);
          else resolve();
        });
      });

      this.emit('connected');

      // Découvrir TOUS les services et caractéristiques d'abord pour debug
      console.log('🔎 Discovering services and characteristics...');
      const { services, characteristics } = await new Promise((resolve, reject) => {
        this.peripheral.discoverAllServicesAndCharacteristics((error, services, characteristics) => {
          if (error) reject(error);
          else resolve({ services, characteristics });
        });
      });

      console.log('📋 Found services:', services.map(s => s.uuid));
      console.log('📋 Found characteristics:', characteristics.map(c => c.uuid));

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
      await new Promise((resolve, reject) => {
        this.notifyCharacteristic.subscribe((error) => {
          if (error) {
            console.error('❌ Subscribe error:', error);
            reject(error);
          } else {
            console.log('✅ Subscribed to notifications');
            resolve();
          }
        });
      });

      // Écouter les données
      this.notifyCharacteristic.on('data', (data) => {
        console.log('🔵 BLE Raw data:', data.toString('hex'));
        this.handleNotification(data);
      });

      // Gérer les déconnexions
      this.peripheral.once('disconnect', () => {
        this.handleDisconnect();
      });

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
   * Gérer les notifications BLE du Control Unit
   * @param {Buffer} data - Données reçues
   */
  handleNotification(data) {
    try {
      // Les notifications BLE se terminent par '$' selon le protocole
      let buffer = data;

      if (buffer[buffer.length - 1] === 0x24) { // '$'
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
    this.outputCharacteristic = null;
    this.notifyCharacteristic = null;
    this.emit('disconnect');

    // Tentative de reconnexion automatique
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(
        `🔄 Attempting reconnection (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`
      );

      this.reconnectTimer = setTimeout(() => {
        this.connect().catch((error) => {
          console.error('Reconnection failed:', error.message);
        });
      }, this.reconnectDelay);
    } else {
      console.error('❌ Max reconnection attempts reached');
      this.emit('reconnect-failed');
    }
  }

  /**
   * Se déconnecter du Control Unit
   */
  async disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

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

  /**
   * Obtenir l'état de la connexion
   */
  isConnected() {
    return this.connected;
  }
}

export default BLEService;
