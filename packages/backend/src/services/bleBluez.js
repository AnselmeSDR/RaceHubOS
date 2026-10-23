import EventEmitter from 'node:events';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

export function notificationPacket(data) {
  if (data.at(-1) !== 0x24) return data;
  const payload = data.subarray(0, -1);
  return Buffer.concat([Buffer.from(payload.length === 5 ? '0' : '?'), payload]);
}
/** Linux BlueZ owns the adapter and its packet accounting. Never loads Noble/raw HCI. */
export class BluezBLEService extends EventEmitter {
  constructor({ spawnBridge = spawn } = {}) {
    super(); this.spawnBridge = spawnBridge; this.pending = new Map(); this.sequence = 0;
    this.connected = false; this.connecting = false; this.externalRecovery = true; this.child = null;
  }
  ensureBridge() {
    if (this.child) return;
    const child = this.spawnBridge('/usr/bin/python3', ['-u', fileURLToPath(new URL('./bluezBridge.py', import.meta.url))], { stdio:['pipe','pipe','pipe'] });
    this.child = child;
    createInterface({input:child.stdout}).on('line', line => {
      if (this.child !== child) return;
      let value; try { value = JSON.parse(line); } catch { return; }
      if (value.id && this.pending.has(value.id)) {
        const pending = this.pending.get(value.id); clearTimeout(pending.timer); this.pending.delete(value.id);
        value.error ? pending.reject(new Error(value.error)) : pending.resolve(value.result);
      } else if (value.event === 'data') this.emit('data', notificationPacket(Buffer.from(value.hex,'hex')));
      else if (value.event === 'disconnect') { this.connected = false; this.emit('disconnect'); }
      else if (value.event === 'error') this.emit('error', new Error(value.error));
    });
    let diagnostic = '';
    child.stderr.on('data', bytes => { diagnostic = (diagnostic + bytes.toString()).slice(-2000); });
    const failed = error => {
      if (this.child !== child) return;
      this.child = null; this.connecting = false; const wasConnected = this.connected; this.connected = false;
      for (const job of this.pending.values()) { clearTimeout(job.timer); job.reject(error); } this.pending.clear();
      if (wasConnected) this.emit('disconnect');
    };
    child.stdin.on('error', failed);
    child.on('error', failed);
    child.on('exit', () => failed(new Error(`Linux Bluetooth helper exited. ${diagnostic || 'Python 3 with python3-dbus and python3-gi is required.'}`)));
  }
  request(action, args={}, timeout=10000) {
    this.ensureBridge(); const child=this.child, id=++this.sequence;
    return new Promise((resolve,reject) => {
      const timer=setTimeout(()=>{this.pending.delete(id); reject(new Error('Linux Bluetooth request timed out.')); if(this.child===child)child.kill();},timeout);
      this.pending.set(id,{resolve,reject,timer});
      child.stdin.write(JSON.stringify({id,action,...args})+'\n', error=>{if(error){clearTimeout(timer);this.pending.delete(id);reject(error);}});
    });
  }
  async scan(timeout=10000) { if(this.connecting)throw new Error('Connection already in progress'); const info=await this.request('scan',{timeout},timeout+8000); this.lastFoundPeripheral=this.peripheral={...info,advertisement:{localName:info.name}}; return this.peripheral; }
  async connect(address=null) {
    if(this.connected)throw new Error('Already connected'); if(this.connecting)throw new Error('Connection already in progress');
    this.connecting=true; this.emit('connecting');
    try { const info=await this.request('connect',{address},60000); this.peripheral={...info,advertisement:{localName:info.name}}; this.connected=true; this.emit('ready'); }
    finally { this.connecting=false; }
  }
  async send(data) { if(!this.connected)throw new Error('Not connected'); await this.request('send',{hex:data.toString('hex')},8000); }
  async disconnect() {
    if(!this.child)return; const child=this.child;
    try { await this.request('disconnect',{},8000); } finally {
      this.connected=false;this.connecting=false;
      if(this.child===child)this.child=null;
      for(const job of this.pending.values()){clearTimeout(job.timer);job.reject(new Error('Bluetooth connection closed.'));}this.pending.clear();
      child.kill();
    }
  }
  isConnected(){return this.connected;}
  getPeripheralInfo(){return this.peripheral ? {name:this.peripheral.name,address:this.peripheral.address,transport:'bluez',serviceUuids:['39df7777b1b4b90b57f17144ae4e4a6a']} : null;}
}
