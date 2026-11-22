import type {EncryptedOwnerAttemptStore} from './owner-login-attempts';
import {OwnerLoginError} from './owner-login';

type CreateRequest={version:1;operation:'owner.attempt.create';stateHash:string;browserHash:string;payload:string;expiresAt:number};
type ConsumeRequest={version:1;operation:'owner.attempt.consume';stateHash:string;browserHash:string};
export type OwnerAttemptRequest=CreateRequest|ConsumeRequest;
type Reply={version:1;ok:true;payload?:string|null};
const record=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const exact=(value:Record<string,unknown>,keys:string[])=>Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
const hash=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const encrypted=(value:unknown):value is string=>typeof value==='string'&&value.length<=16384&&/^1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]+$/.test(value);
function request(value:unknown):OwnerAttemptRequest{
  if(!record(value)||value.version!==1||!hash(value.stateHash)||!hash(value.browserHash))throw new OwnerLoginError();
  const base=['version','operation','stateHash','browserHash'];
  if(value.operation==='owner.attempt.consume'&&exact(value,base))return value as ConsumeRequest;
  if(value.operation==='owner.attempt.create'&&exact(value,[...base,'payload','expiresAt'])&&encrypted(value.payload)&&
    Number.isSafeInteger(value.expiresAt)&&Number(value.expiresAt)>0)return value as CreateRequest;
  throw new OwnerLoginError();
}
/** Private IAM-authenticated transport only. Never pass a browser fetch/request adapter here.
 * A consume invocation must not be retried: a lost reply leaves the attempt consumed.
 */
export function createRemoteOwnerAttemptStore(invoke:(request:OwnerAttemptRequest)=>Promise<unknown>):EncryptedOwnerAttemptStore{
  async function call(input:OwnerAttemptRequest):Promise<Reply>{
    try{
      request(input);
      const reply=await invoke(input);
      if(!record(reply)||reply.version!==1||reply.ok!==true)throw new OwnerLoginError();
      if(input.operation==='owner.attempt.create'){
        if(!exact(reply,['version','ok']))throw new OwnerLoginError();
      }else if(!exact(reply,['version','ok','payload'])||!(reply.payload===null||encrypted(reply.payload)))throw new OwnerLoginError();
      return reply as Reply;
    }catch{throw new OwnerLoginError();}
  }
  return {
    async create(stateHash,browserHash,payload,expiresAt){await call({version:1,operation:'owner.attempt.create',stateHash,browserHash,payload,expiresAt});},
    async consume(stateHash,browserHash){return (await call({version:1,operation:'owner.attempt.consume',stateHash,browserHash})).payload!;},
  };
}
/** Dispatcher core, not a mounted route. The eventual Lambda entry must authenticate
 * its caller and enforce Preview deployment before calling this function.
 * There is deliberately no query/SQL, tenant, role, token or provider URL argument.
 */
export function createOwnerAttemptDispatcher(store:EncryptedOwnerAttemptStore){
  return async(input:unknown):Promise<Reply>=>{
    try{
      const value=request(input);
      if(value.operation==='owner.attempt.create'){
        await store.create(value.stateHash,value.browserHash,value.payload,value.expiresAt);
        return {version:1,ok:true};
      }
      const payload=await store.consume(value.stateHash,value.browserHash);
      if(payload!==null&&!encrypted(payload))throw new OwnerLoginError();
      return {version:1,ok:true,payload};
    }catch{throw new OwnerLoginError();}
  };
}
