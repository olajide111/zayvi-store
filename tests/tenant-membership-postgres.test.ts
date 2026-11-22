import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {createTenantMembershipDirectory} from '../lib/tenant-membership-directory';
import {createStoreDatabaseAdapters,type StoreDatabaseClient} from '../lib/store-database';
import {withAuthorisedStore} from '../lib/store-access';
import {tenantPermissionPolicy} from '../lib/tenant-permissions';
const a='11111111-1111-1111-1111-111111111111',b='22222222-2222-2222-2222-222222222222',ma='33333333-3333-3333-3333-333333333333',mb='44444444-4444-4444-4444-444444444444',sa='55555555-5555-5555-5555-555555555555',sb='66666666-6666-6666-6666-666666666666';
const identity={issuer:'https://issuer.example',subject:'user-a',mfaVerified:true};
test('membership discovery and store access with embedded PostgreSQL roles and RLS',async t=>{
 const db=new PGlite();await db.waitReady;
 try {
 // PGlite has built-in gen_random_uuid; the optional pgcrypto extension is unnecessary for this foundation fixture.
 await db.exec(readFileSync('database/migrations/0001_multi_tenant_foundation.sql','utf8').replace('CREATE EXTENSION IF NOT EXISTS pgcrypto;',''));
 await db.exec(`CREATE ROLE zayvi_app NOLOGIN NOSUPERUSER NOBYPASSRLS; CREATE ROLE untrusted NOLOGIN;
 GRANT USAGE ON SCHEMA public TO zayvi_app;
 GRANT SELECT ON public.stores, public.tenant_memberships, public.tenants TO zayvi_app;
 GRANT UPDATE(id) ON public.stores TO zayvi_app;
 INSERT INTO tenants(id,name,slug,status) VALUES ('${a}','Hammy organisation','hammy','active'),('${b}','Other organisation','other','active');
 INSERT INTO tenant_memberships(id,tenant_id,identity_subject,email,role,status) VALUES ('${ma}','${a}','legacy-a','a@example.test','owner','active'),('${mb}','${b}','legacy-b','b@example.test','owner','active');
 INSERT INTO stores(id,tenant_id,name,slug) VALUES ('${sa}','${a}','Hammy','hammy'),('${sb}','${b}','Other','other');`);
 await db.exec(readFileSync('database/proposals/identity-membership-directory.sql','utf8'));
 await db.query('INSERT INTO zayvi_identity.membership_directory(issuer,subject,tenant_id,membership_id) VALUES ($1,$2,$3,$4),($1,$5,$6,$7)',[identity.issuer,identity.subject,a,ma,'user-b',b,mb]);
 await db.exec('SET ROLE zayvi_app');
 const query=async(sql:string,values?:unknown[])=>({rows:(await db.query<Record<string,unknown>>(sql,values)).rows});
 const client:StoreDatabaseClient={query,release(){}};
 const adapters=createStoreDatabaseAdapters({connect:async()=>client});
 const directory=createTenantMembershipDirectory({discovery:client,withTenantClient:adapters.withTenantClient});
 const context={identity,tenantId:a,membershipId:ma,role:'owner'};
 const run=()=>withAuthorisedStore({token:'verified-fixture',boundStoreId:sa,requiredPermission:'store.update',dependencies:{
  identityProvider:{verifyAccessToken:async()=>identity},membershipDirectory:directory,permissions:tenantPermissionPolicy,
  ...adapters,execute:async c=>adapters.withTenantClient(c.tenantId,async connection=>(await connection.query('SELECT id FROM public.stores WHERE tenant_id=$1',[c.tenantId])).rows),
 }});
 await t.test('discovery exposes only the exact issuer and subject without directory-table access',async()=>{
  const memberships=await directory.findMemberships(identity);assert.equal(memberships.length,1);assert.equal(memberships[0].tenantId,a);
  assert.deepEqual(await directory.findMemberships({...identity,issuer:'https://other-issuer.example'}),[]);
  assert.deepEqual(await directory.findMemberships({...identity,subject:"user-a' OR true --"}),[]);
  await assert.rejects(db.query('SELECT * FROM zayvi_identity.membership_directory'),/permission denied/);
  await assert.rejects(db.query('DELETE FROM zayvi_identity.membership_directory'),/permission denied/);
 });
 await t.test('the complete store pipeline reads one tenant and clears context at commit',async()=>{
  assert.deepEqual(await run(),[{id:sa}]);
  assert.deepEqual((await db.query('SELECT id FROM public.stores')).rows,[]);
  assert.equal((await db.query<{tenant:string}>("SELECT current_setting('app.tenant_id',true) AS tenant")).rows[0].tenant,'');
 });
 await t.test('membership recheck rejects foreign tenant, role changes and missing MFA',async()=>{
  await adapters.transactions.withTenantTransaction(a,async()=>{
   assert.equal(await directory.isMembershipActive(context),true);
   assert.equal(await directory.isMembershipActive({...context,membershipId:mb}),false);
   assert.equal(await directory.isMembershipActive({...context,role:'read_only'}),false);
   assert.equal(await directory.isMembershipActive({...context,identity:{...identity,mfaVerified:false}}),false);
   assert.deepEqual((await client.query('SELECT id FROM public.stores WHERE id=$1',[sb])).rows,[]);
  });
  assert.equal((await db.query<{active:boolean}>('SELECT zayvi_identity.membership_is_active($1,$2,$3,$4,$5,true) AS active',[identity.issuer,identity.subject,a,ma,'owner'])).rows[0].active,false);
 });
 await t.test('revoked membership is rejected and leaves no tenant context',async()=>{
  await db.exec('RESET ROLE');await db.query("UPDATE tenant_memberships SET status='removed' WHERE id=$1",[ma]);await db.exec('SET ROLE zayvi_app');
  await assert.rejects(run(),/No active organisation membership/);assert.deepEqual((await db.query('SELECT id FROM public.stores')).rows,[]);
  await db.exec('RESET ROLE');await db.query("UPDATE tenant_memberships SET status='active' WHERE id=$1",[ma]);await db.exec('SET ROLE zayvi_app');
 });
 await t.test('a role downgrade after discovery invalidates the original permission context',async()=>{
  assert.equal((await directory.findMemberships(identity))[0].role,'owner');
  await db.exec('RESET ROLE');await db.query("UPDATE tenant_memberships SET role='read_only' WHERE id=$1",[ma]);await db.exec('SET ROLE zayvi_app');
  await adapters.transactions.withTenantTransaction(a,async()=>assert.equal(await directory.isMembershipActive(context),false));
  await db.exec('RESET ROLE');await db.query("UPDATE tenant_memberships SET role='owner' WHERE id=$1",[ma]);await db.exec('SET ROLE zayvi_app');
 });
 await t.test('resolver functions have narrow grants and a non-login, non-bypass owner',async()=>{
  const role=(await db.query<{rolcanlogin:boolean;rolsuper:boolean;rolbypassrls:boolean}>("SELECT rolcanlogin,rolsuper,rolbypassrls FROM pg_roles WHERE rolname='zayvi_identity_resolver'")).rows[0];assert.deepEqual(role,{rolcanlogin:false,rolsuper:false,rolbypassrls:false});
  const privilege=(await db.query<{allowed:boolean}>("SELECT has_function_privilege('untrusted','zayvi_identity.resolve_memberships(text,text)','EXECUTE') AS allowed")).rows[0];assert.equal(privilege.allowed,false);
  const functions=(await db.query<{prosecdef:boolean;proconfig:string[]}>("SELECT prosecdef,proconfig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='zayvi_identity'")).rows;assert.equal(functions.length,2);assert(functions.every(f=>f.prosecdef&&f.proconfig.includes('search_path=pg_catalog, pg_temp')));
 });
 await t.test('directory links cannot reference a membership in another tenant',async()=>{
  await db.exec('RESET ROLE');await assert.rejects(db.query('INSERT INTO zayvi_identity.membership_directory VALUES($1,$2,$3,$4)',[identity.issuer,'wrong-link',a,mb]),/foreign key/);await db.exec('SET ROLE zayvi_app');
 });
 } finally {await db.close();}
});
