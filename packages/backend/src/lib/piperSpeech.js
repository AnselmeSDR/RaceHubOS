import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { runtimePackage } from './offlineVoices.js';

export function workerEnvironment(home, platform = process.platform, arch = process.arch, inherited = process.env) {
  const env = { ...inherited };
  const directory = path.join(home, 'node_modules', runtimePackage(platform, arch));
  const key =
    platform === 'win32'
      ? Object.keys(env).find((name) => name.toLowerCase() === 'path') || 'PATH'
      : platform === 'darwin'
        ? 'DYLD_LIBRARY_PATH'
        : 'LD_LIBRARY_PATH';
  env[key] = directory + (platform === 'win32' ? ';' : ':') + (env[key] || '');
  return env;
}

export class PiperSpeech {
  constructor({ forkWorker = fork, timeout = 30000, idleTimeout = 60000 } = {}) {
    Object.assign(this, { forkWorker, timeout, idleTimeout });
    this.jobs = new Map();
    this.cache = new Map();
    this.serial = 0;
    this.child = null;
    this.idle = null;
    this.closing = null;
  }
  speak(voice, text, rate) {
    if (this.closing) return Promise.reject(new Error('Local voice is stopping'));
    const key = JSON.stringify([voice.home, voice.id, text, rate]);
    if (this.cache.has(key)) return Promise.resolve(this.cache.get(key));
    if (this.jobs.size >= 4) return Promise.reject(Object.assign(new Error('Local voice is busy'), { status: 429 }));
    clearTimeout(this.idle);
    if (!this.child) {
      const child = this.forkWorker(fileURLToPath(new URL('./piperWorker.js', import.meta.url)), [], {
        serialization: 'advanced',
        stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
        env: workerEnvironment(voice.home),
      });
      this.child = child;
      child.stderr?.on('data', () => {});
      const fail = () => {
        if (this.child !== child) return;
        this.child = null;
        this.rejectJobs(new Error('Local voice stopped'));
      };
      child.on('error', fail);
      child.on('exit', fail);
      child.on('message', (result) => {
        const job = this.jobs.get(result.id);
        if (!job || job.child !== child) return;
        clearTimeout(job.timer);
        this.jobs.delete(result.id);
        if (
          result.error ||
          !Buffer.isBuffer(result.audio) ||
          result.audio.length > 8 * 1024 * 1024 ||
          result.audio.toString('ascii', 0, 4) !== 'RIFF' ||
          result.audio.toString('ascii', 8, 12) !== 'WAVE'
        )
          job.reject(new Error('Invalid local audio'));
        else {
          this.cache.set(job.key, result.audio);
          if (this.cache.size > 16) this.cache.delete(this.cache.keys().next().value);
          job.resolve(result.audio);
        }
        if (!this.jobs.size)
          this.idle = setTimeout(() => {
            this.close().catch(() => {});
          }, this.idleTimeout);
      });
    }
    const child = this.child;
    return new Promise((resolve, reject) => {
      const id = ++this.serial;
      const timer = setTimeout(() => {
        this.close().catch(() => {});
      }, this.timeout);
      this.jobs.set(id, { child, timer, key, resolve, reject });
      child.send({ id, voice, text, rate }, (error) => {
        if (!error) return;
        const job = this.jobs.get(id);
        if (!job) return;
        clearTimeout(timer);
        this.jobs.delete(id);
        reject(error);
      });
    });
  }
  rejectJobs(error) {
    for (const job of this.jobs.values()) {
      clearTimeout(job.timer);
      job.reject(error);
    }
    this.jobs.clear();
  }
  async close() {
    if (this.closing) return this.closing;
    clearTimeout(this.idle);
    this.rejectJobs(new Error('Local voice stopped'));
    this.cache.clear();
    const child = this.child;
    this.child = null;
    if (!child || (child.exitCode !== null && child.exitCode !== undefined)) return;
    this.closing = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error('Offline worker did not stop'));
      }, 5000);
      child.once('exit', () => {
        clearTimeout(timer);
        resolve();
      });
      child.kill();
    }).finally(() => {
      this.closing = null;
    });
    return this.closing;
  }
}
