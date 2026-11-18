import { test } from 'node:test';
import assert from 'node:assert/strict';
import EventEmitter from 'node:events';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ControlUnit } from '../overrides/packages/backend/src/services/controlUnit.js';
import { CuFirmwareService, inspectFirmware } from '../server/CuFirmwareService.js';
import { encode, decode, APP_END } from '../server/lib/cuFirmwareCodec.mjs';
import { pack, checksum } from '../server/protocol.js';

function record(address, data) {
  const body = [data.length, address >> 8, address & 255, 0, ...data];
  return [...body, -body.reduce((a, b) => a + b, 0) & 255];
}
const records = Array.from({ length: APP_END / 16 }, (_, i) =>
  record(
    i * 16,
    Array.from({ length: 16 }, (_, n) => (i + n) & 255)
  )
);
const text = encode([...records, [0, 0, 0, 1, 255]]);
const statusPacket = pack('cc8YYYBYC', Buffer.from('?'), Buffer.from(':'), ...Array(8).fill(15), 0, 1, 0, 6);
statusPacket[statusPacket.length - 1] = 0x30 + checksum(statusPacket, 1, statusPacket.length - 2);

// Independent bootloader model: validates raw length, packet size, checksums,
// completed line order and reconstructed image. ACKs exercise real CU request code.
class BootloaderBLE extends EventEmitter {
  constructor() {
    super();
    this.connected = false;
    this.bootloader = false;
    this.lines = [];
    this.partial = '';
    this.sent = [];
    this.version = '5339';
    this.failAt = -1;
    this.count = 0;
  }
  async connect() {
    this.connected = true;
    this.emit('ready');
  }
  async disconnect() {
    this.connected = false;
    this.emit('disconnect');
  }
  async send(packet) {
    this.sent.push(Buffer.from(packet));
    const cmd = String.fromCharCode(packet[0]);
    if (this.count++ === this.failAt) {
      this.connected = false;
      this.emit('disconnect');
      throw Error('test link lost');
    }
    let reply;
    if (cmd === 'G') {
      assert.deepEqual(packet, Buffer.from([0x47, 0x42, 0x39]));
      this.bootloader = true;
      this.lines = [];
      this.partial = '';
      reply = '?G';
    } else if (cmd === 'F') {
      assert.equal(this.bootloader, true);
      assert.ok(packet.length <= 20);
      assert.equal(packet[1], packet.length - 2);
      this.partial += packet.subarray(2).toString('ascii');
      reply = '?F';
    } else if (cmd === 'E') {
      assert.equal(this.bootloader, true);
      assert.equal(packet.length, 2);
      assert.equal(packet[1], 0x30 + checksum(packet.subarray(0, 1)));
      assert.ok(this.partial.length > 0);
      this.lines.push(this.partial);
      this.partial = '';
      reply = '?E';
      if (this.lines.length === records.length + 1) {
        assert.deepEqual(decode(this.lines.map((line) => '"' + line + '"').join('\r\n')).image, decode(text).image);
        this.bootloader = false;
      }
    } else if (cmd === '0') {
      if (this.bootloader) throw Error('bootloader has no version');
      reply = pack('c4sC', Buffer.from('0'), Buffer.from(this.version));
    } else if (cmd === '?') {
      if (this.bootloader) throw Error('bootloader has no status');
      reply = this.badStatus ? Buffer.from('?:invalid') : statusPacket;
    } else throw Error('unexpected command ' + cmd);
    queueMicrotask(() => this.emit('data', Buffer.isBuffer(reply) ? reply : Buffer.from(reply)));
  }
}
async function setup({ directory, offline = false, ...options } = {}) {
  directory ||= await fs.mkdtemp(path.join(os.tmpdir(), 'cu-fw-'));
  const ble = new BootloaderBLE(),
    cu = new ControlUnit({ ble });
  if (!offline) await cu.connect('test-cu');
  cu.on('error', () => {});
  const sync = {
    source: offline ? null : cu,
    polling: true,
    stopPolling() {
      this.polling = false;
    },
    startPolling() {
      this.polling = true;
    },
    setDevice(device) {
      this.source = device;
    },
    getDevice() {
      return this.source;
    },
  };
  const recovery = {
    enabled: true,
    address: 'test-cu',
    stop() {
      this.enabled = false;
    },
  };
  const session = { isActive: () => false };
  const service = new CuFirmwareService({
    cu,
    sync,
    recovery,
    session,
    directory,
    wait: async () => {},
    verifyAttempts: 2,
    ...options,
  });
  await service.ready;
  return {
    service,
    cu,
    ble,
    sync,
    recovery,
    session,
    directory,
    cleanup: () => fs.rm(directory, { recursive: true, force: true }),
  };
}
function args(extra = {}) {
  return {
    text,
    sha256: inspectFirmware(text).info.sha256,
    expectedVersion: '5339',
    allowUnknown: true,
    benchConfirmed: true,
    hardware5Confirmed: true,
    ...extra,
  };
}

test('normal BLE flash, all ACKs, boot/version/status verification and persisted success', async () => {
  const f = await setup();
  try {
    const state = await f.service.start(args());
    assert.equal(state.stage, 'preparing');
    assert.throws(() => f.cu.request(Buffer.from('?')), /maintenance/);
    await assert.rejects(() => f.cu.disconnect(), /maintenance/);
    await assert.rejects(() => f.service.start(args()), /bereits/);
    await f.service.job;
    assert.equal(f.service.state.stage, 'complete', f.service.state.error);
    assert.equal(f.service.state.done, 897);
    assert.equal(f.ble.lines.length, 897);
    assert.equal(f.sync.polling, true);
    assert.deepEqual(f.service.state.verification, { version: '5339', statusReceived: true, readbackVerified: false });
    assert.equal(f.cu._firmwareLease, null);
    assert.equal(JSON.parse(await fs.readFile(path.join(f.directory, 'journal.json'))).stage, 'complete');
  } finally {
    await f.cleanup();
  }
});

test('interruption does not retry blocks, persists recovery and blocks ordinary traffic across restart', async () => {
  const f = await setup();
  try {
    f.ble.failAt = 6;
    await f.service.start(args());
    await f.service.job;
    assert.equal(f.service.state.stage, 'recovery_required');
    assert.equal(f.sync.polling, false);
    assert.equal(f.ble.sent.length, 7);
    assert.throws(() => f.cu.request(Buffer.from('?')), /maintenance/);
    const restored = await setup({ directory: f.directory, offline: true });
    assert.equal(restored.service.state.recoveryRequired, true);
    assert.ok(restored.cu._firmwareLease);
    await assert.rejects(
      () => restored.service.start(args({ recovery: true, recoveryResetConfirmed: true, address: 'wrong-cu' })),
      /dieselbe/
    );
    // Hardware power cycle clears an incomplete line, leaving its bootloader ready.
    restored.ble.bootloader = true;
    await restored.service.start(args({ recovery: true, recoveryResetConfirmed: true }));
    await restored.service.job;
    assert.equal(restored.service.state.stage, 'complete', restored.service.state.error);
    assert.equal(restored.ble.sent[0][0], 0x46); // no GB, version or polling before data
  } finally {
    await f.cleanup();
  }
});

test('version mismatch and invalid status never report success; normal re-entry after recovery lock works', async () => {
  for (const badStatus of [false, true]) {
    const f = await setup();
    try {
      if (badStatus) f.ble.badStatus = true;
      else f.ble.version = '5338';
      await f.service.start(args());
      await f.service.job;
      assert.equal(f.service.state.stage, 'recovery_required');
      assert.equal(f.sync.polling, false);
      f.ble.version = '5339';
      f.ble.badStatus = false;
      await f.service.start(args({ restartNormal: true }));
      await f.service.job;
      assert.equal(f.service.state.stage, 'complete', f.service.state.error);
    } finally {
      await f.cleanup();
    }
  }
});

test('refuses partial/bootloader images, changed hashes, active sessions and unconfirmed recovery before writes', async () => {
  assert.throws(() => inspectFirmware(encode([records[0], [0, 0, 0, 1, 255]])), /vollständiges/);
  assert.throws(() => inspectFirmware(encode([record(0x3800, [0]), [0, 0, 0, 1, 255]])), /Bootloader/);
  const f = await setup();
  try {
    await assert.rejects(() => f.service.start(args({ sha256: 'a'.repeat(64) })), /geändert/);
    await assert.rejects(() => f.service.start(args({ allowUnknown: false })), /freigeben/);
    await assert.rejects(() => f.service.start(args({ benchConfirmed: false })), /bestätigen/);
    await assert.rejects(() => f.service.start(args({ recovery: true })), /neu starten/);
    f.session.isActive = () => true;
    await assert.rejects(() => f.service.start(args()), /Sitzung/);
    assert.equal(f.ble.sent.length, 0);
  } finally {
    await f.cleanup();
  }
});

test('negative ACKs fail immediately and queued normal commands cannot leak into maintenance', async () => {
  const f = await setup();
  try {
    f.ble.send = async () => {
      queueMicrotask(() => f.ble.emit('data', Buffer.from('#')));
    };
    await f.service.start(args());
    await f.service.job;
    assert.equal(f.service.state.stage, 'preflight_failed');
    assert.equal(f.cu._firmwareLease, null);
    const p = f.cu.request(Buffer.from('?'));
    const token = f.cu.acquireFirmwareLease();
    await assert.rejects(() => p, /maintenance|Not connected/);
    f.cu.releaseFirmwareLease(token);
    assert.throws(() => f.cu.request(Buffer.from('E5')), /exclusive/);
  } finally {
    await f.cleanup();
  }
});

test('corrupt journal prevents automatic normal operation', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'cu-fw-'));
  await fs.writeFile(path.join(directory, 'journal.json'), '{');
  const f = await setup({ directory, offline: true });
  try {
    assert.equal(f.service.state.recoveryRequired, true);
    assert.ok(f.cu._firmwareLease);
  } finally {
    await f.cleanup();
  }
});

test('lost ACK never resends an ambiguous block; hardware 8 never receives GB', async () => {
  const f = await setup();
  try {
    f.service.request = (buffer) => f.cu.request(buffer, 20, f.service.token);
    const send = f.ble.send.bind(f.ble);
    f.ble.send = async (buffer) => {
      if (buffer[0] === 0x46) {
        f.ble.sent.push(Buffer.from(buffer));
        return;
      }
      return send(buffer);
    };
    await f.service.start(args());
    await f.service.job;
    assert.equal(f.service.state.recoveryRequired, true);
    assert.equal(f.ble.sent.filter((b) => b[0] === 0x46).length, 1);
    assert.match(f.service.state.error, /timeout/);
  } finally {
    await f.cleanup();
  }
  const h = await setup();
  try {
    h.ble.version = '8339';
    await h.service.start(args());
    await h.service.job;
    assert.equal(h.service.state.stage, 'preflight_failed');
    assert.deepEqual(
      h.ble.sent.map((b) => b[0]),
      [0x30]
    );
  } finally {
    await h.cleanup();
  }
});

test('known-image module check distinguishes explicit stock rejection from missing ACK', async () => {
  const f = await setup();
  try {
    f.service.token = f.cu.acquireFirmwareLease();
    f.ble.send = async (buffer) => {
      assert.equal(buffer.toString(), 'B0A');
      queueMicrotask(() => f.ble.emit('data', Buffer.from('?B')));
    };
    assert.equal(await f.service.probeBotModule(true), true);
    await assert.rejects(() => f.service.probeBotModule(false), /Stock/);
    f.ble.send = async () => {
      queueMicrotask(() => f.ble.emit('data', Buffer.from('#')));
    };
    assert.equal(await f.service.probeBotModule(false), false);
    await assert.rejects(() => f.service.probeBotModule(true), /fehlt/);
    f.service.request = async () => {
      throw Error('Request timeout');
    };
    await assert.rejects(() => f.service.probeBotModule(false), /timeout/);
  } finally {
    await f.cleanup();
  }
});

test('real polling and automatic recovery owners stay stopped under the firmware lease', async () => {
  const { CuRecovery } = await import('../../carrera-local/source/packages/backend/src/services/CuRecovery.js');
  const { SyncService } = await import('../overrides/packages/backend/src/services/SyncService.js');
  const f = await setup();
  const sync = new SyncService(null);
  sync.setDevice(f.cu);
  const recovery = new CuRecovery(f.cu, sync, null);
  try {
    const token = f.cu.acquireFirmwareLease();
    sync.startPolling();
    assert.equal(sync._polling, false);
    recovery.enabled = true;
    recovery.nextRetryAt = 0;
    await recovery.check();
    assert.equal(f.ble.sent.length, 0);
    await assert.rejects(() => recovery.connect('test-cu'), /maintenance/);
    f.cu.releaseFirmwareLease(token);
  } finally {
    recovery.close();
    sync.close();
    await f.cleanup();
  }
});
