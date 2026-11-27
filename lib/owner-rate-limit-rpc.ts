import {OwnerLimitUnavailable,type OwnerLimitAction,type OwnerLimitStore} from './owner-rate-limit';
export type OwnerLimitRequest={version:1;operation:'owner.limit.consume';action:OwnerLimitAction;keyHash:string};
const record=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
function request(value:unknown):OwnerLimitRequest{
 if(!record(value)||Object.keys(value).length!==4||value.version!==1||value.operation!=='owner.limit.consume'||
  typeof value.action!=='string'||!['start','callback','status','logout'].includes(value.action)||typeof value.keyHash!=='string'||!/^[a-f0-9]{64}$/.test(value.keyHash))throw new OwnerLimitUnavailable();
 return value as OwnerLimitRequest;
}
/** Only the eventual reviewed private IAM transport may invoke this adapter.
 * Automatic retries must be disabled: a lost reply can still consume a budget.
 */
export function createRemoteOwnerLimitStore(invoke:(value:OwnerLimitRequest)=>Promise<unknown>):OwnerLimitStore{
 return {async consume(action,keyHash){try{
  const reply=await invoke(request({version:1,operation:'owner.limit.consume',action,keyHash}));
  if(!record(reply)||Object.keys(reply).length!==3||reply.version!==1||reply.ok!==true||typeof reply.allowed!=='boolean')throw new OwnerLimitUnavailable();
  return reply.allowed;
 }catch{throw new OwnerLimitUnavailable();}}};
}
/** Unmounted service core; this is not network authentication. */
export function createOwnerLimitDispatcher(store:OwnerLimitStore){
 return async(input:unknown)=>{try{
  const value=request(input),allowed=await store.consume(value.action,value.keyHash);
  if(typeof allowed!=='boolean')throw new OwnerLimitUnavailable();
  return {version:1,ok:true,allowed};
 }catch{throw new OwnerLimitUnavailable();}};
}
