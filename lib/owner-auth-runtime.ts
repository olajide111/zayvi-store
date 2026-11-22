import type {JWTVerifyGetKey} from 'jose';
import {createOwnerAuthHandlers,type OwnerAuthHttpDependencies} from './owner-auth-http';
import {createOwnerLogin,type OwnerLoginConfig} from './owner-login';
import {createOwnerLoginIdentityVerifier,type OwnerIdentityConfig} from './owner-identity';
import {createOwnerLoginCompletion} from './owner-login-completion';
import {createPostgresOwnerLoginAttempts} from './owner-login-attempts';
import {createStoreDatabaseAdapters,type StoreDatabaseClient,type StoreDatabasePool} from './store-database';
import {createTenantMembershipDirectory} from './tenant-membership-directory';
import {createPostgresOwnerSessions,type StoredOwnerSession} from './owner-sessions';
import {createOwnerSessionAccess} from './owner-session-access';
import {TenantAccessError} from './tenant-access';
export type OwnerRuntimeConfig={
  /** Trusted deployment configuration, never request-supplied. Production is not supported by this activation path. */
  mode?:'disabled'|'preview';deployment:string;
  origin:string;context:OwnerLoginConfig['context'];
  binding:{tenantId:string;storeId:string};
  provider:OwnerIdentityConfig;domainPrefix:string;additionalScopes?:readonly string[];
};
export type OwnerRuntimeDependencies={
  /** Both clients must use the restricted application role on the private database path. */
  pool:StoreDatabasePool;lookup:Pick<StoreDatabaseClient,'query'>;encryptionKey:Uint8Array;
  verifyLoginAssurance:Parameters<typeof createOwnerLoginIdentityVerifier>[1];
  verifyCurrentAssurance(session:StoredOwnerSession):Promise<{active:boolean;mfaVerified:boolean}>;
  limit:OwnerAuthHttpDependencies['limit'];
  /** Trusted server adapters only; tokens/headers cannot choose a key server or token endpoint. */
  identityKeys?:JWTVerifyGetKey;providerExchange?:typeof fetch;
};
type OwnerRuntime={enabled:boolean;handlers:ReturnType<typeof createOwnerAuthHandlers>;authorise:ReturnType<typeof createOwnerSessionAccess>};
/** Composes the tested service. It does not mount routes, provision AWS or apply SQL. */
export function createPreviewOwnerAuthRuntime(config:OwnerRuntimeConfig,dependencies?:OwnerRuntimeDependencies):OwnerRuntime{
  const enabled=config.mode==='preview'&&config.deployment==='preview';
  const context={key:config.context.key,defaultPath:config.context.defaultPath,allowedPaths:[...config.context.allowedPaths]};
  if(!enabled)return {enabled:false,handlers:createOwnerAuthHandlers({origin:config.origin,context,enabled:false}),
    authorise:async()=>{throw new TenantAccessError('UNAUTHENTICATED','Owner access is not enabled.');}};
  if(!dependencies||typeof dependencies.verifyLoginAssurance!=='function'||typeof dependencies.verifyCurrentAssurance!=='function'||typeof dependencies.limit!=='function')throw new Error('Verified owner runtime adapters are required.');
  const database=createStoreDatabaseAdapters(dependencies.pool);
  const directory=createTenantMembershipDirectory({discovery:dependencies.lookup,withTenantClient:database.withTenantClient});
  const sessions=createPostgresOwnerSessions({lookup:dependencies.lookup,withTenantClient:database.withTenantClient});
  const attempts=createPostgresOwnerLoginAttempts(dependencies.lookup,dependencies.encryptionKey);
  const verifyLoginTokens=createOwnerLoginIdentityVerifier(config.provider,dependencies.verifyLoginAssurance,dependencies.identityKeys);
  const binding=Object.freeze({...config.binding});
  const finish=createOwnerLoginCompletion(binding,{...database,membershipDirectory:directory,verifyLoginTokens,writeSession:sessions.writeSession});
  const flow=createOwnerLogin({appOrigin:config.origin,clientId:config.provider.clientId,domainPrefix:config.domainPrefix,context,
    scopes:[...new Set(['openid',...config.provider.requiredScopes,...(config.additionalScopes??[])])]},
    {attempts,finishVerifiedSignIn:finish,fetcher:dependencies.providerExchange});
  const authorise=createOwnerSessionAccess(binding,{...database,membershipDirectory:directory,sessions,verifyProviderSession:dependencies.verifyCurrentAssurance});
  const handlers=createOwnerAuthHandlers({origin:config.origin,context,enabled:true},{flow,sessions,limit:dependencies.limit,
    authorise:async token=>{await authorise(token,'store.read',async()=>{});}});
  return {enabled:true,handlers,authorise};
}
