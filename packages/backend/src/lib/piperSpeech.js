import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
export class PiperSpeech {
  constructor({ spawnWorker = spawn, timeout = 20000 } = {}) {
    this.spawnWorker = spawnWorker;
    this.timeout = timeout;
    this.jobs = new Map();
    this.workers = new Map();
    this.cache = new Map();
    this.serial = 0;
  }
  speak(voice, text, rate) {
    const key = JSON.stringify([voice.home, voice.id, text, rate]);
    if (this.cache.has(key)) return Promise.resolve(this.cache.get(key));
    if (this.jobs.size >= 4) return Promise.reject(Object.assign(new Error('Local voice is busy'), { status: 429 }));
    return new Promise((resolve, reject) => {
      const workerKey = voice.home + ':' + voice.id;
      let child = this.workers.get(workerKey);
      if (!child) {
        child = this.spawnWorker(
          voice.python,
          ['-B', '-u', voice.script, ...(voice.legacy ? [] : ['--model', voice.model])],
          {
            stdio: ['pipe', 'pipe', 'pipe'],
            env: { ...process.env, OMP_NUM_THREADS: '2', PYTHONDONTWRITEBYTECODE: '1' },
          }
        );
        this.workers.set(workerKey, child);
        const fail = () => {
          if (this.workers.get(workerKey) === child) this.workers.delete(workerKey);
          for (const [id, job] of this.jobs)
            if (job.child === child) {
              clearTimeout(job.timer);
              this.jobs.delete(id);
              job.reject(new Error('Local voice stopped'));
            }
        };
        child.on('error', fail);
        child.on('exit', fail);
        child.stderr.on('data', () => {});
        createInterface({ input: child.stdout }).on('line', (line) => {
          try {
            const result = JSON.parse(line),
              job = this.jobs.get(result.id);
            if (!job || job.child !== child) return;
            clearTimeout(job.timer);
            this.jobs.delete(result.id);
            if (result.error) job.reject(new Error('Local synthesis failed'));
            else {
              const audio = Buffer.from(result.audio || '', 'base64');
              if (audio.toString('ascii', 0, 4) !== 'RIFF' || audio.toString('ascii', 8, 12) !== 'WAVE')
                return job.reject(new Error('Invalid local audio'));
              this.cache.set(job.key, audio);
              if (this.cache.size > 32) this.cache.delete(this.cache.keys().next().value);
              job.resolve(audio);
            }
          } catch {
            /* Bounded jobs time out if the worker cannot answer. */
          }
        });
      }
      const id = ++this.serial;
      const timer = setTimeout(() => {
        child.kill();
        const job = this.jobs.get(id);
        if (job) {
          this.jobs.delete(id);
          reject(new Error('Local speech timed out'));
        }
      }, this.timeout);
      this.jobs.set(id, { child, timer, key, resolve, reject });
      child.stdin.write(JSON.stringify({ id, text, rate }) + '\n', (error) => {
        if (error) {
          clearTimeout(timer);
          this.jobs.delete(id);
          reject(error);
        }
      });
    });
  }
  close() {
    for (const child of this.workers.values()) child.kill();
    for (const job of this.jobs.values()) {
      clearTimeout(job.timer);
      job.reject(new Error('Local voice stopped'));
    }
    this.jobs.clear();
    this.workers.clear();
    this.cache.clear();
  }
}
