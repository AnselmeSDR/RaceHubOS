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
    this.stage = 'idle';
    this.fileIndex = 0;
    this.verifiedFiles = 0;
    this.cancelled = false;
    this.installController = null;
  }
  plan(languages = this.manifest.voices.map((voice) => voice.language), onlyMissing = false) {
    const name = runtimePackage(this.platform, this.arch);
    if (!name) return null;
    const existing = installedVoices(this.home, this.manifest);
    const runtime = [
      { ...this.manifest.runtime['sherpa-onnx-node'], directory: 'node_modules/sherpa-onnx-node', compression: 'gzip' },
      { ...this.manifest.runtime[name], directory: `node_modules/${name}`, compression: 'gzip' },
    ];
    return [
      ...(onlyMissing && existing.length ? [] : runtime),
      ...this.manifest.voices
        .filter(
          (voice) =>
            languages.includes(voice.language) && (!onlyMissing || !existing.some((item) => item.id === voice.id))
        )
        .map((voice) => ({ ...voice, directory: 'models', compression: 'bzip2' })),
    ];
  }
  status(languages) {
    const plan = this.activePlan || this.plan(languages, !!languages);
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
      stage: this.stage,
      fileIndex: this.fileIndex,
      fileCount: plan?.length || 0,
      verifiedFiles: this.verifiedFiles,
      cancelled: this.cancelled,
      error: this.error,
      installed: (languages || this.manifest.voices.map((voice) => voice.language)).every((language) =>
        voices.some((voice) => voice.language === language)
      ),
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
  startInstall(languages, { onlyMissing = false } = {}) {
    if (this.operation) return false;
    const plan = this.plan(languages, onlyMissing);
    if (!plan || !plan.length) return false;
    this.activePlan = plan;
    this.phase = 'installing';
    this.stage = 'preparing';
    this.error = null;
    this.downloadedBytes = 0;
    this.fileIndex = 0;
    this.verifiedFiles = 0;
    this.cancelled = false;
    this.installController = new AbortController();
    this.operation = this.install(languages, { plan })
      .catch(() => {
        if (!this.cancelled) this.error = 'installFailed';
      })
      .finally(() => {
        this.phase = 'idle';
        this.stage = 'idle';
        this.installController = null;
        this.activePlan = null;
        this.operation = null;
      });
    return true;
  }
  cancelInstall() {
    if (this.phase !== 'installing' || !this.operation || this.stage === 'publishing') return false;
    this.cancelled = true;
    this.stage = 'cancelling';
    this.installController.abort();
    return true;
  }
  async install(languages = this.manifest.voices.map((voice) => voice.language), { plan: selectedPlan } = {}) {
    const plan = selectedPlan || this.plan(languages);
    const previousVoices = installedVoices(this.home, this.manifest);
    const previousArchives = previousVoices.length
      ? JSON.parse(fs.readFileSync(path.join(this.home, 'installation.json'), 'utf8')).archives || []
      : [];
    if (!plan) throw new Error('Unsupported offline voice platform');
    this.managed();
    await fs.promises.mkdir(path.dirname(this.home), { recursive: true });
    const staging = await fs.promises.mkdtemp(this.home + '-install-');
    let backup;
    try {
      if (previousVoices.length) await fs.promises.cp(this.home, staging, { recursive: true });
      for (const [index, file] of plan.entries()) {
        this.installController?.signal.throwIfAborted();
        this.fileIndex = index + 1;
        this.stage = 'downloading';
        const archive = path.join(staging, `${index}.archive`);
        await this.download(file, archive);
        this.installController?.signal.throwIfAborted();
        this.stage = 'extracting';
        const destination = path.join(staging, file.directory);
        const replaced = file.directory === 'models' ? path.join(destination, 'vits-piper-' + file.id) : destination;
        await fs.promises.rm(replaced, { recursive: true, force: true });
        await fs.promises.mkdir(destination, { recursive: true });
        await this.extract(archive, destination, file.compression);
        await fs.promises.rm(archive);
      }
      this.installController?.signal.throwIfAborted();
      this.stage = 'checking';
      await fs.promises.writeFile(
        path.join(staging, 'installation.json'),
        JSON.stringify({
          application: 'RaceHubOS offline voices',
          engineVersion: this.manifest.engineVersion,
          platform: this.platform,
          arch: this.arch,
          archives: [
            ...new Map(
              [...previousArchives, ...plan.map(({ url, sha256, integrity }) => ({ url, sha256, integrity }))].map(
                (archive) => [archive.url, archive]
              )
            ).values(),
          ],
        })
      );
      const expected = new Set([...languages, ...previousVoices.map((voice) => voice.language)]);
      const stagedVoices = installedVoices(staging, this.manifest);
      if ([...expected].some((language) => !stagedVoices.some((voice) => voice.language === language)))
        throw new Error('Incomplete offline voice installation');
      await this.beforeChange();
      this.installController?.signal.throwIfAborted();
      this.stage = 'publishing';
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
      const signal = this.installController
        ? AbortSignal.any([controller.signal, this.installController.signal])
        : controller.signal;
      const response = await this.fetchFile(file.url, { signal });
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
      await pipeline(Readable.fromWeb(response.body), meter, fs.createWriteStream(target), { signal });
      this.stage = 'verifying';
      const actual = file.sha256 ? hash.digest('hex') : 'sha512-' + hash.digest('base64');
      if (size !== file.bytes || actual !== (file.sha256 || file.integrity))
        throw new Error('Offline voice checksum mismatch');
      this.verifiedFiles++;
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
