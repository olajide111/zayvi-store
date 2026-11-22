import {withAuthorisedStore,type StoreDirectory,type StoreRequestContext} from './store-access';
import {TenantAccessError,type TenantMembershipDirectory,type TenantTransactionRunner} from './tenant-access';
import {tenantPermissionPolicy,type TenantPermission} from './tenant-permissions';
import type {StoredOwnerSession} from './owner-sessions';
const denied=()=>new TenantAccessError('UNAUTHENTICATED','A verified owner sign-in is required.');
/** Server session access. A cookie lookup alone never authorises a store operation. */
export function createOwnerSessionAccess(binding:{tenantId:string;storeId:string},dependencies:{
  sessions:{load(token:string|undefined):Promise<StoredOwnerSession|null>;isActive(tenantId:string,token:string):Promise<boolean>};
  verifyProviderSession(session:StoredOwnerSession):Promise<{active:boolean;mfaVerified:boolean}>;
  membershipDirectory:TenantMembershipDirectory;transactions:TenantTransactionRunner;stores:StoreDirectory;
}){
  const tenantId=binding.tenantId,storeId=binding.storeId;
  return async<T>(sessionToken:string|undefined,permission:TenantPermission,execute:(context:StoreRequestContext)=>Promise<T>):Promise<T>=>{
    const session=await dependencies.sessions.load(sessionToken);
    if(!session||!sessionToken||session.tenantId!==tenantId||session.storeId!==storeId)throw denied();
    const assurance=await dependencies.verifyProviderSession({...session});
    if(assurance.active!==true||assurance.mfaVerified!==true)throw denied();
    return withAuthorisedStore({token:sessionToken,selectedTenantId:tenantId,boundStoreId:storeId,requiredPermission:permission,dependencies:{
      identityProvider:{async verifyAccessToken(){return {issuer:session.issuer,subject:session.subject,authenticationTime:session.authenticationTime,mfaVerified:true};}},
      membershipDirectory:dependencies.membershipDirectory,transactions:dependencies.transactions,stores:dependencies.stores,permissions:tenantPermissionPolicy,
      async execute(context){
        if(context.membershipId!==session.membershipId||context.role!==session.role||!await dependencies.sessions.isActive(tenantId,sessionToken))throw denied();
        return execute(context);
      },
    }});
  };
}
