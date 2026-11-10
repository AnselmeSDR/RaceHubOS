/**
 * Protocole de communication Carrera Digital 124/132
 * Dérivé de carreralib (MIT, Thomas Kemmer) — voir THIRD_PARTY_NOTICES.md
 *
 * A format is a list of conversions, each optionally preceded by a count:
 * B byte (2 nibbles), I 32-bit integer (8 nibbles), Y nibble, c one-byte Buffer, r raw byte,
 * s string of `count` bytes, x padding / skip, C checksum.
 */

const ZERO = 0x30; // nibbles travel as '0' + value

/** Nibble order of a 32-bit integer on the wire. */
const INT_SHIFTS = [24, 28, 16, 20, 8, 12, 0, 4];

/** Low nibble of the byte sum of `buffer[offset .. offset + size)`. */
export function checksum(buffer, offset = 0, size = null) {
  const n = buffer.length;
  if (offset < 0) throw new Error('offset is negative');
  if (n < offset) throw new Error('buffer length < offset');
  if (size === null) size = n - offset;
  else if (size < 0) throw new Error('size is negative');
  else if (offset + size > n) throw new Error('buffer length < offset + size');

  let sum = 0;
  for (let i = offset; i < offset + size; i++) sum += buffer[i];
  return sum & 0x0f;
}

/** The `[count, conversion]` items of a format: '2xYC' → [2,'x'] [1,'Y'] [1,'C']. */
function* itemsOf(format) {
  let i = 0;
  while (i < format.length) {
    const digits = /^\d*/.exec(format.slice(i))[0];
    i += digits.length;
    yield [digits ? parseInt(digits, 10) : 1, format[i++]];
  }
}

const times = (count, fn) => {
  for (let j = 0; j < count; j++) fn();
};

const inRange = (conv, max) => (value) => {
  if (value < 0 || value > max) throw new Error(`'${conv}' format argument out of range`);
  return value;
};
const byte = inRange('B', 0xff);
const int = inRange('I', 0xffffffff);
const nibble = inRange('Y', 0x0f);
const raw = inRange('r', 0xff);

/** How each conversion writes `count` values taken with `next()` into `out`. */
const PACKERS = {
  B: (out, count, next) =>
    times(count, () => {
      const value = byte(next());
      out.push(ZERO + (value & 0x0f), ZERO + (value >> 4));
    }),
  I: (out, count, next) =>
    times(count, () => {
      const value = int(next());
      out.push(...INT_SHIFTS.map((shift) => ZERO + ((value >> shift) & 0x0f)));
    }),
  Y: (out, count, next) => times(count, () => out.push(ZERO + nibble(next()))),
  c: (out, count, next) =>
    times(count, () => {
      const value = next();
      if (!Buffer.isBuffer(value) || value.length !== 1) throw new Error("'c' format requires a Buffer of length 1");
      out.push(value[0]);
    }),
  r: (out, count, next) => times(count, () => out.push(raw(next()))),
  s: (out, count, next) => {
    const value = next();
    if (!Buffer.isBuffer(value)) throw new Error("'s' format requires a Buffer");
    for (let j = 0; j < count; j++) out.push(j < value.length ? value[j] : ZERO);
  },
  x: (out, count) => times(count, () => out.push(ZERO)),
  C: (out) => out.push(ZERO + checksum(Buffer.from(out))),
};

/** Encodes the arguments as the Control Unit reads them. */
export function pack(format, ...args) {
  const out = [];
  let index = 0;
  const next = () => args[index++];
  for (const [count, conv] of itemsOf(format)) {
    const packer = PACKERS[conv];
    if (!packer) throw new Error(`bad character in pack format: ${conv}`);
    packer(out, count, next);
  }
  return Buffer.from(out);
}

/** How each conversion reads `count` values of `buffer` at `offset`; returns the offset after them. */
const UNPACKERS = {
  B: (buffer, offset, count, out) => {
    times(count, () => {
      out.push((buffer[offset] & 0x0f) | ((buffer[offset + 1] & 0x0f) << 4));
      offset += 2;
    });
    return offset;
  },
  I: (buffer, offset, count, out) => {
    times(count, () => {
      const value = INT_SHIFTS.reduce((n, shift, k) => n | ((buffer[offset + k] & 0x0f) << shift), 0);
      out.push(value >>> 0);
      offset += 8;
    });
    return offset;
  },
  Y: (buffer, offset, count, out) => {
    times(count, () => out.push(buffer[offset++] & 0x0f));
    return offset;
  },
  c: (buffer, offset, count, out) => {
    times(count, () => out.push(buffer.subarray(offset, ++offset)));
    return offset;
  },
  r: (buffer, offset, count, out) => {
    times(count, () => out.push(buffer[offset++]));
    return offset;
  },
  s: (buffer, offset, count, out) => {
    out.push(buffer.subarray(offset, offset + count));
    return offset + count;
  },
  x: (buffer, offset, count) => offset + count,
  // The count is where the checksummed bytes start
  C: (buffer, offset, count) => {
    const expected = buffer[offset] & 0x0f;
    const actual = checksum(buffer, count, offset - count);
    if (expected !== actual) throw new Error(`Checksum error: expected ${expected}, got ${actual}`);
    return offset + 1;
  },
};

/** Decodes a message from the Control Unit. */
export function unpack(format, buffer) {
  const out = [];
  let offset = 0;
  for (const [count, conv] of itemsOf(format)) {
    const unpacker = UNPACKERS[conv];
    if (!unpacker) throw new Error(`bad character in unpack format: ${conv}`);
    offset = unpacker(buffer, offset, count, out);
  }
  return out;
}

export class ProtocolError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ProtocolError';
  }
}

export class ChecksumError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ChecksumError';
  }
}
