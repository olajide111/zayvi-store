import {createHmac} from 'node:crypto';
import type {OwnerAuthHttpDependencies} from './owner-auth-http';
import type {StoreDatabaseClient} from './store-database';
export type OwnerLimitAction='start'|'callback'|'status'|'logout';
export type OwnerLimitStore={consume(action:OwnerLimitAction,keyHash:string):Promise<boolean>};
export class OwnerLimitUnavailable extends Error{constructor(){super('Owner sign-in limiting is unavailable.');this.name='OwnerLimitUnavailable';}}
const actions=new Set<unknown>(['start','callback','status','logout']);
const hash=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
export function createPostgresOwnerLimitStore(client:Pick<StoreDatabaseClient,'query'>):OwnerLimitStore{
 return {async consume(action,keyHash){
  try{
   if(!actions.has(action)||!hash(keyHash))throw new OwnerLimitUnavailable();
   const result=await client.query('SELECT zayvi_owner_auth.consume_limit($1,$2) AS allowed',[action,keyHash]);
   if(result.rows.length!==1||typeof result.rows[0]?.allowed!=='boolean')throw new OwnerLimitUnavailable();
   return result.rows[0].allowed;
  }catch{throw new OwnerLimitUnavailable();}
 }};
}
/** Server-only adapter. identify must use deployment-authenticated connection
 * metadata, never untrusted forwarding headers, cookies or browser parameters.
 * Store one stable, dedicated secret per deployment; rotating it resets subjects.
 */
export function createOwnerAuthLimiter({identify,key,store}:{identify:(request:Request)=>Promise<string|null>;key:Uint8Array;store:OwnerLimitStore}):OwnerAuthHttpDependencies['limit']{
 if(key.length!==32||typeof identify!=='function'||typeof store?.consume!=='function')throw new OwnerLimitUnavailable();
 const secret=Buffer.from(key);
 return async(action,request)=>{
  try{
   if(!actions.has(action))throw new OwnerLimitUnavailable();
   const identity=await identify(request);
   if(typeof identity!=='string'||!identity.length||identity.length>256||identity.trim()!==identity)throw new OwnerLimitUnavailable();
   const keyHash=createHmac('sha256',secret).update('zayvi-owner-limiter-v1\0').update(identity).digest('hex');
   const allowed=await store.consume(action,keyHash);
   if(typeof allowed!=='boolean')throw new OwnerLimitUnavailable();
   return allowed;
  }catch{throw new OwnerLimitUnavailable();}
 };
}
