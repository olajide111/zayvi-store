import {createHash,timingSafeEqual} from 'node:crypto';
import type {OwnerLoginTokens} from './owner-login';
import {createRemoteJWKSet,jwtVerify,type JWTVerifyGetKey} from 'jose';
import {TenantAccessError,type IdentityProviderAdapter} from './tenant-access';

export type VerifiedOwnerSession = {
  issuer: string;
  subject: string;
  tokenId: string;
  sessionId: string;
  authenticationTime: number;
};
export type OwnerIdentityConfig = {
  /** Trusted server settings; never use an issuer or key URL supplied by a token. */
  userPoolId: string;
  clientId: string;
  requiredScopes: readonly string[];
  resourceAudience?: string;
};
export type OwnerSessionVerifier = (session: VerifiedOwnerSession) => Promise<{
  active: boolean;
  mfaVerified: boolean;
}>;
const userSubject=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const denied=()=>new TenantAccessError('UNAUTHENTICATED','A verified owner sign-in is required.');
/**
 * Prepared Cognito access-token adapter. Creating it provisions no AWS resources
 * and does not replace the existing admin session. Session revocation/assurance
 * must be checked by a trusted server adapter after cryptographic verification.
 * Database membership remains authoritative for roles and store permissions.
 */
function createOwnerTokenVerifier(config: OwnerIdentityConfig, trustedKeys?: JWTVerifyGetKey) {
  const pool=/^(eu-west-2)_[A-Za-z0-9]+$/.exec(config.userPoolId);
  if (!pool || !/^[a-z0-9]{1,128}$/.test(config.clientId) || !config.requiredScopes.length ||
      config.requiredScopes.some(scope=>!scope || /\s/.test(scope)) ||
      (config.resourceAudience!==undefined && !config.resourceAudience.trim())) {
    throw new Error('Owner identity configuration is incomplete or invalid.');
  }
  // Copy trusted settings so later mutation cannot change the policy.
  const issuer=`https://cognito-idp.${pool[1]}.amazonaws.com/${config.userPoolId}`;
  const clientId=config.clientId,scopes=[...config.requiredScopes],audience=config.resourceAudience;
  const keys=trustedKeys??createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`),{
    timeoutDuration:5000,cooldownDuration:30000,cacheMaxAge:600000,
  });
  return {
    async verifyAccessTokenSession(token:string) {
      try {
        if (typeof token!=='string'||!token||token.length>16384)throw denied();
        const {payload,protectedHeader}=await jwtVerify(token,keys,{
          issuer,algorithms:['RS256'],typ:'JWT',maxTokenAge:3600,clockTolerance:5,
          ...(audience?{audience}:{}),
          requiredClaims:['sub','exp','iat','auth_time','token_use','client_id','scope','username','jti','origin_jti'],
        });
        const now=Math.floor(Date.now()/1000);
        if (payload.token_use!=='access'||payload.client_id!==clientId||
            typeof payload.sub!=='string'||!userSubject.test(payload.sub)||
            typeof payload.username!=='string'||!payload.username.trim()||
            typeof protectedHeader.kid!=='string'||!protectedHeader.kid||
            typeof payload.jti!=='string'||!payload.jti.trim()||
            typeof payload.origin_jti!=='string'||!payload.origin_jti.trim()||
            typeof payload.auth_time!=='number'||!Number.isInteger(payload.auth_time)||payload.auth_time<=0||
            typeof payload.iat!=='number'||typeof payload.exp!=='number'||
            !Number.isInteger(payload.iat)||!Number.isInteger(payload.exp)||
            payload.auth_time>payload.iat||payload.auth_time>now+5||payload.exp<=payload.iat||payload.exp-payload.iat>3600||
            (!audience&&payload.aud!==undefined)||typeof payload.scope!=='string')throw denied();
        const granted=new Set(payload.scope.split(/\s+/));
        if (!scopes.every(scope=>granted.has(scope)))throw denied();
        return {session:{issuer,subject:payload.sub,tokenId:payload.jti,sessionId:payload.origin_jti,authenticationTime:payload.auth_time},expiresAt:payload.exp};
      } catch {
        // Never expose raw JWTs, library diagnostics or provider responses.
        throw denied();
      }
    },
    async verifyIdToken(token:string,nonce:string,accessToken:string,session:VerifiedOwnerSession){
      try{
        if(typeof token!=='string'||!token||token.length>16384||!/^[A-Za-z0-9_-]{43,128}$/.test(nonce))throw denied();
        const {payload,protectedHeader}=await jwtVerify(token,keys,{
          issuer,audience:clientId,algorithms:['RS256'],typ:'JWT',maxTokenAge:3600,clockTolerance:5,
          requiredClaims:['sub','exp','iat','auth_time','token_use','nonce','jti','origin_jti'],
        });
        // Cognito ID tokens target exactly one client; other audiences/azp are not accepted.
        if(payload.aud!==clientId||(payload.azp!==undefined&&payload.azp!==clientId)||payload.token_use!=='id'||
          payload.sub!==session.subject||payload.auth_time!==session.authenticationTime||payload.origin_jti!==session.sessionId||
          typeof payload.jti!=='string'||!payload.jti.trim()||typeof protectedHeader.kid!=='string'||!protectedHeader.kid||
          typeof payload.nonce!=='string'||payload.nonce.length!==nonce.length||
          !timingSafeEqual(Buffer.from(payload.nonce),Buffer.from(nonce))||
          !Number.isInteger(payload.iat)||!Number.isInteger(payload.exp)||
          typeof payload.iat!=='number'||typeof payload.exp!=='number'||payload.exp<=payload.iat||payload.exp-payload.iat>3600||
          session.authenticationTime>payload.iat)throw denied();
        if(payload.at_hash!==undefined){
          const expected=createHash('sha256').update(accessToken).digest().subarray(0,16).toString('base64url');
          if(typeof payload.at_hash!=='string'||payload.at_hash!==expected)throw denied();
        }
        return payload.exp;
      }catch{throw denied();}
    },
  };
}

/** Access to an existing session still requires a trusted revocation/MFA check. */
export function createOwnerIdentityProvider(config:OwnerIdentityConfig,verifySession:OwnerSessionVerifier,
  trustedKeys?:JWTVerifyGetKey):IdentityProviderAdapter<string>{
  if(typeof verifySession!=='function')throw new Error('Owner session verification is required.');
  const verifier=createOwnerTokenVerifier(config,trustedKeys);
  return {async verifyAccessToken(token){
    try{
      const {session}=await verifier.verifyAccessTokenSession(token);
      const assurance=await verifySession(session);
      if(assurance.active!==true||assurance.mfaVerified!==true)throw denied();
      return {issuer:session.issuer,subject:session.subject,authenticationTime:session.authenticationTime,mfaVerified:true};
    }catch{throw denied();}
  }};
}
export type VerifiedOwnerLogin = {
  identity:{issuer:string;subject:string;authenticationTime:number;mfaVerified:true};
  providerSession:VerifiedOwnerSession;
  expiresAt:number;
};
/** Verifies a returned token pair before any session can be created. */
export function createOwnerLoginIdentityVerifier(config:OwnerIdentityConfig,
  verifySession:(session:VerifiedOwnerSession,tokens:Pick<OwnerLoginTokens,'accessToken'|'idToken'>)=>Promise<{active:boolean;mfaVerified:boolean}>,
  trustedKeys?:JWTVerifyGetKey){
  if(typeof verifySession!=='function')throw new Error('Owner session verification is required.');
  const verifier=createOwnerTokenVerifier(config,trustedKeys);
  return async(tokens:OwnerLoginTokens,nonce:string):Promise<VerifiedOwnerLogin>=>{
    try{
      const access=await verifier.verifyAccessTokenSession(tokens.accessToken);
      const idExpiry=await verifier.verifyIdToken(tokens.idToken,nonce,tokens.accessToken,access.session);
      const expiresAt=Math.min(access.expiresAt,idExpiry);
      if(expiresAt<=Math.floor(Date.now()/1000))throw denied();
      const assurance=await verifySession({...access.session},{accessToken:tokens.accessToken,idToken:tokens.idToken});
      if(assurance.active!==true||assurance.mfaVerified!==true)throw denied();
      return {identity:{issuer:access.session.issuer,subject:access.session.subject,authenticationTime:access.session.authenticationTime,mfaVerified:true},providerSession:access.session,expiresAt};
    }catch{throw denied();}
  };
}
