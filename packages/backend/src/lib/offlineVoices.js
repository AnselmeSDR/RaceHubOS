import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createRequire } from 'node:module';
import { x as extractTar } from 'tar';
import unbzip2 from 'unbzip2-stream';
import { getDatabasePath } from './database-url.js';

const require = createRequire(import.meta.url);
export const VOICE_MANIFEST = require('../data/offlineVoices.json');
export const offlineVoiceHome = () =>
  process.env.RACEHUBOS_OFFLINE_VOICES_DIR || path.join(path.dirname(getDatabasePath()), 'offline-voices');

export function runtimePackage(platform = process.platform, arch = process.arch) {
  const name = `sherpa-onnx-${platform === 'win32' ? 'win' : platform}-${arch}`;
  return VOICE_MANIFEST.runtime[name] ? name : null;
}

export function installedVoices(home, manifest = VOICE_MANIFEST) {
  try {
    const marker = JSON.parse(fs.readFileSync(path.join(home, 'installation.json'), 'utf8'));
    if (
      marker.application !== 'RaceHubOS offline voices' ||
      marker.engineVersion !== manifest.engineVersion ||
      marker.platform !== process.platform ||
      marker.arch !== process.arch
    )
      return [];
    if (
      !fs.existsSync(path.join(home, 'node_modules/sherpa-onnx-node/sherpa-onnx.js')) ||
      !fs.existsSync(path.join(home, 'node_modules', runtimePackage(), 'sherpa-onnx.node'))
    )
      return [];
    return manifest.voices
      .filter((voice) => {
        const model = path.join(home, 'models', `vits-piper-${voice.id}`);
        return [voice.id + '.onnx', 'tokens.txt', 'espeak-ng-data/phontab'].every((file) =>
          fs.existsSync(path.join(model, file))
        );
      })
      .map((voice) => ({ id: voice.id, name: voice.name, language: voice.language, locale: voice.locale, home }));
  } catch {
    return [];
  }
}

/** No network or directory creation happens until install() is explicitly called. */
export class OfflineVoices {
  constructor({
    home = offlineVoiceHome(),
    manifest = VOICE_MANIFEST,
    platform = process.platform,
    arch = process.arch,
    fetchFile = fetch,
    beforeChange = async () => {},
    extract = unpack,
  } = {}) {
    Object.assign(this, { home: path.resolve(home), manifest, platform, arch, fetchFile, beforeChange, extract });
    this.phase = 'idle';
    this.error = null;
    this.downloadedBytes = 0;
    this.operation = null;
  }
  plan() {
    const name = runtimePackage(this.platform, this.arch);
    if (!name) return null;
    return [
      { ...this.manifest.runtime['sherpa-onnx-node'], directory: 'node_modules/sherpa-onnx-node', compression: 'gzip' },
      { ...this.manifest.runtime[name], directory: `node_modules/${name}`, compression: 'gzip' },
      ...this.manifest.voices.map((voice) => ({ ...voice, directory: 'models', compression: 'bzip2' })),
    ];
  }
  status() {
    const plan = this.plan();
    const voices = installedVoices(this.home, this.manifest);
    let removable = false;
    try {
      removable =
        JSON.parse(fs.readFileSync(path.join(this.home, 'installation.json'), 'utf8')).application ===
        'RaceHubOS offline voices';
    } catch {
      /* Not managed. */
    }
    return {
      removable,
      supported: !!plan,
      phase: this.phase,
      error: this.error,
      installed: voices.length === this.manifest.voices.length,
      available: voices.length > 0,
      voices: voices.map(({ id, name, language, locale }) => ({ id, name, language, locale })),
      downloadBytes: plan?.reduce((sum, file) => sum + file.bytes, 0) || 0,
      downloadedBytes: this.downloadedBytes,
    };
  }
  managed() {
    if (!fs.existsSync(this.home)) return;
    const marker = JSON.parse(fs.readFileSync(path.join(this.home, 'installation.json'), 'utf8'));
    if (marker.application !== 'RaceHubOS offline voices') throw new Error('Unmanaged voice directory');
  }
  startInstall() {
    if (this.operation) return false;
    this.phase = 'installing';
    this.error = null;
    this.downloadedBytes = 0;
    this.operation = this.install()
      .catch(() => {
        this.error = 'installFailed';
      })
      .finally(() => {
        this.phase = 'idle';
        this.operation = null;
      });
    return true;
  }
  async install() {
    const plan = this.plan();
    if (!plan) throw new Error('Unsupported offline voice platform');
    this.managed();
    await fs.promises.mkdir(path.dirname(this.home), { recursive: true });
    const staging = await fs.promises.mkdtemp(this.home + '-install-');
    let backup;
    try {
      for (const [index, file] of plan.entries()) {
        const archive = path.join(staging, `${index}.archive`);
        await this.download(file, archive);
        const destination = path.join(staging, file.directory);
        await fs.promises.mkdir(destination, { recursive: true });
        await this.extract(archive, destination, file.compression);
        await fs.promises.rm(archive);
      }
      await fs.promises.writeFile(
        path.join(staging, 'installation.json'),
        JSON.stringify({
          application: 'RaceHubOS offline voices',
          engineVersion: this.manifest.engineVersion,
          platform: this.platform,
          arch: this.arch,
          archives: plan.map(({ url, sha256, integrity }) => ({ url, sha256, integrity })),
        })
      );
      if (installedVoices(staging, this.manifest).length !== this.manifest.voices.length)
        throw new Error('Incomplete offline voice installation');
      await this.beforeChange();
      if (fs.existsSync(this.home)) {
        backup = this.home + '-previous-' + randomUUID();
        await fs.promises.rename(this.home, backup);
      }
      try {
        await fs.promises.rename(staging, this.home);
      } catch (error) {
        if (backup) await fs.promises.rename(backup, this.home);
        throw error;
      }
      if (backup) await fs.promises.rm(backup, { recursive: true, force: true });
    } finally {
      await fs.promises.rm(staging, { recursive: true, force: true });
    }
  }
  async download(file, target) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10 * 60 * 1000);
    try {
      const response = await this.fetchFile(file.url, { signal: controller.signal });
      if (!response.ok || !response.body) throw new Error('Offline voice download failed');
      const hash = createHash(file.sha256 ? 'sha256' : 'sha512');
      let size = 0;
      const meter = new Transform({
        transform: (chunk, encoding, done) => {
          size += chunk.length;
          this.downloadedBytes += chunk.length;
          if (size > file.bytes) return done(new Error('Unexpected archive size'));
          hash.update(chunk);
          done(null, chunk);
        },
      });
      await pipeline(Readable.fromWeb(response.body), meter, fs.createWriteStream(target));
      const actual = file.sha256 ? hash.digest('hex') : 'sha512-' + hash.digest('base64');
      if (size !== file.bytes || actual !== (file.sha256 || file.integrity))
        throw new Error('Offline voice checksum mismatch');
    } finally {
      clearTimeout(timer);
    }
  }
  async remove() {
    if (this.operation) return false;
    this.phase = 'removing';
    this.error = null;
    this.operation = (async () => {
      this.managed();
      await this.beforeChange();
      await fs.promises.rm(this.home, { recursive: true, force: true });
    })().finally(() => {
      this.operation = null;
      this.phase = 'idle';
    });
    try {
      await this.operation;
      return true;
    } catch {
      this.error = 'removeFailed';
      throw new Error('Failed to remove offline voices');
    }
  }
}

async function unpack(archive, destination, compression) {
  let unsafe = false;
  const extractor = extractTar({
    cwd: destination,
    strip: compression === 'gzip' ? 1 : 0,
    strict: true,
    filter: (name, entry) => {
      if (
        !['File', 'Directory'].includes(entry.type) ||
        name.includes('\\') ||
        name.split('/').includes('..') ||
        path.posix.isAbsolute(name)
      ) {
        unsafe = true;
        return false;
      }
      return true;
    },
  });
  if (compression === 'bzip2') await pipeline(fs.createReadStream(archive), unbzip2(), extractor);
  else await pipeline(fs.createReadStream(archive), extractor);
  if (unsafe) throw new Error('Unsafe voice archive entry');
}
