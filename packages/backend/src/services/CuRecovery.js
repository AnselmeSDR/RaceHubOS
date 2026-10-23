/** One retry owner for startup failures, link loss and stale CU status. */
export class CuRecovery {
  constructor(cu, sync, io, { now = Date.now, interval = 1000 } = {}) {
    this.cu = cu;
    this.sync = sync;
    this.io = io;
    this.now = now;
    this.enabled = false;
    this.address = null;
    this.pending = null;
    this.generation = 0;
    this.attempt = 0;
    this.nextRetryAt = null;
    this.lastStatusAt = null;
    this.connectedAt = null;
    this.state = { code: 'disabled', attempt: 0, nextRetryAt: null };
    cu.ble.externalRecovery = true;
    this.onDisconnected = () => {
      if (this.enabled && !this.pending) this.failure();
    };
    this.onStatus = () => {
      if (this.enabled && this.sync.getDevice() === cu && cu.isConnected()) {
        this.lastStatusAt = this.now();
        this.attempt = 0;
        this.nextRetryAt = null;
        if (this.state.code !== 'live') this.publish('live');
      }
    };
    cu.on('disconnected', this.onDisconnected);
    cu.on('status', this.onStatus);
    this.timer = setInterval(() => { void this.check(); }, interval);
    this.timer.unref?.();
  }

  publish(code, error) {
    this.state = {
      code, attempt: this.attempt, nextRetryAt: this.nextRetryAt,
      updatedAt: this.now(),
      ...(error ? { detail: String(error.message || error).slice(0, 300) } : {}),
    };
    this.io?.emit('cu:recovery', this.state);
  }

  snapshot() { return this.state; }

  failure(error) {
    if (!this.enabled) return;
    if (this.nextRetryAt === null) {
      const delay = this.attempt < 2 ? 5000 : this.attempt < 4 ? 15000 : 60000;
      this.nextRetryAt = this.now() + delay;
    }
    this.publish('retry_wait', error);
  }

  connect(address) {
    if (this.pending) {
      if (this.enabled && address === this.address) return this.pending;
      return Promise.reject(new Error('CU connection already in progress'));
    }
    this.enabled = true;
    this.address = address;
    this.nextRetryAt = null;
    this.lastStatusAt = null;
    this.connectedAt = null;
    const generation = ++this.generation;
    this.attempt += 1;
    this.publish('connecting');
    // Defer the body so pending is set before disconnect can emit synchronously.
    const job = Promise.resolve().then(async () => {
      try {
        if (generation !== this.generation) throw new Error('CU connection cancelled');
        this.sync.stopPolling();
        const previous = this.sync.getDevice();
        if (previous && previous !== this.cu) {
          await previous.disconnect();
          if (generation !== this.generation) throw new Error('CU connection cancelled');
          this.sync.setDevice(null);
        }
        await this.cu.disconnect();
        if (generation !== this.generation) throw new Error('CU connection cancelled');
        await this.cu.connect(address);
        if (generation !== this.generation) {
          await this.cu.disconnect();
          throw new Error('CU connection cancelled');
        }
        this.connectedAt = this.now();
        this.publish('awaiting_data');
        // Reattach even the same CU: do not compute laps across an outage.
        this.sync.setDevice(this.cu);
        this.sync.startPolling();
      } catch (error) {
        if (generation === this.generation) this.failure(error);
        throw error;
      } finally {
        if (this.pending === job) this.pending = null;
      }
    });
    this.pending = job;
    return job;
  }

  async check() {
    if (!this.enabled || this.pending || this.cu.ble.connecting) return;
    const source = this.sync.getDevice();
    if (source && source !== this.cu) return;
    if (this.cu.isConnected()) {
      const lastData = this.lastStatusAt ?? this.connectedAt;
      if (lastData !== null && this.now() - lastData < 12000) return;
      this.failure(new Error('CU status timeout'));
    } else if (this.nextRetryAt === null) {
      this.failure(new Error('CU disconnected'));
    }
    if (this.nextRetryAt !== null && this.now() >= this.nextRetryAt) {
      try { await this.connect(this.address); } catch { /* next retry is scheduled */ }
    }
  }

  stop() {
    this.enabled = false;
    this.generation += 1;
    this.nextRetryAt = null;
    this.attempt = 0;
    this.publish('manual');
  }

  close() {
    this.stop();
    clearInterval(this.timer);
    this.cu.off('disconnected', this.onDisconnected);
    this.cu.off('status', this.onStatus);
  }
}
