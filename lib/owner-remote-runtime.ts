import {timingSafeEqual} from 'node:crypto';
import type {JWTVerifyGetKey} from 'jose';
import type {OwnerRuntimeConfig} from './owner-auth-runtime';
import {createOwnerAuthHandlers} from './owner-auth-http';
import {createOwnerLogin} from './owner-login';
import {createOwnerLoginIdentityVerifier} from './owner-identity';
import {createEncryptedOwnerLoginAttempts} from './owner-login-attempts';
import {createRemoteOwnerAttemptStore,type OwnerAttemptRequest} from './owner-attempt-rpc';
import {createRemoteOwnerLoginCompletion,type OwnerCompletionRequest} from './owner-session-completion-rpc';
import {createRemoteOwnerSessionLifecycle,type OwnerLifecycleRequest} from './owner-session-lifecycle-rpc';
import {createOwnerAuthLimiter} from './owner-rate-limit';
import {createRemoteOwnerLimitStore,type OwnerLimitRequest} from './owner-rate-limit-rpc';
import {createRemoteOwnerStoreSummary,type OwnerSummaryRequest,type OwnerStoreSummary} from './owner-store-summary-rpc';
import type {StoredOwnerSession} from './owner-sessions';
import {TenantAccessError} from './tenant-access';
export type OwnerPrivateRequest=OwnerAttemptRequest|OwnerCompletionRequest|OwnerLifecycleRequest|OwnerLimitRequest|OwnerSummaryRequest;
export type OwnerRemoteDependencies={
 keys:{attemptEncryption:Uint8Array;completionProof:Uint8Array;operationProof:Uint8Array;limiterHash:Uint8Array};
 /** Pinned, private IAM transport with bounded timeouts/payloads and no retries. */
 invoke(request:OwnerPrivateRequest):Promise<unknown>;
 identifyConnection(request:Request):Promise<string|null>;
 verifyLoginAssurance:Parameters<typeof createOwnerLoginIdentityVerifier>[1];
 verifyCurrentAssurance(session:StoredOwnerSession):Promise<{active:boolean;mfaVerified:boolean}>;
 identityKeys?:JWTVerifyGetKey;providerExchange?:typeof fetch;
};
type Runtime={enabled:boolean;handlers:ReturnType<typeof createOwnerAuthHandlers>;readStore(token:string|undefined):Promise<OwnerStoreSummary>};
/** Prepared public-network runtime. No private database client, arbitrary SQL or
 * business callback crosses this boundary. Only named readStore is exposed.
 * Construction does not mount routes or enable the deployed sign-in path.
 */
export function createPreviewRemoteOwnerRuntime(input:OwnerRuntimeConfig,dependencies?:OwnerRemoteDependencies):Runtime{
 const context={key:input.context.key,defaultPath:input.context.defaultPath,allowedPaths:[...input.context.allowedPaths]};
 if(input.mode!=='preview'||input.deployment!=='preview')return {enabled:false,
  handlers:createOwnerAuthHandlers({origin:input.origin,context,enabled:false}),
  async readStore(){throw new TenantAccessError('UNAUTHENTICATED','Owner access is not enabled.');}};
 if(!dependencies||typeof dependencies.invoke!=='function'||typeof dependencies.identifyConnection!=='function'||
  typeof dependencies.verifyLoginAssurance!=='function'||typeof dependencies.verifyCurrentAssurance!=='function')throw new Error('Verified remote owner runtime adapters are required.');
 const config={...input,binding:{...input.binding},provider:{...input.provider,requiredScopes:[...input.provider.requiredScopes]},additionalScopes:[...(input.additionalScopes??[])]};
 const values=[dependencies.keys?.attemptEncryption,dependencies.keys?.completionProof,dependencies.keys?.operationProof,dependencies.keys?.limiterHash];
 if(values.some(key=>!(key instanceof Uint8Array)||key.byteLength!==32))throw new Error('Four dedicated owner runtime keys are required.');
 const keys=values.map(key=>Buffer.from(key));
 for(let i=0;i<keys.length;i++)for(let j=i+1;j<keys.length;j++)if(timingSafeEqual(keys[i],keys[j]))throw new Error('Owner runtime keys must be distinct.');
 const invoke=dependencies.invoke,verifyCurrentAssurance=dependencies.verifyCurrentAssurance;
 const binding={deployment:config.deployment,providerIssuer:`https://cognito-idp.eu-west-2.amazonaws.com/${config.provider.userPoolId}`,...config.binding};
 const attempts=createEncryptedOwnerLoginAttempts(createRemoteOwnerAttemptStore(invoke),keys[0]);
 const verifyLoginTokens=createOwnerLoginIdentityVerifier(config.provider,dependencies.verifyLoginAssurance,dependencies.identityKeys);
 const finish=createRemoteOwnerLoginCompletion(binding,keys[1],{verifyLoginTokens,invoke});
 const sessions=createRemoteOwnerSessionLifecycle(binding,invoke);
 const readStore=createRemoteOwnerStoreSummary(binding,keys[2],{loadSession:sessions.load,verifyCurrentAssurance,invoke});
 const limit=createOwnerAuthLimiter({key:keys[3],identify:dependencies.identifyConnection,store:createRemoteOwnerLimitStore(invoke)});
 const flow=createOwnerLogin({appOrigin:config.origin,clientId:config.provider.clientId,domainPrefix:config.domainPrefix,context,
  scopes:[...new Set(['openid',...config.provider.requiredScopes,...config.additionalScopes])]},
  {attempts,finishVerifiedSignIn:finish,fetcher:dependencies.providerExchange});
 return {enabled:true,readStore,handlers:createOwnerAuthHandlers({origin:config.origin,context,enabled:true},
  {flow,sessions,limit,authorise:async token=>{await readStore(token);}})};
}
