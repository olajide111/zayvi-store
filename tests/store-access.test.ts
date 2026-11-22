import test from 'node:test';
import assert from 'node:assert/strict';
import {withAuthorisedStore,StoreAccessError,type StoreRecord} from '../lib/store-access';
import {TenantAccessError} from '../lib/tenant-access';
import {tenantPermissionPolicy} from '../lib/tenant-permissions';
const storeId='11111111-1111-4111-8111-111111111111', otherId='22222222-2222-4222-8222-222222222222';
function fixture(){
 const calls:string[]=[];
 let record:StoreRecord|null={id:storeId,tenantId:'tenant-hammy',status:'draft'};
 let active=true,role='owner';
 const dependencies={
  identityProvider:{async verifyAccessToken(token:string){assert.equal(token,'verified-token');calls.push('verify');return {issuer:'trusted',subject:'owner',mfaVerified:false};}},
  membershipDirectory:{async findMemberships(){return [{tenantId:'tenant-hammy',tenantName:'Hammy',tenantStatus:'active' as const,membershipId:'membership',membershipStatus:'active' as const,role}];},async isMembershipActive(){calls.push('membership');return active;}},
  permissions:tenantPermissionPolicy,
  transactions:{async withTenantTransaction<T>(tenant:string,work:()=>Promise<T>){assert.equal(tenant,'tenant-hammy');calls.push('begin');try{const result=await work();calls.push('commit');return result;}catch(error){calls.push('rollback');throw error;}}},
  stores:{async findStore(tenant:string,id:string){calls.push('lookup');assert.equal(tenant,'tenant-hammy');assert.equal(id,storeId);return record;}},
  async execute(context:{store:StoreRecord}){calls.push('execute');return context.store.id;},
 };
 return {calls,dependencies,setRecord(value:StoreRecord|null){record=value;},revoke(){active=false;},readOnly(){role='read_only';},run(overrides:Record<string,unknown>={}){return withAuthorisedStore({token:'verified-token',boundStoreId:storeId,requiredPermission:'store.update',dependencies,...overrides});}};
}
test('a trusted store resolves only inside the authorised tenant transaction',async()=>{const f=fixture();assert.equal(await f.run(),storeId);assert.deepEqual(f.calls,['verify','begin','membership','lookup','execute','commit']);});
test('missing or malformed bindings never fall back to the legacy store',async()=>{for(const value of [undefined,null,'','main','Hammy']){const f=fixture();await assert.rejects(f.run({boundStoreId:value}),error=>error instanceof StoreAccessError&&error.code==='STORE_BINDING_REQUIRED');assert.deepEqual(f.calls,[]);}});
test('a browser cannot substitute another store',async()=>{const f=fixture();await assert.rejects(f.run({requestedStoreId:otherId}),StoreAccessError);assert.deepEqual(f.calls,[]);});
test('cross-tenant records, mismatched IDs and inaccessible stores roll back before work',async()=>{for(const record of [null,{id:otherId,tenantId:'tenant-hammy',status:'active'},{id:storeId,tenantId:'other-tenant',status:'active'},...['suspended','closed'].map(status=>({id:storeId,tenantId:'tenant-hammy',status}))]){const f=fixture();f.setRecord(record as StoreRecord|null);await assert.rejects(f.run(),StoreAccessError);assert(!f.calls.includes('execute'));assert.equal(f.calls.at(-1),'rollback');}});
test('revocation and read-only roles prevent lookup and writes',async()=>{for(const configure of [(f:ReturnType<typeof fixture>)=>f.revoke(),(f:ReturnType<typeof fixture>)=>f.readOnly()]){const f=fixture();configure(f);await assert.rejects(f.run(),TenantAccessError);assert(!f.calls.includes('lookup'));assert(!f.calls.includes('execute'));assert.equal(f.calls.at(-1),'rollback');}});
test('unverified identities and foreign tenant selection cannot reach store data',async()=>{for(const overrides of [{token:null},{selectedTenantId:'foreign'}]){const f=fixture();await assert.rejects(f.run(overrides),TenantAccessError);assert(!f.calls.includes('lookup'));assert(!f.calls.includes('execute'));}});
