import { jest } from '@jest/globals';
import { EventEmitter } from 'events';
import { checksum } from '../services/protocol.js';

/** The Bluetooth link: records what is sent, the test decides what comes back. */
class FakeBle extends EventEmitter {
  sent = [];
  peripheral = null;
  answer = (buffer) => buffer.subarray(0, 1); // the Control Unit echoes the command letter
  scan = jest.fn(async () => ({ address: '', uuid: 'cu-uuid' }));
  connect = jest.fn(async () => {
    this.peripheral = { id: 'cu-id' };
  });
  disconnect = jest.fn(async () => {});
  async send(buffer) {
    this.sent.push(buffer.toString('ascii'));
    const reply = this.answer(buffer);
    if (reply) setImmediate(() => this.emit('data', reply));
  }
}
jest.unstable_mockModule('../services/ble.js', () => ({
  BLEService: FakeBle,
  addressOf: (p) => p.address || p.uuid || p.id,
}));
const { ControlUnit } = await import('../services/controlUnit.js');

/** A Control Unit reply: the text, then its checksum (from the second byte). */
const reply = (text) => {
  const body = Buffer.from(text);
  return Buffer.concat([body, Buffer.from([0x30 + checksum(body, 1)])]);
};
const TIMER = reply('?2214365871'); // controller 2, 0x12345678 ms, sector 1
const STATUS = reply('?:0123456793506'); // fuel 0-7, start 9, mode 3, pits 1 and 3, display 6

let cu, ble;

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  cu = new ControlUnit();
  ble = cu.ble;
  ble.emit('ready');
});
afterEach(() => jest.restoreAllMocks());

describe('the Bluetooth link', () => {
  test('its events become the unit’s', () => {
    const events = [];
    for (const event of ['connected', 'disconnected', 'error', 'reconnect-failed']) {
      cu.on(event, (arg) => events.push(arg ? [event, arg.message] : [event]));
    }
    expect(cu.isConnected()).toBe(true);
    ble.emit('disconnect');
    expect(cu.isConnected()).toBe(false);
    ble.emit('ready');
    ble.emit('error', new Error('radio'));
    ble.emit('reconnect-failed');
    expect(events).toEqual([['disconnected'], ['connected'], ['error', 'radio'], ['reconnect-failed']]);
  });

  test('scan, connect and disconnect, the address falling back to the uuid or id', async () => {
    expect(await cu.scan(5)).toBe('cu-uuid');
    expect(ble.scan).toHaveBeenCalledWith(5);
    await cu.connect();
    expect(cu.address).toBe('cu-id');
    await cu.connect('AA:BB');
    expect(cu.address).toBe('AA:BB');
    ble.peripheral = null;
    ble.connect.mockResolvedValueOnce();
    await cu.connect();
    expect(cu.address).toBeNull();
    await cu.disconnect();
    expect(ble.disconnect).toHaveBeenCalled();
    expect(cu.isConnected()).toBe(false);
  });
});

describe('messages from the Control Unit', () => {
  test('a timer and a status become events', () => {
    const timers = [];
    const statuses = [];
    cu.on('timer', (t) => timers.push(t));
    cu.on('status', (s) => statuses.push(s));
    ble.emit('data', TIMER);
    ble.emit('data', STATUS);
    ble.emit('data', Buffer.from('T'));
    expect(timers).toEqual([{ controller: 1, timestamp: 0x12345678, sector: 1 }]);
    expect(statuses).toEqual([
      {
        fuel: [0, 1, 2, 3, 4, 5, 6, 7],
        start: 9,
        mode: 3,
        pit: [true, false, true, false, false, false, false, false],
        display: 6,
      },
    ]);
  });

  test('a status may carry two more bytes', () => {
    const statuses = [];
    cu.on('status', (s) => statuses.push(s));
    ble.emit('data', reply('?:777777770010000'));
    expect(statuses[0]).toMatchObject({ fuel: Array(8).fill(7), start: 0, mode: 0, display: 0 });
    expect(statuses[0].pit[0]).toBe(true);
  });

  test('a garbled message is an error', () => {
    const errors = [];
    cu.on('error', (e) => errors.push(e.message));
    ble.emit('data', Buffer.from('?:0123456793506699'));
    ble.emit('data', Buffer.from('?2214365870'));
    expect(errors).toHaveLength(2);
    expect(errors[1]).toMatch(/^Checksum error/);
  });
});

describe('requests', () => {
  test('refused while disconnected', async () => {
    ble.emit('disconnect');
    await expect(cu.press(2)).rejects.toThrow('Not connected to Control Unit');
  });

  test('the answer is the next message starting with the same letter; others stay events', async () => {
    const timers = [];
    cu.on('timer', (t) => timers.push(t));
    ble.answer = () => {
      setImmediate(() => ble.emit('data', TIMER));
      return reply('05337');
    };
    expect(await cu.version()).toBe('5337');
    expect(timers).toHaveLength(1);
  });

  test('one at a time, in turn', async () => {
    const order = [];
    ble.answer = (buffer) => {
      order.push(buffer.toString('ascii')[0]);
      return buffer.subarray(0, 1);
    };
    await Promise.all([cu.press(1), cu.reset(), cu.ignore(3)]);
    expect(order.sort()).toEqual([':', '=', 'T']);
  });

  test('a lost answer times out, a failed send rejects', async () => {
    ble.answer = () => null;
    await expect(cu.request(Buffer.from('?'), 20)).rejects.toThrow('Request timeout');
    ble.send = async () => {
      throw new Error('write failed');
    };
    await expect(cu.request(Buffer.from('?'))).rejects.toThrow('write failed');
  });
});

describe('commands', () => {
  test('buttons, reset and ignore', async () => {
    expect(await cu.press(7)).toEqual({ success: true, buttonId: 7 });
    await cu.start();
    await cu.pressButton(5);
    await cu.pressEsc();
    expect(await cu.reset()).toEqual({ success: true });
    expect(await cu.ignore(0x21)).toEqual({ success: true });
    expect(ble.sent).toEqual(['T7;', 'T26', 'T59', 'T15', '=10>', ':12=']);
  });

  test('controller settings go through command words', async () => {
    jest.spyOn(cu, 'setword');
    await cu.setSpeed(1, 8);
    await cu.setBrake(2, 9);
    await cu.setFuel(3, 10);
    await cu.setPosition(4, 1);
    await cu.clearPosition();
    expect(cu.setword.mock.calls).toEqual([
      [0, 1, 8, 2],
      [1, 2, 9, 2],
      [2, 3, 10, 2],
      [6, 4, 1],
      [6, 0, 9],
    ]);
    expect(ble.sent[0]).toBe('J02826');
  });

  test('stopping the cars sets every speed to zero', async () => {
    jest.spyOn(cu, 'setSpeed');
    expect(await cu.stopCars()).toEqual({ success: true });
    expect(cu.setSpeed.mock.calls).toEqual([0, 1, 2, 3, 4, 5].map((address) => [address, 0]));
  });

  test.each([
    [[32, 0, 0], 'Command word out of range'],
    [[0, 8, 0], 'Address out of range'],
    [[0, 0, 16], 'Value out of range'],
    [[0, 0, 0, 0], 'Repeat count out of range'],
    [[0, 0, 0, 16], 'Repeat count out of range'],
  ])('setword(%j) is refused', async (args, message) => {
    await expect(cu.setword(...args)).rejects.toThrow(message);
  });

  test('a position outside 1 to 8 is refused', async () => {
    await expect(cu.setPosition(0, 9)).rejects.toThrow('Position out of range');
  });
});

describe('device info', () => {
  test('the version and, from a status, the modes', async () => {
    ble.answer = (buffer) => (buffer[0] === 0x30 ? reply('05337') : STATUS);
    expect(await cu.getInfo()).toEqual({
      version: '5337',
      fuelMode: true,
      realMode: true,
      pitLane: false,
      lapCounter: false,
      numCars: 6,
    });
  });

  test('six cars when the status shows no display', async () => {
    ble.answer = (buffer) => (buffer[0] === 0x30 ? reply('05337') : reply('?:0000000000000'));
    expect(await cu.getInfo()).toMatchObject({ fuelMode: false, realMode: false, numCars: 6 });
  });

  test('defaults when the poll returns a timer', async () => {
    ble.answer = (buffer) => (buffer[0] === 0x30 ? reply('05337') : TIMER);
    expect(await cu.getInfo()).toMatchObject({ version: '5337', fuelMode: false, numCars: 6 });
  });

  test('nothing known when the unit does not answer', async () => {
    ble.emit('disconnect');
    expect(await cu.getInfo()).toEqual({
      version: null,
      fuelMode: false,
      realMode: false,
      pitLane: false,
      lapCounter: false,
      numCars: 6,
    });
  });
});
