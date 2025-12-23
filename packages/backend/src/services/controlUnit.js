import EventEmitter from 'events';
import { BLEService } from './ble.js';
import * as protocol from './protocol.js';

/**
 * Interface vers le Control Unit Carrera Digital 124/132
 * Équivalent Node.js de carreralib.ControlUnit
 */
export class ControlUnit extends EventEmitter {
  // IDs des boutons du Control Unit
  static PACE_CAR_ESC_BUTTON_ID = 1;
  static START_ENTER_BUTTON_ID = 2;
  static SPEED_BUTTON_ID = 5;
  static BRAKE_BUTTON_ID = 6;
  static FUEL_BUTTON_ID = 7;
  static CODE_BUTTON_ID = 8;

  // Masques de mode
  static FUEL_MODE = 0x1;
  static REAL_MODE = 0x2;
  static PIT_LANE_MODE = 0x4;
  static LAP_COUNTER_MODE = 0x8;

  constructor() {
    super();
    this.ble = new BLEService();
    this.responseQueue = [];
    this.waitingForResponse = null;
    this.connected = false;

    // Écouter les événements BLE
    this.ble.on('ready', () => {
      this.connected = true;
      this.emit('connected');
    });

    this.ble.on('disconnect', () => {
      this.connected = false;
      this.emit('disconnected');
    });

    this.ble.on('data', (data) => {
      this.handleData(data);
    });

    this.ble.on('error', (error) => {
      this.emit('error', error);
    });

    this.ble.on('reconnect-failed', () => {
      this.emit('reconnect-failed');
    });
  }

  /**
   * Scanner pour trouver le Control Unit
   * @param {number} timeout - Timeout en ms
   * @returns {Promise<string>} Adresse du peripheral
   */
  async scan(timeout = 10000) {
    const peripheral = await this.ble.scan(timeout);
    // Sur macOS, l'adresse peut être vide, utiliser uuid comme fallback
    return peripheral.address || peripheral.uuid || peripheral.id;
  }

  /**
   * Se connecter au Control Unit
   * @param {string} address - Adresse du peripheral (optionnel)
   */
  async connect(address = null) {
    await this.ble.connect(address);
  }

  /**
   * Se déconnecter du Control Unit
   */
  async disconnect() {
    await this.ble.disconnect();
    this.connected = false;
  }

  /**
   * Gérer les données reçues
   * @param {Buffer} data - Données reçues
   */
  handleData(data) {
    console.log('📨 CU Data received:', data.toString('hex'), '| ASCII:', data.toString('ascii').replace(/[^\x20-\x7E]/g, '.'));

    // Si on attend une réponse spécifique
    if (this.waitingForResponse) {
      const { expectedPrefix, resolve } = this.waitingForResponse;

      // Vérifier si c'est la réponse attendue
      if (data[0] === expectedPrefix) {
        this.waitingForResponse = null;
        resolve(data);
        return;
      }
    }

    // Sinon, ajouter à la queue ou traiter comme événement
    this.processMessage(data);
  }

  /**
   * Traiter un message du Control Unit
   * @param {Buffer} data - Message reçu
   */
  processMessage(data) {
    try {
      // Timer event (voiture passe sur la ligne)
      if (data[0] === 0x3F) { // '?'
        if (data[1] === 0x3A) { // '?:'
          // Status message
          const status = this.parseStatus(data);
          this.emit('status', status);
        } else {
          // Timer event
          const timer = this.parseTimer(data);
          this.emit('timer', timer);
        }
      }
    } catch (error) {
      this.emit('error', error);
    }
  }

  /**
   * Parser un événement Timer
   * @param {Buffer} data - Données brutes
   * @returns {Object} Timer event
   */
  parseTimer(data) {
    // Format: "xYIYC" => skip 1 byte, address (4 bits), timestamp (32 bits), sector (4 bits), checksum
    const [address, timestamp, sector] = protocol.unpack('xYIYC', data);

    return {
      controller: address - 1, // 0-indexed
      timestamp,
      sector,
    };
  }

  /**
   * Parser un Status
   * @param {Buffer} data - Données brutes
   * @returns {Object} Status
   */
  parseStatus(data) {
    try {
      // Format: "2x8YYYBYC"
      const parts = protocol.unpack('2x8YYYBYC', data);
      const fuel = parts.slice(0, 8);
      const [start, mode, pitmask, display] = parts.slice(8);

      // Convertir le pitmask en tableau de booléens
      const pit = [];
      for (let i = 0; i < 8; i++) {
        pit.push((pitmask & (1 << i)) !== 0);
      }

      return {
        fuel,
        start,
        mode,
        pit,
        display,
      };
    } catch (error) {
      // Essayer le format alternatif
      const parts = protocol.unpack('2x8YYYBYxxC', data);
      const fuel = parts.slice(0, 8);
      const [start, mode, pitmask, display] = parts.slice(8);

      const pit = [];
      for (let i = 0; i < 8; i++) {
        pit.push((pitmask & (1 << i)) !== 0);
      }

      return {
        fuel,
        start,
        mode,
        pit,
        display,
      };
    }
  }

  /**
   * Envoyer une requête et attendre une réponse
   * @param {Buffer} buffer - Données à envoyer
   * @param {number} timeout - Timeout en ms
   * @returns {Promise<Buffer>} Réponse reçue
   */
  async request(buffer, timeout = 5000) {
    if (!this.connected) {
      throw new Error('Not connected to Control Unit');
    }

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.waitingForResponse = null;
        reject(new Error('Request timeout'));
      }, timeout);

      this.waitingForResponse = {
        expectedPrefix: buffer[0],
        resolve: (data) => {
          clearTimeout(timeoutId);
          resolve(data);
        },
      };

      this.ble.send(buffer).catch(reject);
    });
  }

  /**
   * Polling pour récupérer les événements en attente
   * @returns {Promise<Object>} Status ou Timer
   */
  async poll() {
    // Le protocole Carrera exige que les messages se terminent par '$'
    const response = await this.request(Buffer.from('?$'));
    return this.processMessage(response);
  }

  /**
   * Récupérer la version du Control Unit
   * @returns {Promise<string>} Version
   */
  async version() {
    // Le protocole Carrera exige que les messages se terminent par '$'
    const response = await this.request(Buffer.from('0$'));
    const [version] = protocol.unpack('x4sC', response);
    return version.toString('ascii');
  }

  /**
   * Récupérer toutes les infos du Control Unit
   * @returns {Promise<Object>} Infos complètes
   */
  async getInfo() {
    try {
      const version = await this.version();
      const status = await this.poll();

      // Extraire les bits du mode si c'est un status
      let info = {
        version,
        fuelMode: false,
        realMode: false,
        pitLane: false,
        lapCounter: false,
        numCars: 6,
      };

      if (status && status.type === 'status') {
        const mode = status.mode || 0;
        info.fuelMode = (mode & ControlUnit.FUEL_MODE) !== 0;
        info.realMode = (mode & ControlUnit.REAL_MODE) !== 0;
        info.pitLane = (mode & ControlUnit.PIT_LANE_MODE) !== 0;
        info.lapCounter = (mode & ControlUnit.LAP_COUNTER_MODE) !== 0;
        info.numCars = status.display || 6;
      }

      return info;
    } catch (error) {
      console.error('Erreur lors de la récupération des infos CU:', error);
      return {
        version: null,
        fuelMode: false,
        realMode: false,
        pitLane: false,
        lapCounter: false,
        numCars: 6,
      };
    }
  }

  /**
   * Simuler l'appui sur un bouton du Control Unit
   * @param {number} buttonId - ID du bouton
   * Fire-and-forget: n'attend pas de réponse pour éviter les conflits avec le polling
   */
  async press(buttonId) {
    const buffer = protocol.pack('cYC', Buffer.from('T'), buttonId);
    // Ajouter le terminateur '$'
    const message = Buffer.concat([buffer, Buffer.from('$')]);
    await this.ble.send(message);
    return { success: true, buttonId };
  }

  /**
   * Démarrer la séquence de départ
   */
  async start() {
    return this.press(ControlUnit.START_ENTER_BUTTON_ID);
  }

  /**
   * Réinitialiser le timer
   * Fire-and-forget pour éviter les conflits avec le polling
   */
  async reset() {
    const buffer = protocol.pack('cYYC', Buffer.from('='), 1, 0);
    const message = Buffer.concat([buffer, Buffer.from('$')]);
    await this.ble.send(message);
    return { success: true };
  }

  /**
   * Définir un mot de commande
   * Fire-and-forget pour éviter les conflits avec le polling
   * @param {number} word - Mot de commande (0-31)
   * @param {number} address - Adresse du contrôleur (0-7)
   * @param {number} value - Valeur (0-15)
   * @param {number} repeat - Nombre de répétitions (1-15)
   */
  async setword(word, address, value, repeat = 1) {
    if (word < 0 || word > 31) {
      throw new Error('Command word out of range');
    }
    if (address < 0 || address > 7) {
      throw new Error('Address out of range');
    }
    if (value < 0 || value > 15) {
      throw new Error('Value out of range');
    }
    if (repeat < 1 || repeat > 15) {
      throw new Error('Repeat count out of range');
    }

    const buffer = protocol.pack(
      'cBYYC',
      Buffer.from('J'),
      word | (address << 5),
      value,
      repeat
    );
    const message = Buffer.concat([buffer, Buffer.from('$')]);
    console.log(`🎮 setword: word=${word}, addr=${address}, val=${value}, repeat=${repeat}, msg=${message.toString('hex')}`);
    await this.ble.send(message);
    return { success: true };
  }

  /**
   * Définir la vitesse d'un contrôleur
   * @param {number} address - Adresse du contrôleur (0-7)
   * @param {number} value - Valeur de vitesse (0-15)
   */
  async setSpeed(address, value) {
    return this.setword(0, address, value, 2);
  }

  /**
   * Définir le frein d'un contrôleur
   * @param {number} address - Adresse du contrôleur (0-7)
   * @param {number} value - Valeur de frein (0-15)
   */
  async setBrake(address, value) {
    return this.setword(1, address, value, 2);
  }

  /**
   * Définir le carburant d'un contrôleur
   * @param {number} address - Adresse du contrôleur (0-7)
   * @param {number} value - Valeur de carburant (0-15)
   */
  async setFuel(address, value) {
    return this.setword(2, address, value, 2);
  }

  /**
   * Définir la position d'un contrôleur sur la Position Tower
   * @param {number} address - Adresse du contrôleur (0-7)
   * @param {number} position - Position (1-8)
   */
  async setPosition(address, position) {
    if (position < 1 || position > 8) {
      throw new Error('Position out of range');
    }
    return this.setword(6, address, position);
  }

  /**
   * Effacer l'affichage de la Position Tower
   */
  async clearPosition() {
    return this.setword(6, 0, 9);
  }

  /**
   * Ignorer certains contrôleurs
   * Fire-and-forget pour éviter les conflits avec le polling
   * @param {number} mask - Masque de bits des contrôleurs à ignorer
   */
  async ignore(mask) {
    const buffer = protocol.pack('cBC', Buffer.from(':'), mask);
    const message = Buffer.concat([buffer, Buffer.from('$')]);
    await this.ble.send(message);
    return { success: true };
  }

  /**
   * État de la connexion
   * @returns {boolean} Connecté ou non
   */
  isConnected() {
    return this.connected;
  }
}

export default ControlUnit;
