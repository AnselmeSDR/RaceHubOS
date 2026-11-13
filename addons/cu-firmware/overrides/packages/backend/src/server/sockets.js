export * from '@base';
import { handleSockets as base } from '@base';
import { runtime } from '@addon/server/state.js';
export function handleSockets(io,...args){
 io.on('connection',socket=>{
  socket.use(([event],next)=>runtime.firmware?.busy && event!=='simulator:getState' ? next(Error('CU firmware maintenance')) : next());
  socket.on('error',error=>socket.emit('cu-firmware:error',{error:error.message}));
 });
 return base(io,...args);
}
