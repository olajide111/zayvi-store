import {createHash} from 'node:crypto';
import {SignJWT,jwtVerify} from 'jose';
import {createOwnerSessionAccess} from './owner-session-access';
import {validateOwnerLifecycleConfig,validateStoredOwnerSession,type OwnerLifecycleConfig} from './owner-session-lifecycle-rpc';
import type {StoredOwnerSession,OwnerSessionLifecycleStore} from './owner-sessions';
import type {createStoreDatabaseAdapters} from './store-database';
import type {TenantMembershipDirectory} from './tenant-access';
export type OwnerStoreSummary={id:string;name:string;slug:string;status:'draft'|'active'};
export type OwnerSummaryRequest={version:1;operation:'owner.store.summary';proof:string};
export class OwnerOperationUnavailable extends Error{constructor(){super('Owner store operation is unavailable.');this.name='OwnerOperationUnavailable';}}
const operation='owner.store.summary',issuer='urn:zayvi:preview:owner-web',audience='urn:zayvi:preview:owner-store',typ='zayvi-owner-store-read+jwt';
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const exact=(v:Record<string,unknown>,keys:string[])=>Object.keys(v).length===keys.length&&keys.every(key=>Object.hasOwn(v,key));
const text=(v:unknown,max:number):v is string=>typeof v==='string'&&v.length>0&&v.length<=max&&v.trim()===v;
function settings(input:OwnerLifecycleConfig,secret:Uint8Array){
 const config=validateOwnerLifecycleConfig(input);if(secret.byteLength!==32)throw new OwnerOperationUnavailable();
 return {config,key:Buffer.from(secret)};
}
function summary(value:unknown,config:OwnerLifecycleConfig):OwnerStoreSummary{
 if(!record(value)||!exact(value,['id','name','slug','status'])||value.id!==config.storeId||!text(value.name,512)||!text(value.slug,256)||typeof value.status!=='string'||!['draft','active'].includes(value.status))throw new OwnerOperationUnavailable();
 return {...value} as OwnerStoreSummary;
}
/** Read-only web adapter. Current provider/MFA verification MUST be real before
 * activation. A cookie lookup or configured pool MFA alone is not assurance.
 * This dedicated proof key is separate from all other auth/payment secrets.
 */
export function createRemoteOwnerStoreSummary(input:OwnerLifecycleConfig,secret:Uint8Array,dependencies:{
 loadSession(token:string):Promise<StoredOwnerSession|null>;
 verifyCurrentAssurance(session:StoredOwnerSession):Promise<{active:boolean;mfaVerified:boolean}>;
 invoke(request:OwnerSummaryRequest):Promise<unknown>;
}){
 const {config,key}=settings(input,secret);
 return async(token:string|undefined):Promise<OwnerStoreSummary>=>{try{
  if(typeof token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(token))throw new OwnerOperationUnavailable();
  const session=validateStoredOwnerSession(await dependencies.loadSession(token));
  if(session.tenantId!==config.tenantId||session.storeId!==config.storeId||session.issuer!==config.providerIssuer)throw new OwnerOperationUnavailable();
  const assurance=await dependencies.verifyCurrentAssurance({...session});
  if(assurance.active!==true||assurance.mfaVerified!==true)throw new OwnerOperationUnavailable();
  const now=Math.floor(Date.now()/1000),sessionHash=createHash('sha256').update(token).digest('hex');
  const proof=await new SignJWT({operation,session_hash:sessionHash,tenant:config.tenantId,store:config.storeId,provider_issuer:session.issuer,
   auth_time:session.authenticationTime,provider_session:session.providerSessionId,provider_token:session.providerTokenId,session_exp:session.expiresAt,mfa:true})
   .setProtectedHeader({alg:'HS256',typ}).setIssuer(issuer).setAudience(audience).setSubject(session.subject).setIssuedAt(now).setExpirationTime(Math.min(now+15,session.expiresAt)).sign(key);
  const reply=await dependencies.invoke({version:1,operation,proof});
  if(!record(reply)||!exact(reply,['version','ok','store'])||reply.version!==1||reply.ok!==true)throw new OwnerOperationUnavailable();
  return summary(reply.store,config);
 }catch{throw new OwnerOperationUnavailable();}};
}
type Database=ReturnType<typeof createStoreDatabaseAdapters>;
/** Unmounted, private IAM-only read operation. It rechecks membership, permission,
 * store and session activity in the transaction containing the summary query.
 * Proof replay within 15 seconds is allowed for this read ONLY. No write API.
 */
export function createPrivateOwnerStoreSummary(input:OwnerLifecycleConfig,secret:Uint8Array,dependencies:Database&{
 sessions:OwnerSessionLifecycleStore;membershipDirectory:TenantMembershipDirectory;
}){
 const {config,key}=settings(input,secret);
 return async(request:unknown)=>{try{
  if(!record(request)||!exact(request,['version','operation','proof'])||request.version!==1||request.operation!==operation||!text(request.proof,8192))throw new OwnerOperationUnavailable();
  const {payload}=await jwtVerify(request.proof,key,{issuer,audience,typ,algorithms:['HS256'],maxTokenAge:15,
   requiredClaims:['iat','exp','sub','operation','session_hash','tenant','store','provider_issuer','auth_time','provider_session','provider_token','session_exp','mfa']});
  const issuedAt=Number(payload.iat),expiresAt=Number(payload.exp);
  if(!exact(payload,['iss','aud','sub','iat','exp','operation','session_hash','tenant','store','provider_issuer','auth_time','provider_session','provider_token','session_exp','mfa'])||
   payload.aud!==audience||payload.operation!==operation||payload.tenant!==config.tenantId||payload.store!==config.storeId||payload.provider_issuer!==config.providerIssuer||payload.mfa!==true||
   typeof payload.session_hash!=='string'||!/^[a-f0-9]{64}$/.test(payload.session_hash)||!Number.isSafeInteger(payload.iat)||!Number.isSafeInteger(payload.exp)||
   issuedAt>Math.floor(Date.now()/1000)||expiresAt>issuedAt+15)throw new OwnerOperationUnavailable();
  const access=createOwnerSessionAccess(config,{
   ...dependencies,
   sessions:{async load(hash){return hash?validateStoredOwnerSession(await dependencies.sessions.loadHash(hash)):null;},
    async isActive(tenantId,hash){return dependencies.withTenantClient(tenantId,async client=>{
     const {rows}=await client.query('SELECT zayvi_owner_auth.session_is_active($1) AS active',[hash]);return rows.length===1&&rows[0].active===true;
    });}},
   async verifyProviderSession(session){
    const matches=session.issuer===payload.provider_issuer&&session.subject===payload.sub&&session.authenticationTime===payload.auth_time&&
     session.providerSessionId===payload.provider_session&&session.providerTokenId===payload.provider_token&&session.expiresAt===payload.session_exp;
    return {active:matches,mfaVerified:matches};
   },
  });
  const store=await access(payload.session_hash,'store.read',context=>dependencies.withTenantClient(context.tenantId,async client=>{
   if(expiresAt<=Math.floor(Date.now()/1000))throw new OwnerOperationUnavailable();
   const {rows}=await client.query('SELECT id,name,slug,status FROM public.stores WHERE tenant_id=$1::uuid AND id=$2::uuid',[context.tenantId,context.store.id]);
   if(rows.length!==1)throw new OwnerOperationUnavailable();return summary(rows[0],config);
  }));
  return {version:1,ok:true,store};
 }catch{throw new OwnerOperationUnavailable();}};
}
