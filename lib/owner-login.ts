import {createOwnerLoginContext,type OwnerLoginContext} from './owner-login-context';
import {createHash,randomBytes,timingSafeEqual} from 'node:crypto';

export type OwnerLoginAttempt = {
  contextKey: string;
  stateHash: string;
  browserHash: string;
  verifier: string;
  nonce: string;
  createdAt: number;
  expiresAt: number;
  returnTo: string;
  registrationStoreName?: string;
};
export interface OwnerLoginAttempts {
  /** Persist server-side with an expiry; do not send the verifier to browser storage. */
  create(attempt: OwnerLoginAttempt): Promise<void>;
  /** Atomically consume only an unexpired row matching BOTH hashes. No separate read/delete. */
  consume(stateHash: string,browserHash: string,now: number): Promise<OwnerLoginAttempt|null>;
}
export type OwnerLoginTokens = {accessToken:string;idToken:string;refreshToken?:string;expiresIn:number};
export type OwnerLoginConfig = {domainPrefix:string;clientId:string;appOrigin:string;scopes:readonly string[];context:OwnerLoginContext};
export type OwnerLoginDependencies = {
  attempts: OwnerLoginAttempts;
  fetcher?: typeof fetch;
  now?: ()=>number;
  /** Verify both tokens, nonce, shared subject, revocation and MFA, then store a server session.
   * Must resolve authorised membership before returning an opaque session handle; no admin-password cookie. */
  finishVerifiedSignIn(tokens:OwnerLoginTokens,expectedNonce:string):Promise<{sessionToken:string}>;
};
export type MerchantRegistrationDependencies = Omit<OwnerLoginDependencies, 'finishVerifiedSignIn'> & {
  finishVerifiedRegistration(tokens:OwnerLoginTokens,expectedNonce:string,storeName:string):Promise<{sessionToken:string}>;
};
export const MERCHANT_REGISTRATION_CALLBACK = '/api/owner/registration/callback';

function validStoreName(value:unknown):value is string {
  return typeof value==='string' && value.length>0 && value.length<=80 && value===value.trim() && !/\p{Cc}/u.test(value);
}

export class OwnerLoginError extends Error {
  constructor(){super('Sign-in could not complete. Please start again.');this.name='OwnerLoginError';}
}
const secret=()=>randomBytes(32).toString('base64url');
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
const matches=(left:string,right:string)=>{const a=Buffer.from(left),b=Buffer.from(right);return a.length===b.length&&timingSafeEqual(a,b);};
const opaque=(value:unknown):value is string=>typeof value==='string'&&/^[A-Za-z0-9_-]{43,128}$/.test(value);
const token=(value:unknown):value is string=>typeof value==='string'&&value.length>0&&value.length<=16384;
/** Prepared server-only PKCE orchestration. Nothing is activated by constructing these flows. */
export function createOwnerLogin(config:OwnerLoginConfig,dependencies:OwnerLoginDependencies){
  if(typeof dependencies.finishVerifiedSignIn!=='function')throw new Error('Invalid owner sign-in configuration.');
  const flow=createHostedOwnerFlow(config,{
    ...dependencies,
    finish:(tokens,nonce)=>dependencies.finishVerifiedSignIn(tokens,nonce),
  },false);
  return {begin:(returnTo?:string)=>flow.begin(returnTo),complete:flow.complete};
}

export function createMerchantRegistrationFlow(config:OwnerLoginConfig,dependencies:MerchantRegistrationDependencies){
  if(!config.scopes.includes('email')||typeof dependencies.finishVerifiedRegistration!=='function'){
    throw new Error('Complete merchant registration configuration is required.');
  }
  const flow=createHostedOwnerFlow(config,{
    ...dependencies,
    finish:(tokens,nonce,storeName)=>{
      if(!validStoreName(storeName))throw new OwnerLoginError();
      return dependencies.finishVerifiedRegistration(tokens,nonce,storeName);
    },
  },true);
  return {begin:(storeName:string)=>flow.begin(undefined,storeName),complete:flow.complete};
}

type HostedOwnerDependencies = Omit<OwnerLoginDependencies,'finishVerifiedSignIn'> & {
  finish(tokens:OwnerLoginTokens,nonce:string,storeName?:string):Promise<{sessionToken:string}>;
};

function createHostedOwnerFlow(config:OwnerLoginConfig,dependencies:HostedOwnerDependencies,registration:boolean){
  const origin=new URL(config.appOrigin),context=createOwnerLoginContext(config.context);
  if(origin.protocol!=='https:'||origin.origin!==config.appOrigin||origin.username||origin.password||
    !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(config.domainPrefix)||
    !/^[a-z0-9]{1,128}$/.test(config.clientId)||!config.scopes.includes('openid')||
    config.scopes.some(scope=>!scope||/\s/.test(scope)))throw new Error('Invalid owner sign-in configuration.');
  const redirectUri=origin.origin+(registration?MERCHANT_REGISTRATION_CALLBACK:'/api/owner/auth/callback');
  const provider=`https://${config.domainPrefix}.auth.eu-west-2.amazoncognito.com`;
  const clientId=config.clientId,scopes=[...new Set(config.scopes)];
  const fetcher=dependencies.fetcher??fetch,now=dependencies.now??(()=>Math.floor(Date.now()/1000));
  return {
    async begin(returnTo=context.defaultPath,storeName?:string){
      const registrationStoreName=typeof storeName==='string'?storeName.trim():undefined;
      if(!context.allows(returnTo)||(registration&&!validStoreName(registrationStoreName)))throw new OwnerLoginError();
      const state=secret(),browserBinding=secret(),verifier=secret(),nonce=secret(),createdAt=now();
      if(!Number.isInteger(createdAt)||createdAt<=0)throw new OwnerLoginError();
      const attempt={contextKey:context.key,stateHash:hash(state),browserHash:hash(browserBinding),verifier,nonce,createdAt,expiresAt:createdAt+600,returnTo,...(registration?{registrationStoreName}:{})};
      try{await dependencies.attempts.create(attempt);}catch{throw new OwnerLoginError();}
      const url=new URL(registration?'/signup':'/oauth2/authorize',provider);
      url.search=new URLSearchParams({response_type:'code',client_id:clientId,redirect_uri:redirectUri,scope:scopes.join(' '),
        state,nonce,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'}).toString();
      // The HTTP adapter must set browserBinding in an HttpOnly, Secure, SameSite=Lax,
      // host-only cookie with Path=/ and Max-Age=600. Never return it in page JSON.
      return {authorizationUrl:url.toString(),browserBinding,maxAge:600};
    },
    async complete(parameters:URLSearchParams,browserBinding:string|undefined){
      try {
        const state=parameters.get('state'),code=parameters.get('code'),error=parameters.get('error');
        if(parameters.getAll('state').length!==1||!opaque(state)||!opaque(browserBinding)||
          parameters.getAll('code').length>1||parameters.getAll('error').length>1||
          (!!code===!!error)||(!error&&(!code||code.length>4096)))throw new OwnerLoginError();
        const current=now();
        const attempt=await dependencies.attempts.consume(hash(state),hash(browserBinding),current);
        if(!attempt||attempt.contextKey!==context.key||!matches(attempt.stateHash,hash(state))||!matches(attempt.browserHash,hash(browserBinding))||
          attempt.expiresAt<=current||attempt.createdAt>current||attempt.expiresAt-attempt.createdAt!==600||
          !opaque(attempt.verifier)||!opaque(attempt.nonce)||!context.allows(attempt.returnTo)||
          (registration?!validStoreName(attempt.registrationStoreName):attempt.registrationStoreName!==undefined)||error)throw new OwnerLoginError();
        const response=await fetcher(`${provider}/oauth2/token`,{
          method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),
          headers:{'Content-Type':'application/x-www-form-urlencoded','Accept':'application/json'},
          body:new URLSearchParams({grant_type:'authorization_code',client_id:clientId,code:code!,redirect_uri:redirectUri,code_verifier:attempt.verifier}),
        });
        if(!response.ok)throw new OwnerLoginError();
        const data=await response.json();
        if(!data||data.token_type!=='Bearer'||!token(data.access_token)||!token(data.id_token)||
          !Number.isInteger(data.expires_in)||data.expires_in<=0||data.expires_in>3600||
          (data.refresh_token!==undefined&&!token(data.refresh_token)))throw new OwnerLoginError();
        const session=await dependencies.finish({accessToken:data.access_token,idToken:data.id_token,
          ...(data.refresh_token?{refreshToken:data.refresh_token}:{}),expiresIn:data.expires_in},attempt.nonce,attempt.registrationStoreName);
        if(!opaque(session.sessionToken))throw new OwnerLoginError();
        return {sessionToken:session.sessionToken,returnTo:attempt.returnTo};
      }catch{throw new OwnerLoginError();}
    },
  };
}
