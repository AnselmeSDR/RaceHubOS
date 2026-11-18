// Protocol port: tkem/carreralib (MIT) and CarlosMagni/flatout (MIT).
// GB + 2s, then F/raw-length/18-byte blocks and E/checksum per HMF line.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { decode, APP_END } from './lib/cuFirmwareCodec.mjs';
import { pack } from './protocol.js';

const known = JSON.parse(await fs.readFile(new URL('./lib/cuFirmwareKnown.json', import.meta.url), 'utf8')).images;
const hash = (data) => createHash('sha256').update(data).digest('hex');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const defaultDirectory = fileURLToPath(new URL('../../data/cu-firmware/', import.meta.url));
const TERMINAL = ['idle', 'complete', 'preflight_failed'];

export function inspectFirmware(text) {
  const { image, used, records } = decode(text);
  // The bootloader expects a complete application, not a patch or partial HEX.
  if (used.size !== APP_END) throw new Error('Für das Flashen ist ein vollständiges Image 0x0000–0x37ff erforderlich');
  const lines = text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.slice(1, -1));
  if (lines.some((s) => s.length > 256)) throw new Error('HMF-Zeile zu lang (max. 256 Zeichen)');
  // Application pages must be in ascending order. Never silently normalize an upload.
  let end = 0;
  for (const rec of records.filter((r) => r[3] === 0)) {
    const address = (rec[1] << 8) | rec[2];
    if (address !== end) throw new Error('HMF-Datensätze müssen aufsteigend und lückenlos sein');
    end += rec[0];
  }
  const sha256 = hash(text),
    binSha256 = hash(Buffer.concat([image, Buffer.alloc(0x800, 255)]));
  const identified = known.find((i) => i.sha256 === sha256 || i.bin_sha256 === binSha256);
  if (identified?.status === 'defective') throw new Error('Bekannte defekte Firmware gesperrt: ' + identified.tag);
  // Also catch newline, case and whitespace changes to known defective files.
  const canonical = lines.map((s) => '"' + s.toUpperCase() + '"').join('\r\n') + '\r\n';
  const blocked = known.find((i) => i.status === 'defective' && i.sha256 === hash(canonical));
  if (blocked) throw new Error('Bekannte defekte Firmware gesperrt: ' + blocked.tag);
  return {
    text,
    lines,
    info: {
      sha256,
      binSha256,
      bytes: used.size,
      lines: lines.length,
      tag: identified?.tag || null,
      status: identified?.status || 'unknown',
      expectedVersion: identified ? '5339' : null,
      readbackSupported: false,
      expectedBotModule: identified ? Boolean(identified.bots) : null,
    },
  };
}

export class CuFirmwareService {
  constructor({
    cu,
    sync,
    recovery,
    session,
    io,
    directory = process.env.RACEHUBOS_CU_FIRMWARE_DIR || defaultDirectory,
    wait = sleep,
    verifyAttempts = 12,
    verifyDelay = 1000,
  }) {
    Object.assign(this, { cu, sync, recovery, session, io, directory, wait, verifyAttempts, verifyDelay });
    this.state = { stage: 'idle', done: 0, total: 0, recoveryRequired: false };
    this.running = false;
    this.token = null;
    this.ready = this.load();
  }
  get busy() {
    return this.running || this.state.recoveryRequired;
  }
  snapshot() {
    return { ...this.state, running: this.running };
  }
  async load() {
    try {
      const saved = JSON.parse(await fs.readFile(path.join(this.directory, 'journal.json'), 'utf8'));
      if (!saved || typeof saved.stage !== 'string') throw new Error('Invalid journal');
      this.state = saved;
      if (!TERMINAL.includes(saved.stage)) {
        this.state = {
          ...saved,
          stage: 'recovery_required',
          recoveryRequired: true,
          error: 'Vorheriger Flash-Vorgang wurde unterbrochen. Recovery mit vollständiger Firmware erforderlich.',
        };
        this.token = this.cu.acquireFirmwareLease();
        this.recovery.stop();
        this.sync.stopPolling();
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        this.state = {
          stage: 'recovery_required',
          recoveryRequired: true,
          error: 'Flash-Protokoll unlesbar: ' + error.message,
        };
        this.token = this.cu.acquireFirmwareLease();
        this.recovery.stop();
      }
    }
  }
  async publish(stage, changes = {}) {
    this.state = { ...this.state, ...changes, stage, updatedAt: new Date().toISOString() };
    await fs.mkdir(this.directory, { recursive: true });
    const target = path.join(this.directory, 'journal.json');
    const temporary = target + '.' + randomUUID();
    try {
      const handle = await fs.open(temporary, 'wx', 0o600);
      try {
        await handle.writeFile(JSON.stringify(this.state, null, 2));
        await handle.sync();
      } finally {
        await handle.close();
      }
      await fs.rename(temporary, target);
    } finally {
      await fs.rm(temporary, { force: true });
    }
    this.io?.emit('cu:firmware', this.snapshot());
  }
  async start({
    text,
    sha256,
    recovery = false,
    address,
    expectedVersion,
    allowUnknown = false,
    benchConfirmed = false,
    recoveryResetConfirmed = false,
    restartNormal = false,
    hardware5Confirmed = false,
  }) {
    await this.ready;
    if (this.running) throw new Error('Flash läuft bereits');
    if (typeof recovery !== 'boolean') throw new Error('Ungültiger Recovery-Modus');
    if (this.state.recoveryRequired && !recovery && restartNormal !== true)
      throw new Error('Recovery erforderlich oder normalen Neustart ausdrücklich wählen');
    if (recovery && hardware5Confirmed !== true)
      throw new Error('Recovery unterstützt nur bestätigte CU-Hardware 5 (AVR)');
    if (recovery && recoveryResetConfirmed !== true)
      throw new Error('Für Recovery den Bootloader nach dem Abbruch neu starten und bestätigen');
    if (this.recovery.pending || this.cu.ble.connecting) throw new Error('CU-Verbindungsaufbau läuft noch');
    if (this.session.isActive()) throw new Error('Aktive oder pausierte Sitzung zuerst beenden');
    if (benchConfirmed !== true) throw new Error('CU-Prüfaufbau ohne Fahrzeuge bestätigen');
    const image = inspectFirmware(text);
    if (image.info.sha256 !== sha256) throw new Error('Datei hat sich seit der Prüfung geändert');
    if (image.info.status === 'unknown' && allowUnknown !== true)
      throw new Error('Eigene/unbekannte Firmware ausdrücklich freigeben');
    const targetVersion = image.info.expectedVersion || expectedVersion;
    if (typeof targetVersion !== 'string' || !/^5\d{3}$/.test(targetVersion))
      throw new Error('Erwartete vierstellige CU-Version für Hardware 5 angeben');
    const destination = this.state.recoveryRequired
      ? this.state.address || address
      : address || this.cu.address || this.recovery.address;
    if (typeof destination !== 'string' || !destination || destination.length > 128)
      throw new Error('CU-Adresse auswählen');
    if (this.state.recoveryRequired && this.state.address && address && address !== this.state.address)
      throw new Error('Recovery muss dieselbe CU verwenden');
    if (
      !recovery &&
      !this.state.recoveryRequired &&
      (!this.cu.isConnected() ||
        (this.sync.getDevice() !== this.cu && !this.state.recoveryRequired) ||
        destination !== this.cu.address)
    )
      throw new Error('Für reguläres Flashen zuerst die ausgewählte reale CU verbinden');
    if (recovery && this.sync.getDevice() && this.sync.getDevice() !== this.cu)
      throw new Error('Simulator zuerst trennen');
    this.running = true;
    this.token ||= this.cu.acquireFirmwareLease();
    this.recovery.stop();
    this.sync.stopPolling();
    const job = {
      previouslyRequired: Boolean(this.state.recoveryRequired),
      id: randomUUID(),
      address: destination,
      image: image.info,
      expectedVersion: targetVersion,
      recovery,
    };
    // Own the connection synchronously before the first journal await.
    try {
      await this.publish('preparing', {
        ...job,
        done: 0,
        total: image.lines.length,
        recoveryRequired: recovery || job.previouslyRequired,
        error: null,
        verification: null,
      });
    } catch (error) {
      this.running = false;
      // If a previous recovery lock exists it must remain in force.
      if (!recovery && !job.previouslyRequired) {
        this.cu.releaseFirmwareLease(this.token);
        this.token = null;
      }
      throw error;
    }
    this.job = this.run(image, job).catch((error) => {
      // Persistence failure must still leave the in-memory CU lock in place.
      this.state = { ...this.state, stage: 'recovery_required', recoveryRequired: true, error: error.message };
      this.running = false;
      this.io?.emit('cu:firmware', this.snapshot());
    });
    return this.snapshot();
  }
  request(buffer) {
    return this.cu.request(buffer, 5000, this.token);
  }
  async probeBotModule(expected) {
    try {
      await this.request(Buffer.from('B0A'));
      if (!expected) throw new Error('Bot-Modul vorhanden, obwohl Stock-Firmware erwartet wird');
      return true;
    } catch (error) {
      if (!/CU rejected command/.test(error.message)) throw error;
      if (expected) throw new Error('Erwartetes Bot-Modul fehlt', { cause: error });
      return false;
    }
  }
  async run(image, job) {
    let entered = job.recovery || job.previouslyRequired;
    try {
      // Drain the pre-existing request; queued normal commands fail their lease check.
      await this.cu._requestTail;
      if (!this.cu.isConnected()) await this.cu.connect(job.address, this.token);
      if (!job.recovery) {
        const version = await this.cu.version(this.token);
        if (!/^5\d{3}$/.test(version)) throw new Error('Keine gültige CU-Versionsantwort');
        await this.publish('bootloader', { previousVersion: version, recoveryRequired: true });
        entered = true; // Even an ACK timeout can mean GB already reached the CU.
        await this.request(pack('ccC', Buffer.from('G'), Buffer.from('B')));
        await this.wait(2000);
      } else {
        // No GB, version probe or race handshake while already in the bootloader.
        await this.publish('writing', { recoveryRequired: true });
      }
      for (let i = 0; i < image.lines.length; i++) {
        const line = Buffer.from(image.lines[i], 'ascii');
        for (let offset = 0; offset < line.length; offset += 18) {
          const block = line.subarray(offset, offset + 18);
          await this.request(Buffer.concat([Buffer.from([0x46, block.length]), block]));
        }
        // Never retry F/E after timeout: the bootloader position is then ambiguous.
        await this.request(pack('cC', Buffer.from('E')));
        if (i % 16 === 0 || i === image.lines.length - 1)
          await this.publish('writing', { done: i + 1, recoveryRequired: true });
      }
      await this.publish('verifying');
      await this.wait(2000);
      let verification, lastError;
      for (let attempt = 0; attempt < this.verifyAttempts; attempt++) {
        try {
          if (!this.cu.isConnected()) await this.cu.connect(job.address, this.token);
          const version = await this.cu.version(this.token);
          if (version !== job.expectedVersion)
            throw new Error(`CU-Version ${version}, erwartet ${job.expectedVersion}`);
          let status;
          // Drain buffered timer events before requiring a valid status/checksum.
          for (let n = 0; n < 16; n++) {
            const data = await this.request(Buffer.from('?'));
            if (data[0] === 0x3f && data[1] === 0x3a) {
              if (![16, 18].includes(data.length) || !data.subarray(2).every((b) => b >= 0x30 && b <= 0x3f))
                throw new Error('Ungültiges CU-Statusformat');
              status = this.cu.parseStatus(data);
              break;
            }
          }
          if (!status) throw new Error('Keine gültigen CU-Statusdaten');
          verification = { version, statusReceived: true, readbackVerified: false };
          if (image.info.expectedBotModule !== null)
            verification.botModule = await this.probeBotModule(image.info.expectedBotModule);
          break;
        } catch (error) {
          lastError = error;
          await this.wait(this.verifyDelay);
        }
      }
      if (!verification) throw new Error('Abschlussprüfung fehlgeschlagen: ' + lastError?.message);
      await this.publish('complete', { verification, recoveryRequired: false, error: null });
      this.cu.releaseFirmwareLease(this.token);
      this.token = null;
      // Reattach without replaying any old profile/start commands.
      this.sync.setDevice(this.cu);
      this.recovery.enabled = true;
      this.recovery.address = job.address;
      this.recovery.lastStatusAt = Date.now();
      this.recovery.nextRetryAt = null;
      this.sync.startPolling();
    } catch (error) {
      await this.publish(entered ? 'recovery_required' : 'preflight_failed', {
        error: error.message,
        recoveryRequired: entered,
      });
      if (!entered) {
        this.cu.releaseFirmwareLease(this.token);
        this.token = null;
        // Keep polling stopped: explicit reconnect is available after a preflight error.
      }
    } finally {
      this.running = false;
    }
  }
}
