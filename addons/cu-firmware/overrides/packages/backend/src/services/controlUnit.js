export * from '@base';
import { ControlUnit as Base } from '@base';
import { unpack } from '@addon/server/protocol.js';
export class ControlUnit extends Base {
  assertFirmwareAccess(token){if(this._firmwareLease && token!==this._firmwareLease)throw Error('CU firmware maintenance / recovery required');}
  acquireFirmwareLease(){if(this._firmwareLease)throw Error('CU firmware lease already held');this._firmwareLease=Symbol('firmware');this._connectionGeneration++;return this._firmwareLease;}
  releaseFirmwareLease(token){this.assertFirmwareAccess(token);this._firmwareLease=null;}
  request(buffer,timeout=5000,token=null){
    this.assertFirmwareAccess(token);
    if([0x47,0x45,0x46].includes(buffer[0]) && (!this._firmwareLease || token!==this._firmwareLease))throw Error('Firmware command requires exclusive lease');
    return super.request(buffer,timeout);
  }
  async connect(address=null,token=null){this.assertFirmwareAccess(token);return super.connect(address);}
  async disconnect(token=null){this.assertFirmwareAccess(token);return super.disconnect();}
  async version(token=null){const response=await this.request(Buffer.from('0'),5000,token);return unpack('x4sC',response)[0].toString('ascii');}
  handleData(data){
    if(this._firmwareLease){
      const waiter=this.waitingForResponse;
      if(!waiter)return;
      if(['#','?#'].includes(data.toString('ascii'))){waiter.reject(Error('CU rejected command'));return;}
      if(data.length===2 && data[0]===0x3f && data[1]===waiter.expectedPrefix){waiter.resolve(data.subarray(1));return;}
      if(data[0]!==waiter.expectedPrefix)return;
    }
    return super.handleData(data);
  }
}
export default ControlUnit;
