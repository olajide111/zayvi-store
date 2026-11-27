import {createHash} from 'node:crypto';
import type {StoreDatabaseClient} from './store-database';
import type {StoreRequestContext} from './store-access';
import type {OwnerSessionRecord} from './owner-login-completion';
import {isTenantRole} from './tenant-permissions';
export type StoredOwnerSession={tenantId:string;storeId:string;membershipId:string;issuer:string;subject:string;role:string;authenticationTime:number;providerSessionId:string;providerTokenId:string;expiresAt:number};
type Client=Pick<StoreDatabaseClient,'query'>;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const validHandle=(value:unknown):value is string=>typeof value==='string'&&/^[A-Za-z0-9_-]{43}$/.test(value);
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
export type OwnerSessionLifecycleStore={loadHash(sessionHash:string):Promise<StoredOwnerSession|null>;revokeHash(sessionHash:string):Promise<void>};
/** Private database lifecycle primitive. It does not authorise store operations. */
export function createPostgresOwnerSessionLifecycle(lookup:Client):OwnerSessionLifecycleStore{
  const validate=(value:string)=>{if(!/^[a-f0-9]{64}$/.test(value))throw new Error('Invalid owner session hash.');};
  return {
    async loadHash(sessionHash){
      validate(sessionHash);
      const {rows}=await lookup.query('SELECT * FROM zayvi_owner_auth.resolve_session($1)',[sessionHash]);
      if(!rows.length)return null;
      const r=rows[0],expiresAt=Math.floor(new Date(r.expires_at as string|Date).getTime()/1000),authenticationTime=Number(r.authentication_time);
      if(rows.length!==1||![r.tenant_id,r.store_id,r.membership_id].every(value=>typeof value==='string'&&uuid.test(value))||
        ![r.issuer,r.subject,r.provider_session_id,r.provider_token_id].every(value=>typeof value==='string'&&value.trim())||
        typeof r.role!=='string'||!isTenantRole(r.role)||!Number.isSafeInteger(authenticationTime)||authenticationTime<=0||
        !Number.isSafeInteger(expiresAt)||expiresAt<=Math.floor(Date.now()/1000))throw new Error('Invalid stored owner session.');
      return {tenantId:r.tenant_id as string,storeId:r.store_id as string,membershipId:r.membership_id as string,issuer:r.issuer as string,subject:r.subject as string,role:r.role,
        authenticationTime,providerSessionId:r.provider_session_id as string,providerTokenId:r.provider_token_id as string,expiresAt};
    },
    async revokeHash(sessionHash){
      validate(sessionHash);
      await lookup.query('SELECT zayvi_owner_auth.revoke_session($1)',[sessionHash]);
    },
  };
}
export function createPostgresOwnerSessions(dependencies:{lookup:Client;withTenantClient<T>(tenantId:string,work:(client:Client)=>Promise<T>):Promise<T>}){
  const lifecycle=createPostgresOwnerSessionLifecycle(dependencies.lookup);
  return {
    async writeSession(context:StoreRequestContext,record:OwnerSessionRecord){
      if(context.identity.mfaVerified!==true||!context.identity.authenticationTime||!/^[a-f0-9]{64}$/.test(record.sessionHash))throw new Error('Verified session context required.');
      return dependencies.withTenantClient(context.tenantId,async client=>{
        await client.query('SELECT zayvi_owner_auth.create_session($1,$2::uuid,$3::uuid,$4::uuid,$5,$6,$7,$8::bigint,$9,$10,to_timestamp($11::double precision))',
          [record.sessionHash,context.tenantId,context.store.id,context.membershipId,context.identity.issuer,context.identity.subject,context.role,context.identity.authenticationTime,record.providerSessionId,record.providerTokenId,record.expiresAt]);
      });
    },
    async load(sessionToken:string|undefined):Promise<StoredOwnerSession|null>{
      if(!validHandle(sessionToken))return null;
      return lifecycle.loadHash(hash(sessionToken));
    },
    async isActive(tenantId:string,sessionToken:string){
      if(!validHandle(sessionToken))return false;
      return dependencies.withTenantClient(tenantId,async client=>{
        const {rows}=await client.query('SELECT zayvi_owner_auth.session_is_active($1) AS active',[hash(sessionToken)]);
        return rows.length===1&&rows[0].active===true;
      });
    },
    async revoke(sessionToken:string|undefined){
      if(validHandle(sessionToken))await lifecycle.revokeHash(hash(sessionToken));
    },
  };
}
