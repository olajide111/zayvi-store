import {createHash,randomBytes} from 'node:crypto';
import {SignJWT,jwtVerify} from 'jose';
import type {VerifiedOwnerLogin} from './owner-identity';
import {OwnerLoginError,type OwnerLoginTokens} from './owner-login';
import {createVerifiedOwnerSessionWriter,type OwnerLoginCompletionDependencies} from './owner-login-completion';

export type OwnerCompletionConfig={deployment:string;providerIssuer:string;tenantId:string;storeId:string};
export type OwnerCompletionRequest={version:1;operation:'owner.session.complete';proof:string};
type Dependencies=Omit<OwnerLoginCompletionDependencies,'verifyLoginTokens'>;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const proofIssuer='urn:zayvi:preview:owner-web',audience='urn:zayvi:preview:owner-db',typ='zayvi-owner-completion+jwt';
const record=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const exact=(value:Record<string,unknown>,keys:string[])=>Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
const text=(value:unknown,max:number):value is string=>typeof value==='string'&&value.length>0&&value.length<=max&&value.trim()===value;
function settings(config:OwnerCompletionConfig,secret:Uint8Array){
  if(config.deployment!=='preview'||!/^https:\/\/cognito-idp\.eu-west-2\.amazonaws\.com\/eu-west-2_[A-Za-z0-9]+$/.test(config.providerIssuer)||
    !uuid.test(config.tenantId)||!uuid.test(config.storeId)||secret.byteLength!==32)throw new Error('Pinned Preview completion configuration and dedicated 32-byte proof key required.');
  return {config:{...config},key:Buffer.from(secret)};
}
function verified(value:VerifiedOwnerLogin,issuer:string){
  const now=Math.floor(Date.now()/1000),identity=value.identity,session=value.providerSession;
  if(identity.issuer!==issuer||!uuid.test(identity.subject)||identity.mfaVerified!==true||
    !Number.isSafeInteger(identity.authenticationTime)||identity.authenticationTime<=0||identity.authenticationTime>now||
    session.issuer!==identity.issuer||session.subject!==identity.subject||session.authenticationTime!==identity.authenticationTime||
    !text(session.sessionId,512)||!text(session.tokenId,512)||
    !Number.isSafeInteger(value.expiresAt)||value.expiresAt<=now||value.expiresAt>now+3600)throw new OwnerLoginError();
}
/** Web-side service. Only a verified token pair with current MFA/revocation assurance
 * can produce a proof. The raw session handle and provider tokens never cross RPC.
 * Key is dedicated to this boundary, never the cookie/admin/attempt encryption key.
 */
export function createRemoteOwnerLoginCompletion(input:OwnerCompletionConfig,secret:Uint8Array,dependencies:{
  verifyLoginTokens:OwnerLoginCompletionDependencies['verifyLoginTokens'];
  /** Pinned private IAM invocation; no automatic retries, public routes or caller-selected function. */
  invoke(request:OwnerCompletionRequest):Promise<unknown>;
}){
  const {config,key}=settings(input,secret);
  return async(tokens:OwnerLoginTokens,nonce:string):Promise<{sessionToken:string}>=>{
    try{
      const login=await dependencies.verifyLoginTokens(tokens,nonce);verified(login,config.providerIssuer);
      const sessionToken=randomBytes(32).toString('base64url'),sessionHash=createHash('sha256').update(sessionToken).digest('hex');
      const now=Math.floor(Date.now()/1000);
      const proof=await new SignJWT({provider_issuer:login.identity.issuer,auth_time:login.identity.authenticationTime,mfa:true,
        provider_session:login.providerSession.sessionId,provider_token:login.providerSession.tokenId,
        session_exp:login.expiresAt,tenant:config.tenantId,store:config.storeId})
        .setProtectedHeader({alg:'HS256',typ}).setIssuer(proofIssuer).setAudience(audience).setSubject(login.identity.subject)
        .setJti(sessionHash).setIssuedAt(now).setExpirationTime(Math.min(now+30,login.expiresAt)).sign(key);
      const reply=await dependencies.invoke({version:1,operation:'owner.session.complete',proof});
      if(!record(reply)||!exact(reply,['version','ok','expiresAt'])||reply.version!==1||reply.ok!==true||reply.expiresAt!==login.expiresAt)throw new OwnerLoginError();
      return {sessionToken};
    }catch{throw new OwnerLoginError();}
  };
}
/** Private dispatcher core, not an HTTP/Lambda entry. Requires IAM-restricted invocation
 * and a separate dedicated proof key. Verifies the web runtime's short-lived statement
 * before database membership/role/store checks and session insertion in ONE transaction.
 */
export function createPrivateOwnerSessionCompletion(input:OwnerCompletionConfig,secret:Uint8Array,dependencies:Dependencies){
  const {config,key}=settings(input,secret),write=createVerifiedOwnerSessionWriter(config,dependencies);
  return async(request:unknown):Promise<{version:1;ok:true;expiresAt:number}>=>{
    try{
      if(!record(request)||!exact(request,['version','operation','proof'])||request.version!==1||request.operation!=='owner.session.complete'||!text(request.proof,8192))throw new OwnerLoginError();
      const {payload}=await jwtVerify(request.proof,key,{issuer:proofIssuer,audience,algorithms:['HS256'],typ,maxTokenAge:30,
        requiredClaims:['iat','exp','jti','sub','provider_issuer','auth_time','mfa','provider_session','provider_token','session_exp','tenant','store']});
      const now=Math.floor(Date.now()/1000);
      if(!exact(payload,['iss','aud','sub','iat','exp','jti','provider_issuer','auth_time','mfa','provider_session','provider_token','session_exp','tenant','store'])||
        payload.aud!==audience||payload.tenant!==config.tenantId||payload.store!==config.storeId||payload.provider_issuer!==config.providerIssuer||payload.mfa!==true||
        typeof payload.jti!=='string'||!/^[a-f0-9]{64}$/.test(payload.jti)||typeof payload.sub!=='string'||
        typeof payload.iat!=='number'||!Number.isSafeInteger(payload.iat)||payload.iat>now||
        typeof payload.exp!=='number'||!Number.isSafeInteger(payload.exp)||payload.exp<=payload.iat||payload.exp-payload.iat>30||
        !text(payload.provider_session,512)||!text(payload.provider_token,512)||typeof payload.auth_time!=='number'||
        typeof payload.session_exp!=='number'||payload.exp>payload.session_exp)throw new OwnerLoginError();
      const identity={issuer:config.providerIssuer,subject:payload.sub,authenticationTime:payload.auth_time,mfaVerified:true as const};
      const login:VerifiedOwnerLogin={identity,providerSession:{...identity,sessionId:payload.provider_session,tokenId:payload.provider_token},expiresAt:payload.session_exp};
      verified(login,config.providerIssuer);
      // The proof jti is the session hash, so a replay hits the database primary key.
      // A caller cannot reuse one proof to mint a different session or select a role.
      await write(login,{sessionHash:payload.jti,providerSessionId:payload.provider_session,providerTokenId:payload.provider_token,expiresAt:login.expiresAt});
      return {version:1,ok:true,expiresAt:login.expiresAt};
    }catch{throw new OwnerLoginError();}
  };
}
