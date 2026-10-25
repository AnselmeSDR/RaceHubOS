import EventEmitter from 'node:events';
import { createBluetooth } from 'node-ble';

const SERVICE = '39df7777-b1b4-b90b-57f1-7144ae4e4a6a';
const OUTPUT = '39df8888-b1b4-b90b-57f1-7144ae4e4a6a';
const NOTIFY = '39df9999-b1b4-b90b-57f1-7144ae4e4a6a';

export function notificationPacket(data) {
  if (data.at(-1) !== 0x24) return data;
  const payload = data.subarray(0, -1);
  return Buffer.concat([Buffer.from(payload.length === 5 ? '0' : '?'), payload]);
}

/** System BlueZ transport. Each attempt owns its D-Bus connection and listeners. */
export class BluezBLEService extends EventEmitter {
  constructor({ createSession = createBluetooth, operationTimeout = 10000 } = {}) {
    super();
    this.createSession = createSession;
    this.operationTimeout = operationTimeout;
    this.connected = false;
    this.connecting = false;
    this.session = null;
    this.peripheral = null;
    this.cleaning = 0;
  }

  open() {
    if (this.session || this.cleaning) throw new Error('Bluetooth operation already in progress');
    const session = { ...this.createSession(), pending: new Set(), closed: false };
    this.session = session;
    session.onError = (error) => {
      if (session.closed) return;
      const wasConnected = this.connected;
      this.close(session);
      if (wasConnected) this.emit('disconnect');
      this.emit('error', error);
    };
    session.bluetooth.dbus?.on('error', session.onError);
    return session;
  }

  async run(session, action, label, timeout = this.operationTimeout) {
    if (session.closed) throw new Error('CU connection cancelled');
    let timer;
    let cancel;
    try {
      const aborted = new Promise((_, reject) => {
        cancel = () => reject(new Error('CU connection cancelled'));
        session.pending.add(cancel);
        timer = setTimeout(() => reject(new Error(`${label} timed out`)), timeout);
      });
      const result = await Promise.race([
        Promise.resolve().then(() => {
          if (session.closed) throw new Error('CU connection cancelled');
          return action();
        }),
        aborted,
      ]);
      if (session.closed) throw new Error('CU connection cancelled');
      return result;
    } finally {
      clearTimeout(timer);
      session.pending.delete(cancel);
    }
  }

  close(session, destroy = true) {
    if (!session || session.closed) return;
    session.closed = true;
    for (const cancel of session.pending) cancel();
    session.pending.clear();
    session.notify?.off('valuechanged', session.onData);
    session.device?.off('disconnect', session.onDisconnect);
    clearTimeout(session.pause);
    if (destroy) session.destroy();
    if (this.session === session) {
      this.session = null;
      this.connected = false;
      this.connecting = false;
    }
  }

  async discover(session, address, timeout) {
    session.adapter = await this.run(session, () => session.bluetooth.defaultAdapter(), 'Bluetooth adapter');
    const adapter = session.adapter;
    // Do not stop discovery owned by another application.
    const discovering = await this.run(session, () => adapter.isDiscovering(), 'Bluetooth discovery state');
    if (!discovering) {
      await this.run(session, () => adapter.startDiscovery(), 'Bluetooth scan start');
      session.ownsDiscovery = true;
    }
    const deadline = Date.now() + timeout;
    try {
      do {
        const addresses = await this.run(session, () => adapter.devices(), 'Bluetooth devices');
        for (const candidate of addresses) {
          if (address && candidate.toLowerCase() !== address.toLowerCase()) continue;
          const device = await this.run(session, () => adapter.getDevice(candidate), 'Bluetooth device');
          const name = await this.run(session, () => device.getName(), 'Bluetooth device name').catch(() => null);
          if (!address && name !== 'Control_Unit') continue;
          return { device, info: { address: candidate.toLowerCase(), name, advertisement: { localName: name } } };
        }
        await this.run(
          session,
          () =>
            new Promise((resolve) => {
              session.pause = setTimeout(resolve, 100);
            }),
          'Bluetooth scan wait',
          1000
        );
      } while (Date.now() < deadline);
      throw new Error('Control Unit not found. Turn on the CU and AppConnect.');
    } finally {
      clearTimeout(session.pause);
      if (session.ownsDiscovery && !session.closed) {
        session.ownsDiscovery = false;
        // Releasing discovery cannot overwrite a successful result or original error.
        await this.run(session, () => adapter.stopDiscovery(), 'Bluetooth scan stop').catch(() => {});
      }
    }
  }

  async scan(timeout = 10000) {
    if (this.connected || this.connecting) throw new Error('Bluetooth operation already in progress');
    const session = this.open();
    try {
      const { info } = await this.run(
        session,
        () => this.discover(session, null, timeout),
        'Bluetooth discovery',
        timeout + 20000
      );
      this.peripheral = info;
      this.emit('discovered', info.address);
      return info;
    } finally {
      this.close(session);
    }
  }

  async connect(address = null) {
    if (this.connected) throw new Error('Already connected');
    if (this.connecting) throw new Error('Connection already in progress');
    if (address && !/^([\da-f]{2}:){5}[\da-f]{2}$/i.test(address)) throw new Error('Invalid Bluetooth address');
    const session = this.open();
    this.connecting = true;
    this.emit('connecting');
    try {
      await this.run(
        session,
        async () => {
          const { device, info } = await this.discover(session, address, 15000);
          session.device = device;
          session.onDisconnect = () => {
            if (this.session !== session || session.closed) return;
            const wasConnected = this.connected;
            this.close(session);
            if (wasConnected) this.emit('disconnect');
          };
          device.on('disconnect', session.onDisconnect);
          await this.run(session, () => device.connect(), 'Bluetooth connection', 35000);
          const gatt = await this.run(session, () => device.gatt(), 'AppConnect GATT');
          const service = await this.run(session, () => gatt.getPrimaryService(SERVICE), 'AppConnect service');
          session.output = await this.run(session, () => service.getCharacteristic(OUTPUT), 'AppConnect output');
          session.notify = await this.run(session, () => service.getCharacteristic(NOTIFY), 'AppConnect notifications');
          session.onData = (data) => {
            if (this.session === session && this.connected) this.emit('data', notificationPacket(Buffer.from(data)));
          };
          session.notify.on('valuechanged', session.onData);
          await this.run(session, () => session.notify.startNotifications(), 'AppConnect subscribe');
          this.peripheral = info;
          this.connected = true;
          this.connecting = false;
          this.emit('ready');
        },
        'Bluetooth connect',
        60000
      );
    } catch (error) {
      await this.release(session);
      throw error;
    }
  }

  async release(session) {
    if (!session || session.closed) return;
    const device = session.device;
    this.cleaning += 1;
    // Invalidate pending work before cleanup; a later attempt owns a different bus.
    this.close(session, false);
    let timer;
    try {
      if (device) {
        await Promise.race([
          Promise.resolve().then(() => device.disconnect()),
          new Promise((resolve) => {
            timer = setTimeout(resolve, 8000);
          }),
        ]);
      }
    } catch {
      // Closing the private bus below also releases discovery and notifications.
    } finally {
      clearTimeout(timer);
      session.destroy();
      this.cleaning -= 1;
    }
  }

  async disconnect() {
    const session = this.session;
    const wasConnected = this.connected;
    this.connected = false;
    this.peripheral = null;
    await this.release(session);
    if (wasConnected) this.emit('disconnect');
  }

  async send(data) {
    const session = this.session;
    if (!this.connected || !session?.output) throw new Error('Not connected');
    try {
      await this.run(session, () => session.output.writeValueWithoutResponse(data), 'Bluetooth send', 8000);
    } catch (error) {
      await this.disconnect();
      throw error;
    }
  }

  isConnected() {
    return this.connected;
  }
  getPeripheralInfo() {
    return this.peripheral
      ? { name: this.peripheral.name, address: this.peripheral.address, transport: 'bluez', serviceUuids: [SERVICE] }
      : null;
  }
}
