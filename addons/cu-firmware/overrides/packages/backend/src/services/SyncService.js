export * from '@base';
import { SyncService as Base } from '@base';
export class SyncService extends Base {
  startPolling(...args){if(this.getDevice()?._firmwareLease)return;return super.startPolling(...args);}
}
