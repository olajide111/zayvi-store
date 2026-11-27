import {createHash} from 'node:crypto';
import type {OwnerSessionLifecycleStore,StoredOwnerSession} from './owner-sessions';
import {isTenantRole} from './tenant-permissions';
export type OwnerLifecycleConfig={deployment:string;providerIssuer:string;tenantId:string;storeId:string};
export type OwnerLifecycleRequest={version:1;operation:'owner.session.lookup'|'owner.session.revoke';sessionHash:string};
export class OwnerSessionUnavailable extends Error{constructor(){super('Owner session service is unavailable.');this.name='OwnerSessionUnavailable';}}
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const exact=(v:Record<string,unknown>,keys:string[])=>Object.keys(v).length===keys.length&&keys.every(key=>Object.hasOwn(v,key));
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const text=(v:unknown,max:number):v is string=>typeof v==='string'&&v.length>0&&v.length<=max&&v.trim()===v;
function settings(input:OwnerLifecycleConfig){
 if(input.deployment!=='preview'||!/^https:\/\/cognito-idp\.eu-west-2\.amazonaws\.com\/eu-west-2_[A-Za-z0-9]+$/.test(input.providerIssuer)||!uuid(input.tenantId)||!uuid(input.storeId))throw new OwnerSessionUnavailable();
 return Object.freeze({...input});
}
function request(value:unknown):OwnerLifecycleRequest{
 if(!record(value)||!exact(value,['version','operation','sessionHash'])||value.version!==1||
  typeof value.operation!=='string'||!['owner.session.lookup','owner.session.revoke'].includes(value.operation)||
  typeof value.sessionHash!=='string'||!/^[a-f0-9]{64}$/.test(value.sessionHash))throw new OwnerSessionUnavailable();
 return value as OwnerLifecycleRequest;
}
function session(value:unknown):StoredOwnerSession{
 const keys=['tenantId','storeId','membershipId','issuer','subject','role','authenticationTime','providerSessionId','providerTokenId','expiresAt'];
 const now=Math.floor(Date.now()/1000);
 if(!record(value)||!exact(value,keys)||![value.tenantId,value.storeId,value.membershipId,value.subject].every(uuid)||
  !text(value.issuer,2048)||typeof value.role!=='string'||!isTenantRole(value.role)||
  !text(value.providerSessionId,512)||!text(value.providerTokenId,512)||
  !Number.isSafeInteger(value.authenticationTime)||Number(value.authenticationTime)<=0||Number(value.authenticationTime)>now||
  !Number.isSafeInteger(value.expiresAt)||Number(value.expiresAt)<=now||Number(value.expiresAt)>now+3600)throw new OwnerSessionUnavailable();
 return {...value} as StoredOwnerSession;
}
function matches(value:StoredOwnerSession,config:OwnerLifecycleConfig){return value.tenantId===config.tenantId&&value.storeId===config.storeId&&value.issuer===config.providerIssuer;}
/** Pinned private IAM transport only. Raw session handles stay on the web server.
 * Returned metadata is confidential and is never a store authorisation decision.
 * Disable automatic retries and do not cache lookup results across requests.
 */
export function createRemoteOwnerSessionLifecycle(input:OwnerLifecycleConfig,invoke:(value:OwnerLifecycleRequest)=>Promise<unknown>){
 const config=settings(input);
 async function call(operation:OwnerLifecycleRequest['operation'],token:string){
  try{
   const sessionHash=createHash('sha256').update(token).digest('hex');
   const reply=await invoke({version:1,operation,sessionHash});
   if(!record(reply)||reply.version!==1||reply.ok!==true)throw new OwnerSessionUnavailable();
   if(operation==='owner.session.revoke'){
    if(!exact(reply,['version','ok']))throw new OwnerSessionUnavailable();
    return null;
   }
   if(!exact(reply,['version','ok','session']))throw new OwnerSessionUnavailable();
   if(reply.session===null)return null;
   const found=session(reply.session);if(!matches(found,config))throw new OwnerSessionUnavailable();
   return found;
  }catch{throw new OwnerSessionUnavailable();}
 }
 const valid=(token:unknown):token is string=>typeof token==='string'&&/^[A-Za-z0-9_-]{43}$/.test(token);
 return {
  async load(token:string|undefined):Promise<StoredOwnerSession|null>{return valid(token)?call('owner.session.lookup',token):null;},
  async revoke(token:string|undefined):Promise<void>{if(valid(token))await call('owner.session.revoke',token);},
 };
}
/** Unmounted private service core. The eventual entry must authenticate IAM caller
 * and deployment before dispatch; no browser/gateway route may expose this API.
 */
export function createOwnerSessionLifecycleDispatcher(input:OwnerLifecycleConfig,store:OwnerSessionLifecycleStore){
 const config=settings(input);
 return async(value:unknown)=>{try{
  const message=request(value),stored=await store.loadHash(message.sessionHash);
  const found=stored===null?null:session(stored),bound=found&&matches(found,config)?found:null;
  if(message.operation==='owner.session.lookup')return {version:1,ok:true,session:bound};
  if(bound)await store.revokeHash(message.sessionHash);
  return {version:1,ok:true};
 }catch{throw new OwnerSessionUnavailable();}};
}
