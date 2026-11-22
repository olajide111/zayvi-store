import test from 'node:test';
import assert from 'node:assert/strict';
import {createTenantMembershipDirectory} from '../lib/tenant-membership-directory';
const tenantId='11111111-1111-1111-1111-111111111111',membershipId='22222222-2222-2222-2222-222222222222';
const identity={issuer:'https://issuer.example',subject:"subject' OR true --",mfaVerified:true};
const row={tenant_id:tenantId,tenant_name:'Hammy',tenant_status:'active',membership_id:membershipId,membership_status:'active',role:'owner'};
function fixture(rows:Record<string,unknown>[]=[row]){
 const calls:{sql:string;values?:unknown[]}[]=[];
 const client={async query(sql:string,values?:unknown[]){calls.push({sql,values});return {rows:sql.includes('membership_is_active')?[{active:true}]:rows};}};
 let transactionTenant='';
 const directory=createTenantMembershipDirectory({discovery:client,async withTenantClient(id,work){transactionTenant=id;return work(client);}});
 return {directory,calls,tenant:()=>transactionTenant};
}
test('verified identity values are passed as SQL parameters, never interpolated',async()=>{
 const f=fixture();const memberships=await f.directory.findMemberships(identity);assert.equal(memberships[0].tenantId,tenantId);assert.deepEqual(f.calls[0].values,[identity.issuer,identity.subject]);assert(!f.calls[0].sql.includes(identity.subject));
});
test('missing identities and malformed, duplicate or unrecognised memberships fail closed',async()=>{
 const f=fixture();await assert.rejects(f.directory.findMemberships({...identity,issuer:''}));assert.equal(f.calls.length,0);
 for(const rows of [[{...row,role:'superuser'}],[{...row,tenant_id:'main'}],[{...row,membership_status:'enabled'}],[row,row]])await assert.rejects(fixture(rows).directory.findMemberships(identity),/invalid result/);
 assert.deepEqual(await fixture([]).directory.findMemberships(identity),[]);
});
test('rechecking uses the active tenant client and includes subject, role and MFA evidence',async()=>{
 const f=fixture();assert.equal(await f.directory.isMembershipActive({identity,tenantId,membershipId,role:'owner'}),true);assert.equal(f.tenant(),tenantId);assert.deepEqual(f.calls[0].values,[identity.issuer,identity.subject,tenantId,membershipId,'owner',true]);
});
test('invalid recheck context makes no database call',async()=>{
 const f=fixture();assert.equal(await f.directory.isMembershipActive({identity,tenantId:'untrusted',membershipId,role:'owner'}),false);assert.equal(f.calls.length,0);
});
test('database failures and unavailable transaction contexts cannot grant access',async()=>{
 const failing=createTenantMembershipDirectory({discovery:{async query(){throw new Error('Unavailable');}},async withTenantClient(){throw new Error('No transaction');}});
 await assert.rejects(failing.findMemberships(identity),/Unavailable/);await assert.rejects(failing.isMembershipActive({identity,tenantId,membershipId,role:'owner'}),/No transaction/);
});
