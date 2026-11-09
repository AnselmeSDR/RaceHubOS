import EventEmitter from 'events';
import { BLEService, addressOf } from './ble.js';
import * as protocol from './protocol.js';

/** A status message, then the variant with two more bytes before the checksum. */
const STATUS_FORMATS = ['2x8YYYBYC', '2x8YYYBYxxC'];

const NO_INFO = { version: null, fuelMode: false, realMode: false, pitLane: false, lapCounter: false, numCars: 6 };

function check(value, min, max, name) {
  if (value < min || value > max) throw new Error(`${name} out of range`);
}

/**
 * Interface vers le Control Unit Carrera Digital 124/132
 * Équivalent Node.js de carreralib.ControlUnit
 * Dérivé de carreralib (MIT, Thomas Kemmer) — voir THIRD_PARTY_NOTICES.md
 *
 * Events: connected, disconnected, error, reconnect-failed (from the Bluetooth link), timer
 * (a car crossing a sensor) and status.
 */
export class ControlUnit extends EventEmitter {
  static PACE_CAR_ESC_BUTTON_ID = 1;
  static START_ENTER_BUTTON_ID = 2;
  static SPEED_BUTTON_ID = 5;
  static BRAKE_BUTTON_ID = 6;
  static FUEL_BUTTON_ID = 7;
  static CODE_BUTTON_ID = 8;

  static FUEL_MODE = 0x1;
  static REAL_MODE = 0x2;
  static PIT_LANE_MODE = 0x4;
  static LAP_COUNTER_MODE = 0x8;

  constructor() {
    super();
    this.ble = new BLEService();
    this.waitingForResponse = null;
    this.connected = false;
    this._requestBusy = false;

    this.ble.on('ready', () => {
      this.connected = true;
      this.emit('connected');
    });
    this.ble.on('disconnect', () => {
      this.connected = false;
      this.emit('disconnected');
    });
    this.ble.on('data', (data) => this.handleData(data));
    for (const event of ['error', 'reconnect-failed']) {
      this.ble.on(event, (...args) => this.emit(event, ...args));
    }
  }

  /** Finds the Control Unit; its address (on macOS, its uuid). */
  async scan(timeout = 10000) {
    return addressOf(await this.ble.scan(timeout));
  }

  async connect(address = null) {
    await this.ble.connect(address);
    this.address = address || (this.ble.peripheral && addressOf(this.ble.peripheral)) || null;
  }

  async disconnect() {
    await this.ble.disconnect();
    this.connected = false;
  }

  /** The answer a request waits for, or else an event. */
  handleData(data) {
    console.log(
      '📨 CU Data received:',
      data.toString('hex'),
      '| ASCII:',
      data.toString('ascii').replace(/[^\x20-\x7E]/g, '.')
    );
    const waiting = this.waitingForResponse;
    if (waiting && waiting.expectedPrefix === data[0]) {
      this.waitingForResponse = null;
      return waiting.resolve(data);
    }
    this.processMessage(data);
  }

  /** Emits a `?` message as a status (`?:`) or a timer event, and returns it. */
  processMessage(data) {
    if (data[0] !== 0x3f) return undefined;
    try {
      const [event, message] = data[1] === 0x3a ? ['status', this.parseStatus(data)] : ['timer', this.parseTimer(data)];
      this.emit(event, message);
      return message;
    } catch (error) {
      this.emit('error', error);
    }
  }

  parseTimer(data) {
    const [address, timestamp, sector] = protocol.unpack('xYIYC', data);
    return { controller: address - 1, timestamp, sector };
  }

  parseStatus(data) {
    let parts;
    try {
      parts = protocol.unpack(STATUS_FORMATS[0], data);
    } catch {
      parts = protocol.unpack(STATUS_FORMATS[1], data);
    }
    const [start, mode, pitmask, display] = parts.slice(8);
    const pit = Array.from({ length: 8 }, (_, i) => (pitmask & (1 << i)) !== 0);
    return { fuel: parts.slice(0, 8), start, mode, pit, display };
  }

  /** Sends a request and waits for the answer starting with the same letter, one request at a time. */
  async request(buffer, timeout = 5000) {
    if (!this.connected) throw new Error('Not connected to Control Unit');
    while (this._requestBusy) await new Promise((r) => setTimeout(r, 10));

    this._requestBusy = true;
    try {
      return await new Promise((resolve, reject) => {
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
        this.ble.send(buffer).catch((err) => {
          clearTimeout(timeoutId);
          reject(err);
        });
      });
    } finally {
      this._requestBusy = false;
    }
  }

  /** Asks for the next pending message: a timer event, else the status. */
  async poll() {
    return this.processMessage(await this.request(Buffer.from('?')));
  }

  async version() {
    const [version] = protocol.unpack('x4sC', await this.request(Buffer.from('0')));
    return version.toString('ascii');
  }

  /** Version, and the modes when the poll answers with a status. */
  async getInfo() {
    try {
      const version = await this.version();
      const status = await this.poll();
      if (status?.mode === undefined) return { ...NO_INFO, version };
      return {
        version,
        fuelMode: (status.mode & ControlUnit.FUEL_MODE) !== 0,
        realMode: (status.mode & ControlUnit.REAL_MODE) !== 0,
        pitLane: (status.mode & ControlUnit.PIT_LANE_MODE) !== 0,
        lapCounter: (status.mode & ControlUnit.LAP_COUNTER_MODE) !== 0,
        numCars: status.display || 6,
      };
    } catch (error) {
      console.error('Erreur lors de la récupération des infos CU:', error);
      return { ...NO_INFO };
    }
  }

  async press(buttonId) {
    await this.request(protocol.pack('cYC', Buffer.from('T'), buttonId));
    return { success: true, buttonId };
  }

  start() {
    return this.press(ControlUnit.START_ENTER_BUTTON_ID);
  }

  /** Used by SyncService.pressButton. */
  pressButton(buttonId) {
    return this.press(buttonId);
  }

  pressEsc() {
    return this.press(ControlUnit.PACE_CAR_ESC_BUTTON_ID);
  }

  /** Resets the timer. */
  async reset() {
    await this.request(protocol.pack('cYYC', Buffer.from('='), 1, 0));
    return { success: true };
  }

  /**
   * Sets a command word (0-31) of a controller (0-7) to a value (0-15), sent `repeat` (1-15) times.
   */
  async setword(word, address, value, repeat = 1) {
    check(word, 0, 31, 'Command word');
    check(address, 0, 7, 'Address');
    check(value, 0, 15, 'Value');
    check(repeat, 1, 15, 'Repeat count');

    const buffer = protocol.pack('cBYYC', Buffer.from('J'), word | (address << 5), value, repeat);
    console.log(
      `🎮 setword: word=${word}, addr=${address}, val=${value}, repeat=${repeat}, msg=${buffer.toString('hex')}`
    );
    await this.request(buffer);
    return { success: true };
  }

  setSpeed(address, value) {
    return this.setword(0, address, value, 2);
  }

  setBrake(address, value) {
    return this.setword(1, address, value, 2);
  }

  setFuel(address, value) {
    return this.setword(2, address, value, 2);
  }

  /** Shows a controller at a position (1-8) on the Position Tower. */
  async setPosition(address, position) {
    check(position, 1, 8, 'Position');
    return this.setword(6, address, position);
  }

  clearPosition() {
    return this.setword(6, 0, 9);
  }

  /** Cuts the power of all six car slots. */
  async stopCars() {
    for (let address = 0; address < 6; address++) await this.setSpeed(address, 0);
    return { success: true };
  }

  /** Ignores the controllers of a bit mask. */
  async ignore(mask) {
    await this.request(protocol.pack('cBC', Buffer.from(':'), mask));
    return { success: true };
  }

  isConnected() {
    return this.connected;
  }
}

export default ControlUnit;
