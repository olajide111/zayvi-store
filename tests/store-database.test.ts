import test from 'node:test';
import assert from 'node:assert/strict';
import {createStoreDatabaseAdapters,type StoreDatabaseClient} from '../lib/store-database';
const tenantA='11111111-1111-1111-1111-111111111111',tenantB='22222222-2222-2222-2222-222222222222',storeId='33333333-3333-3333-3333-333333333333';
function fixture(options:{role?:Record<string,unknown>;tables?:Record<string,unknown>[];rollbackFails?:boolean;commitFails?:boolean}={}) {
 const connections:{calls:{sql:string;values?:unknown[]}[];releases:(Error|undefined)[];tenant:string}[]=[];
 const adapters=createStoreDatabaseAdapters({async connect(){
  const connection={calls:[] as {sql:string;values?:unknown[]}[],releases:[] as (Error|undefined)[],tenant:''};connections.push(connection);
  const client:StoreDatabaseClient={async query(sql,values){
   connection.calls.push({sql,values});
   if(sql.includes('pg_roles'))return {rows:[options.role??{rolsuper:false,rolbypassrls:false,row_security:'on'}]};
   if(sql.includes('pg_class'))return {rows:options.tables??['tenant_memberships','stores'].map(relname=>({relname,relrowsecurity:true,relforcerowsecurity:true}))};
   if(sql.includes('set_config'))connection.tenant=String(values?.[0]);
   if(sql.includes('FROM public.stores')){assert.deepEqual(values,[connection.tenant,storeId]);assert(sql.includes('FOR SHARE'));return {rows:[{id:storeId,tenant_id:connection.tenant,status:'draft'}]};}
   if(sql==='COMMIT'&&options.commitFails)throw new Error('Commit failed');
   if(sql==='ROLLBACK'&&options.rollbackFails)throw new Error('Rollback failed');
   return {rows:[]};
  },release(error){connection.releases.push(error);}};
  return client;
 }});
 return {...adapters,connections};
}
test('tenant context uses a parameter and lasts only for the transaction',async()=>{
 const f=fixture();await f.transactions.withTenantTransaction(tenantA,async()=>{assert.deepEqual(await f.stores.findStore(tenantA,storeId),{id:storeId,tenantId:tenantA,status:'draft'});});
 const c=f.connections[0];assert.equal(c.calls[0].sql,'BEGIN');assert.equal(c.calls.at(-1)?.sql,'COMMIT');assert.deepEqual(c.calls.find(call=>call.sql.includes('set_config')),{sql:"SELECT set_config('app.tenant_id', $1, true)",values:[tenantA]});assert.equal(c.releases.length,1);assert.equal(c.releases[0],undefined);
 await assert.rejects(f.stores.findStore(tenantA,storeId),/active matching/);
});
test('unsafe database roles and disabled row security fail before setting tenant context',async()=>{
 for(const role of [{rolsuper:true,rolbypassrls:false,row_security:'on'},{rolsuper:false,rolbypassrls:true,row_security:'on'},{rolsuper:false,rolbypassrls:false,row_security:'off'},{}]){
  const f=fixture({role});let ran=false;await assert.rejects(f.transactions.withTenantTransaction(tenantA,async()=>{ran=true;}),/row security/);assert(!ran);assert(!f.connections[0].calls.some(c=>c.sql.includes('set_config')));assert.equal(f.connections[0].calls.at(-1)?.sql,'ROLLBACK');
 }
});
test('missing or non-enforcing tenant tables block protected work',async()=>{
 for(const tables of [[],[{relname:'stores',relrowsecurity:true,relforcerowsecurity:true}],['stores','tenant_memberships'].map(relname=>({relname,relrowsecurity:true,relforcerowsecurity:false}))]){
  const f=fixture({tables});await assert.rejects(f.transactions.withTenantTransaction(tenantA,async()=>assert.fail('must not execute')),/enforce row security/);assert.equal(f.connections[0].calls.at(-1)?.sql,'ROLLBACK');
 }
});
test('failed work rolls back; failed cleanup discards the pooled connection',async()=>{
 for(const rollbackFails of [false,true]){const f=fixture({rollbackFails});const error=new Error('Protected work failed');await assert.rejects(f.transactions.withTenantTransaction(tenantA,async()=>{throw error;}),actual=>actual===error);const c=f.connections[0];assert.equal(c.calls.at(-1)?.sql,'ROLLBACK');assert.equal(c.releases.length,1);assert.equal(c.releases[0] instanceof Error,rollbackFails);}
 const f=fixture({commitFails:true});await assert.rejects(f.transactions.withTenantTransaction(tenantA,async()=>true),/Commit failed/);assert.equal(f.connections[0].calls.at(-1)?.sql,'ROLLBACK');
});
test('invalid, nested and cross-context requests cannot query another tenant',async()=>{
 const f=fixture();await assert.rejects(f.transactions.withTenantTransaction('browser-input',async()=>{}),/valid tenant/);assert.equal(f.connections.length,0);
 await f.transactions.withTenantTransaction(tenantA,async()=>{
  await assert.rejects(f.transactions.withTenantTransaction(tenantB,async()=>{}),/Nested/);
  await assert.rejects(f.stores.findStore(tenantB,storeId),/active matching/);
  await assert.rejects(f.stores.findStore(tenantA,'main'),/valid store/);
 });assert.equal(f.connections.length,1);
});
test('concurrent tenant requests use independent transaction clients',async()=>{
 const f=fixture();let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});
 const one=f.transactions.withTenantTransaction(tenantA,async()=>{await gate;return f.stores.findStore(tenantA,storeId);});
 const two=f.transactions.withTenantTransaction(tenantB,async()=>{const store=await f.stores.findStore(tenantB,storeId);release();return store;});
 const results=await Promise.all([one,two]);assert.deepEqual(results.map(store=>store?.tenantId),[tenantA,tenantB]);assert.equal(f.connections.length,2);assert(f.connections.every(c=>c.releases.length===1));
});
test('asynchronous work retained after completion cannot reuse a released client',async()=>{
 const f=fixture();let later!:()=>Promise<unknown>;let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});let pending!:Promise<unknown>;
 await f.transactions.withTenantTransaction(tenantA,async()=>{pending=gate.then(()=>f.stores.findStore(tenantA,storeId));later=()=>pending;});release();await assert.rejects(later(),/active matching/);assert(!f.connections[0].calls.some(call=>call.sql.includes('FROM public.stores')));
});
