export * from '@base';
import { addCoreRoutes as base } from '@base';
import { runtime } from '@addon/server/state.js';
export function addCoreRoutes(app,...args){
 app.use('/api',(req,res,next)=>{
  if(runtime.firmware?.busy && !['GET','HEAD','OPTIONS'].includes(req.method) && !req.path.startsWith('/cu-firmware/'))return res.status(409).json({success:false,error:'CU-Firmware: Wartung oder Recovery erforderlich'});
  next();
 });
 return base(app,...args);
}
