import { checksum, pack, unpack, ProtocolError, ChecksumError } from '../services/protocol.js';

const ascii = (buffer) => buffer.toString('ascii');

describe('checksum', () => {
  test('the low nibble of the byte sum, over a slice', () => {
    expect(checksum(Buffer.from([0x0f, 0x02]))).toBe(0x01);
    expect(checksum(Buffer.from([0xff, 0x01, 0x03]), 1)).toBe(0x04);
    expect(checksum(Buffer.from([0x01, 0x02, 0x03]), 1, 1)).toBe(0x02);
    expect(checksum(Buffer.from([0x01]), 1)).toBe(0);
  });

  test('refuses a slice outside the buffer', () => {
    const buffer = Buffer.from([1, 2]);
    expect(() => checksum(buffer, -1)).toThrow('offset is negative');
    expect(() => checksum(buffer, 3)).toThrow('buffer length < offset');
    expect(() => checksum(buffer, 0, -1)).toThrow('size is negative');
    expect(() => checksum(buffer, 1, 2)).toThrow('buffer length < offset + size');
  });
});

describe('pack', () => {
  test('each conversion, as the Control Unit reads it', () => {
    expect(ascii(pack('cYC', Buffer.from('T'), 2))).toBe('T26');
    expect(ascii(pack('B', 0x5a))).toBe(':5');
    expect(ascii(pack('2B', 1, 0x10))).toBe('1001');
    expect(ascii(pack('I', 0x12345678))).toBe('21436587');
    expect(ascii(pack('I', 0xf0000000))).toBe('0?000000');
    expect(ascii(pack('2Y', 3, 15))).toBe('3?');
    expect([...pack('2r', 0x41, 0xff)]).toEqual([0x41, 0xff]);
    expect(ascii(pack('4s', Buffer.from('ab')))).toBe('ab00');
    expect(ascii(pack('2s', Buffer.from('abc')))).toBe('ab');
    expect(ascii(pack('3x'))).toBe('000');
    expect(ascii(pack('12x'))).toBe('0'.repeat(12));
  });

  test('refuses an argument out of range or of the wrong kind', () => {
    expect(() => pack('B', 256)).toThrow("'B' format argument out of range");
    expect(() => pack('B', -1)).toThrow("'B' format argument out of range");
    expect(() => pack('I', 2 ** 32)).toThrow("'I' format argument out of range");
    expect(() => pack('Y', 16)).toThrow("'Y' format argument out of range");
    expect(() => pack('r', 300)).toThrow("'r' format argument out of range");
    expect(() => pack('c', Buffer.from('ab'))).toThrow("'c' format requires a Buffer of length 1");
    expect(() => pack('c', 'a')).toThrow("'c' format requires a Buffer of length 1");
    expect(() => pack('s', 'ab')).toThrow("'s' format requires a Buffer");
    expect(() => pack('Q')).toThrow('bad character in pack format: Q');
  });
});

describe('unpack', () => {
  const withChecksum = (text) => {
    const body = Buffer.from(text);
    return Buffer.concat([body, Buffer.from([0x30 + checksum(body, 1)])]);
  };

  test('each conversion, back from what pack wrote', () => {
    expect(unpack('2B', pack('2B', 0x5a, 0x10))).toEqual([0x5a, 0x10]);
    expect(unpack('I', pack('I', 0xf2345678))).toEqual([0xf2345678]);
    expect(unpack('xY2Y', Buffer.from('?3?1'))).toEqual([3, 15, 1]);
    expect(unpack('2c', Buffer.from('ab'))).toEqual([Buffer.from('a'), Buffer.from('b')]);
    expect(unpack('2r', Buffer.from([7, 8]))).toEqual([7, 8]);
    expect(unpack('x4sC', withChecksum('05337'))).toEqual([Buffer.from('5337')]);
  });

  test('a timer and a status as the Control Unit sends them', () => {
    expect(unpack('xYIYC', withChecksum('?2214365871'))).toEqual([2, 0x12345678, 1]);
    expect(unpack('2x8YYYBYC', withChecksum('?:0123456793506'))).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 9, 3, 5, 6]);
  });

  test('refuses a wrong checksum or an unknown conversion', () => {
    expect(() => unpack('xYC', Buffer.from('?20'))).toThrow('Checksum error: expected 0, got 2');
    expect(() => unpack('Q', Buffer.from('a'))).toThrow('bad character in unpack format: Q');
  });
});

test('protocol errors carry their name', () => {
  expect(new ProtocolError('bad')).toMatchObject({ name: 'ProtocolError', message: 'bad' });
  expect(new ChecksumError('sum')).toMatchObject({ name: 'ChecksumError', message: 'sum' });
});
