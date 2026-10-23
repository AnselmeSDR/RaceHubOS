import { test } from '@jest/globals';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {PassThrough,Writable} from 'node:stream';
import {BluezBLEService,notificationPacket} from '../services/bleBluez.js';
function setup(){
 const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();const commands=[];
 child.stdin=new Writable({write(data,enc,cb){commands.push(JSON.parse(data));cb();}});child.kill=()=>child.emit('exit',0);
 const ble=new BluezBLEService({spawnBridge:()=>child});ble.on('error',()=>{});
 const reply=(result,error=null)=>child.stdout.write(JSON.stringify({id:commands.at(-1).id,result,error})+'\n');
 return {ble,child,commands,reply};
}
test('native BlueZ connection becomes ready only after resolved GATT; commands and notifications retain protocol framing',async()=>{
 const {ble,child,commands,reply}=setup();let ready=0;const packets=[];ble.on('ready',()=>ready++);ble.on('data',p=>packets.push(p));
 const connected=ble.connect('fd:07:e0:82:6c:c8');assert.equal(ready,0);assert.equal(commands[0].action,'connect');
 reply({address:'fd:07:e0:82:6c:c8',name:'Control_Unit'});await connected;assert.equal(ready,1);assert.equal(ble.isConnected(),true);
 const sent=ble.send(Buffer.from('abc'));assert.equal(commands[1].hex,'616263');reply(true);await sent;
 child.stdout.write(JSON.stringify({event:'data',hex:Buffer.from(':123456$').toString('hex')})+'\n');assert.equal(packets[0].toString(), '?:123456');
 assert.equal(notificationPacket(Buffer.from('12345$')).toString(),'012345');assert.equal(notificationPacket(Buffer.from('?raw')).toString(),'?raw');
 const disconnected=ble.disconnect();reply(true);await disconnected;assert.equal(ble.connected,false);
});
test('bridge failures reject pending operations and connection loss is published without stale connected state',async()=>{
 const {ble,child,reply}=setup();const connected=ble.connect();reply({address:'test'});await connected;
 let lost=0;ble.on('disconnect',()=>lost++);const request=ble.send(Buffer.from('a'));child.stderr.write('test failure');child.emit('exit',1);
 await assert.rejects(request,/test failure/);assert.equal(lost,1);assert.equal(ble.connected,false);assert.equal(ble.pending.size,0);
 await assert.rejects(ble.send(Buffer.from('a')),/Not connected/);
});
test('explicit disconnect releases the old bridge before an immediate reconnect',async()=>{
 const {ble,child,reply}=setup();const connected=ble.connect();reply({address:'test'});await connected;
 const disconnected=ble.disconnect();reply(true);await disconnected;assert.equal(ble.child,null);
 const next=new EventEmitter();next.stdout=new PassThrough();next.stderr=new PassThrough();let request;
 next.stdin=new Writable({write(data,enc,cb){request=JSON.parse(data);cb();}});next.kill=()=>next.emit('exit');ble.spawnBridge=()=>next;
 const again=ble.connect('test');next.stdout.write(JSON.stringify({id:request.id,result:{address:'test'}})+'\n');await again;
 child.emit('exit',0);assert.equal(ble.connected,true);assert.equal(ble.child,next);
 const end=ble.disconnect();next.stdout.write(JSON.stringify({id:request.id,result:true})+'\n');await end;
});
