/**
 * Carrera Digital 132/124 Protocol Parser
 * Based on carreralib and OpenLap implementations
 */

// Service and Characteristic UUIDs
export const CARRERA_SERVICE_UUID = '39df7777-b1b4-b90b-57f1-7144ae4e4a6a';
export const CARRERA_WRITE_UUID = '39df8888-b1b4-b90b-57f1-7144ae4e4a6a';
export const CARRERA_READ_UUID = '39df9999-b1b4-b90b-57f1-7144ae4e4a6a';

/**
 * Convert ArrayBuffer to string for debugging
 */
export function bufferToString(buffer) {
  const array = new Uint8Array(buffer);
  return String.fromCharCode(...array);
}

/**
 * Parse a nibble-encoded value from buffer
 * Carrera uses ASCII nibbles (0x30-0x3f for 0-15)
 */
function parseNibble(value) {
  return value & 0x0f;
}

/**
 * Parse a 32-bit timestamp from 8 nibbles
 * Format: [n7, n6, n5, n4, n3, n2, n1, n0]
 * Where each nibble is 4 bits
 */
function parseTimestamp(buffer, offset) {
  let time = 0;
  for (let i = 0; i < 8; i++) {
    const nibble = parseNibble(buffer[offset + i]);
    time |= (nibble << (i * 4));
  }
  return time;
}

/**
 * Parse a timer event (lap/sector completion)
 * Format: '?' carId timestamp[8] sector
 */
export function parseTimerEvent(buffer) {
  const data = new Uint8Array(buffer);

  if (data.length < 11 || String.fromCharCode(data[0]) !== '?') {
    return null;
  }

  const carId = parseNibble(data[1]);
  const timestamp = parseTimestamp(data, 2);
  const sector = parseNibble(data[10]);

  return {
    type: 'timer',
    carId,
    timestamp,
    sector,
  };
}

/**
 * Parse a status event (fuel levels, pit lanes, etc.)
 * Format: '?' 10 fuel[8] startSeq mode pitMask[2] display
 */
export function parseStatusEvent(buffer) {
  const data = new Uint8Array(buffer);

  if (data.length < 14 || String.fromCharCode(data[0]) !== '?' || parseNibble(data[1]) !== 10) {
    return null;
  }

  const fuel = [];
  for (let i = 0; i < 8; i++) {
    fuel.push(parseNibble(data[2 + i]));
  }

  const startSequence = parseNibble(data[10]);
  const mode = parseNibble(data[11]);
  const pitMask1 = parseNibble(data[12]);
  const pitMask2 = parseNibble(data[13]);

  // Decode pit lane status from masks
  const pitLanes = [];
  for (let i = 0; i < 4; i++) {
    pitLanes.push(Boolean(pitMask1 & (1 << i)));
  }
  for (let i = 0; i < 4; i++) {
    pitLanes.push(Boolean(pitMask2 & (1 << i)));
  }

  return {
    type: 'status',
    fuel,
    startSequence,
    mode,
    pitLanes,
  };
}

/**
 * Parse any incoming message from Control Unit
 */
export function parseMessage(buffer) {
  const data = new Uint8Array(buffer);

  if (data.length === 0) {
    return null;
  }

  // Check message type by second byte
  if (data.length >= 2) {
    const messageType = parseNibble(data[1]);

    if (messageType === 10) {
      return parseStatusEvent(buffer);
    } else if (messageType >= 1 && messageType <= 8) {
      return parseTimerEvent(buffer);
    }
  }

  return null;
}

/**
 * Create a poll request
 * Sends '?' to request next event from Control Unit
 */
export function createPollRequest() {
  return new TextEncoder().encode('?');
}

/**
 * Create a version request
 * Sends '0' to request firmware version
 */
export function createVersionRequest() {
  return new TextEncoder().encode('0');
}

/**
 * Carrera Connection Manager
 * Handles Bluetooth connection and protocol communication
 */
export class CarreraConnection {
  constructor() {
    this.device = null;
    this.server = null;
    this.service = null;
    this.writeChar = null;
    this.readChar = null;
    this.pollInterval = null;
    this.onEvent = null;
  }

  async connect() {
    // Request device
    this.device = await navigator.bluetooth.requestDevice({
      filters: [{ name: 'Control_Unit' }],
      optionalServices: [CARRERA_SERVICE_UUID]
    });

    // Connect to GATT server
    this.server = await this.device.gatt.connect();

    // Get service
    this.service = await this.server.getPrimaryService(CARRERA_SERVICE_UUID);

    // Get characteristics
    this.writeChar = await this.service.getCharacteristic(CARRERA_WRITE_UUID);
    this.readChar = await this.service.getCharacteristic(CARRERA_READ_UUID);

    // Start notifications
    await this.readChar.startNotifications();
    this.readChar.addEventListener('characteristicvaluechanged', (event) => {
      const value = event.target.value;
      const message = parseMessage(value.buffer);
      if (message && this.onEvent) {
        this.onEvent(message);
      }
    });

    // Start polling (Control Unit uses request/response pattern)
    this.startPolling();

    return this.device;
  }

  startPolling() {
    // Poll every 100ms for new events
    this.pollInterval = setInterval(async () => {
      try {
        await this.writeChar.writeValue(createPollRequest());
      } catch (error) {
        console.error('Poll error:', error);
      }
    }, 100);
  }

  async disconnect() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    if (this.server && this.server.connected) {
      await this.server.disconnect();
    }

    this.device = null;
    this.server = null;
    this.service = null;
    this.writeChar = null;
    this.readChar = null;
  }

  isConnected() {
    return this.server && this.server.connected;
  }
}
