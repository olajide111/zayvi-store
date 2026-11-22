import {createHash,randomBytes} from 'node:crypto';
import {withAuthorisedStore,type StoreDirectory,type StoreRequestContext} from './store-access';
import {tenantPermissionPolicy} from './tenant-permissions';
import type {TenantMembershipDirectory,TenantTransactionRunner} from './tenant-access';
import type {VerifiedOwnerLogin} from './owner-identity';
import {OwnerLoginError,type OwnerLoginTokens} from './owner-login';
export type OwnerSessionRecord = {
  sessionHash:string;
  providerSessionId:string;
  providerTokenId:string;
  expiresAt:number;
};
export type OwnerLoginCompletionDependencies = {
  verifyLoginTokens(tokens:OwnerLoginTokens,nonce:string):Promise<VerifiedOwnerLogin>;
  membershipDirectory:TenantMembershipDirectory;
  transactions:TenantTransactionRunner;
  stores:StoreDirectory;
  /** Persist only the hash and verified context using the SAME active tenant transaction.
   * Do not commit independently or store raw provider tokens. Requests must recheck membership/revocation. */
  writeSession(context:StoreRequestContext,record:OwnerSessionRecord):Promise<void>;
};
/** Prepared callback completion: verification -> membership/store checks -> committed session handle. */
export function createOwnerLoginCompletion(binding:{tenantId:string;storeId:string},dependencies:OwnerLoginCompletionDependencies){
  const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if(!uuid.test(binding.tenantId)||!uuid.test(binding.storeId)||typeof dependencies.verifyLoginTokens!=='function'||typeof dependencies.writeSession!=='function')throw new Error('Verified owner completion dependencies are required.');
  const tenantId=binding.tenantId,storeId=binding.storeId;
  return async(tokens:OwnerLoginTokens,nonce:string):Promise<{sessionToken:string}>=>{
    try{
      const verified=await dependencies.verifyLoginTokens(tokens,nonce),now=Math.floor(Date.now()/1000);
      if(verified.identity.mfaVerified!==true||!Number.isInteger(verified.expiresAt)||verified.expiresAt<=now||verified.expiresAt>now+3600||
        verified.providerSession.issuer!==verified.identity.issuer||verified.providerSession.subject!==verified.identity.subject||
        verified.providerSession.authenticationTime!==verified.identity.authenticationTime)throw new OwnerLoginError();
      return await withAuthorisedStore({token:tokens.accessToken,selectedTenantId:tenantId,boundStoreId:storeId,requiredPermission:'store.read',dependencies:{
        identityProvider:{async verifyAccessToken(){return {...verified.identity};}},
        membershipDirectory:dependencies.membershipDirectory,transactions:dependencies.transactions,stores:dependencies.stores,permissions:tenantPermissionPolicy,
        async execute(context){
          const sessionToken=randomBytes(32).toString('base64url');
          await dependencies.writeSession(context,{
            sessionHash:createHash('sha256').update(sessionToken).digest('hex'),
            providerSessionId:verified.providerSession.sessionId,providerTokenId:verified.providerSession.tokenId,expiresAt:verified.expiresAt,
          });
          return {sessionToken};
        },
      }});
    }catch{throw new OwnerLoginError();}
  };
}
