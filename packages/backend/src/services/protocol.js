/**
 * Protocole de communication Carrera Digital 124/132
 * Inspiré de carreralib Python
 */

/**
 * Calculer le checksum du protocole Carrera
 * @param {Buffer} buffer - Buffer à vérifier
 * @param {number} offset - Décalage de départ
 * @param {number} size - Taille à vérifier
 * @returns {number} Checksum (4 bits)
 */
export function checksum(buffer, offset = 0, size = null) {
  const n = buffer.length;

  if (offset < 0) throw new Error('offset is negative');
  if (n < offset) throw new Error('buffer length < offset');

  if (size === null) {
    size = n - offset;
  } else if (size < 0) {
    throw new Error('size is negative');
  } else if (offset + size > n) {
    throw new Error('buffer length < offset + size');
  }

  let sum = 0;
  for (let i = offset; i < offset + size; i++) {
    sum += buffer[i];
  }

  return sum & 0x0F;
}

/**
 * Encoder des données selon le format Carrera
 * @param {string} format - Format d'encodage
 * @param {...any} args - Arguments à encoder
 * @returns {Buffer} Buffer encodé
 */
export function pack(format, ...args) {
  const buffer = [];
  let argIndex = 0;
  const base = 0x30; // '0' en ASCII

  let i = 0;
  while (i < format.length) {
    let count = 1;

    // Lire le nombre si présent
    if (/\d/.test(format[i])) {
      let numStr = '';
      while (i < format.length && /\d/.test(format[i])) {
        numStr += format[i];
        i++;
      }
      count = parseInt(numStr);
    }

    const conv = format[i];
    i++;

    switch (conv) {
      case 'B': // Byte (8 bits) -> 2 nibbles encodés
        for (let j = 0; j < count; j++) {
          const val = args[argIndex++];
          if (val < 0 || val > 0xFF) {
            throw new Error("'B' format argument out of range");
          }
          buffer.push(base + (val & 0x0F));
          buffer.push(base + (val >> 4));
        }
        break;

      case 'I': // Integer 32 bits -> 8 nibbles encodés
        for (let j = 0; j < count; j++) {
          const val = args[argIndex++];
          if (val < 0 || val > 0xFFFFFFFF) {
            throw new Error("'I' format argument out of range");
          }
          buffer.push(base + ((val >> 24) & 0x0F));
          buffer.push(base + ((val >> 28) & 0x0F));
          buffer.push(base + ((val >> 16) & 0x0F));
          buffer.push(base + ((val >> 20) & 0x0F));
          buffer.push(base + ((val >> 8) & 0x0F));
          buffer.push(base + ((val >> 12) & 0x0F));
          buffer.push(base + ((val >> 0) & 0x0F));
          buffer.push(base + ((val >> 4) & 0x0F));
        }
        break;

      case 'Y': // Nibble (4 bits)
        for (let j = 0; j < count; j++) {
          const val = args[argIndex++];
          if (val < 0 || val > 0x0F) {
            throw new Error("'Y' format argument out of range");
          }
          buffer.push(base + val);
        }
        break;

      case 'c': // Caractère brut
        for (let j = 0; j < count; j++) {
          const val = args[argIndex++];
          if (!Buffer.isBuffer(val) || val.length !== 1) {
            throw new Error("'c' format requires a Buffer of length 1");
          }
          buffer.push(val[0]);
        }
        break;

      case 'r': // Raw byte
        for (let j = 0; j < count; j++) {
          const val = args[argIndex++];
          if (val < 0 || val > 0xFF) {
            throw new Error("'r' format argument out of range");
          }
          buffer.push(val);
        }
        break;

      case 's': // String
        {
          const str = args[argIndex++];
          if (!Buffer.isBuffer(str)) {
            throw new Error("'s' format requires a Buffer");
          }
          for (let j = 0; j < count && j < str.length; j++) {
            buffer.push(str[j]);
          }
          // Padding avec '0'
          for (let j = str.length; j < count; j++) {
            buffer.push(base);
          }
        }
        break;

      case 'x': // Padding
        for (let j = 0; j < count; j++) {
          buffer.push(base);
        }
        break;

      case 'C': // Checksum
        {
          const chk = checksum(Buffer.from(buffer), 0, buffer.length);
          buffer.push(base + chk);
        }
        break;

      default:
        throw new Error(`bad character in pack format: ${conv}`);
    }
  }

  return Buffer.from(buffer);
}

/**
 * Décoder des données selon le format Carrera
 * @param {string} format - Format de décodage
 * @param {Buffer} buffer - Buffer à décoder
 * @returns {Array} Tableau de valeurs décodées
 */
export function unpack(format, buffer) {
  const result = [];
  let offset = 0;

  let i = 0;
  while (i < format.length) {
    let count = 1;

    // Lire le nombre si présent
    if (/\d/.test(format[i])) {
      let numStr = '';
      while (i < format.length && /\d/.test(format[i])) {
        numStr += format[i];
        i++;
      }
      count = parseInt(numStr);
    }

    const conv = format[i];
    i++;

    switch (conv) {
      case 'B': // Byte (8 bits) <- 2 nibbles
        for (let j = 0; j < count; j++) {
          let b = buffer[offset] & 0x0F;
          b |= (buffer[offset + 1] & 0x0F) << 4;
          result.push(b);
          offset += 2;
        }
        break;

      case 'I': // Integer 32 bits <- 8 nibbles
        for (let j = 0; j < count; j++) {
          let n = (buffer[offset + 0] & 0x0F) << 24;
          n |= (buffer[offset + 1] & 0x0F) << 28;
          n |= (buffer[offset + 2] & 0x0F) << 16;
          n |= (buffer[offset + 3] & 0x0F) << 20;
          n |= (buffer[offset + 4] & 0x0F) << 8;
          n |= (buffer[offset + 5] & 0x0F) << 12;
          n |= (buffer[offset + 6] & 0x0F) << 0;
          n |= (buffer[offset + 7] & 0x0F) << 4;
          result.push(n >>> 0); // Unsigned
          offset += 8;
        }
        break;

      case 'Y': // Nibble (4 bits)
        for (let j = 0; j < count; j++) {
          result.push(buffer[offset] & 0x0F);
          offset++;
        }
        break;

      case 'c': // Caractère brut
        for (let j = 0; j < count; j++) {
          result.push(buffer.slice(offset, offset + 1));
          offset++;
        }
        break;

      case 'r': // Raw byte
        for (let j = 0; j < count; j++) {
          result.push(buffer[offset]);
          offset++;
        }
        break;

      case 's': // String
        result.push(buffer.slice(offset, offset + count));
        offset += count;
        break;

      case 'x': // Skip
        offset += count;
        break;

      case 'C': // Checksum
        {
          const expectedChk = buffer[offset] & 0x0F;
          const actualChk = checksum(buffer, count, offset - count);
          if (expectedChk !== actualChk) {
            throw new Error(`Checksum error: expected ${expectedChk}, got ${actualChk}`);
          }
          offset++;
        }
        break;

      default:
        throw new Error(`bad character in unpack format: ${conv}`);
    }
  }

  return result;
}

/**
 * Erreur de protocole
 */
export class ProtocolError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ProtocolError';
  }
}

/**
 * Erreur de checksum
 */
export class ChecksumError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ChecksumError';
  }
}
