import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {createStoreDatabaseAdapters,type StoreDatabaseClient} from '../lib/store-database';
import {createTenantMembershipDirectory} from '../lib/tenant-membership-directory';
import {createPostgresOwnerSessions} from '../lib/owner-sessions';
import {createOwnerLoginCompletion} from '../lib/owner-login-completion';
import {createOwnerSessionAccess} from '../lib/owner-session-access';
const tenantId='11111111-1111-1111-1111-111111111111',storeId='22222222-2222-2222-2222-222222222222',member='33333333-3333-3333-3333-333333333333';
const identity={issuer:'https://issuer.example',subject:'owner-user',mfaVerified:true as const,authenticationTime:Math.floor(Date.now()/1000)-10};
test('persistent owner sessions and protected operations with PostgreSQL',async t=>{
 const db=new PGlite();await db.waitReady;
 try{
  await db.exec(readFileSync('database/migrations/0001_multi_tenant_foundation.sql','utf8').replace('CREATE EXTENSION IF NOT EXISTS pgcrypto;',''));
  await db.exec(`CREATE ROLE zayvi_app NOLOGIN NOSUPERUSER NOBYPASSRLS;CREATE ROLE unrelated NOLOGIN;GRANT USAGE ON SCHEMA public TO zayvi_app;GRANT SELECT ON tenants,tenant_memberships,stores TO zayvi_app;GRANT UPDATE(id) ON stores TO zayvi_app;
   INSERT INTO tenants(id,name,slug,status) VALUES('${tenantId}','Hammy tenant','hammy','active');
   INSERT INTO tenant_memberships(id,tenant_id,identity_subject,email,role,status) VALUES('${member}','${tenantId}','legacy','owner@example.test','owner','active');
   INSERT INTO stores(id,tenant_id,name,slug) VALUES('${storeId}','${tenantId}','Hammy','hammy');`);
  for(const file of ['identity-membership-directory.sql','owner-login-attempts.sql','owner-sessions.sql'])await db.exec(readFileSync(`database/proposals/${file}`,'utf8'));
  await db.query('INSERT INTO zayvi_identity.membership_directory VALUES($1,$2,$3,$4)',[identity.issuer,identity.subject,tenantId,member]);
  await db.exec('SET ROLE zayvi_app');
  const client:StoreDatabaseClient={async query(sql,values){return {rows:(await db.query<Record<string,unknown>>(sql,values)).rows};},release(){}};
  const adapters=createStoreDatabaseAdapters({connect:async()=>client});
  const directory=createTenantMembershipDirectory({discovery:client,withTenantClient:adapters.withTenantClient});
  const sessions=createPostgresOwnerSessions({lookup:client,withTenantClient:adapters.withTenantClient});
  const finish=createOwnerLoginCompletion({tenantId,storeId},{...adapters,membershipDirectory:directory,writeSession:sessions.writeSession,
   async verifyLoginTokens(){return {identity,providerSession:{...identity,tokenId:'provider-token',sessionId:'provider-session'},expiresAt:Math.floor(Date.now()/1000)+600};}});
  const login=async()=>(await finish({accessToken:'fixture-access',idToken:'fixture-id',expiresIn:600},'fixture-nonce')).sessionToken;
  const access=createOwnerSessionAccess({tenantId,storeId},{...adapters,membershipDirectory:directory,sessions,verifyProviderSession:async()=>({active:true,mfaVerified:true})});
  await t.test('session creation commits a hash and authorises only after current access checks',async()=>{
   const token=await login(),stored=await sessions.load(token);assert.equal(stored?.membershipId,member);assert.equal(stored?.storeId,storeId);
   assert.equal(await access(token,'store.read',async context=>context.store.id),storeId);
   await db.exec('RESET ROLE');const data=(await db.query<{session_hash:string}>('SELECT session_hash FROM zayvi_owner_auth.owner_sessions WHERE session_hash=$1',[createHash('sha256').update(token).digest('hex')])).rows;assert.equal(data.length,1);assert.notEqual(data[0].session_hash,token);await db.exec('SET ROLE zayvi_app');
   await assert.rejects(db.query('SELECT * FROM zayvi_owner_auth.owner_sessions'),/permission denied/);
  });
  await t.test('logout is idempotent and revokes only the presented session',async()=>{
   const one=await login(),two=await login();await sessions.revoke(one);await sessions.revoke(one);assert.equal(await sessions.load(one),null);await assert.rejects(access(one,'store.read',async()=>assert.fail('must not run')));assert(await sessions.load(two));
  });
  await t.test('revocation after initial lookup blocks the pending operation',async()=>{
   const token=await login();let executed=false;
   const guarded=createOwnerSessionAccess({tenantId,storeId},{...adapters,membershipDirectory:directory,sessions,async verifyProviderSession(){await sessions.revoke(token);return {active:true,mfaVerified:true};}});
   await assert.rejects(guarded(token,'store.read',async()=>{executed=true;}));assert.equal(executed,false);
  });
  await t.test('provider revocation or missing MFA cannot authorise a stored session',async()=>{
   const token=await login();for(const assurance of [{active:false,mfaVerified:true},{active:true,mfaVerified:false}]){
    const guarded=createOwnerSessionAccess({tenantId,storeId},{...adapters,membershipDirectory:directory,sessions,verifyProviderSession:async()=>assurance});await assert.rejects(guarded(token,'store.read',async()=>assert.fail('must not run')));
   }
  });
  await t.test('role changes and unavailable stores invalidate earlier sessions',async()=>{
   const token=await login();await db.exec('RESET ROLE');await db.query("UPDATE tenant_memberships SET role='read_only' WHERE id=$1",[member]);await db.exec('SET ROLE zayvi_app');await assert.rejects(access(token,'store.read',async()=>assert.fail('stale role')));
   await db.exec('RESET ROLE');await db.query("UPDATE tenant_memberships SET role='owner' WHERE id=$1",[member]);await db.query("UPDATE stores SET status='paused' WHERE id=$1",[storeId]);await db.exec('SET ROLE zayvi_app');await assert.rejects(access(token,'store.read',async()=>assert.fail('paused store')));
   await db.exec('RESET ROLE');await db.query("UPDATE stores SET status='draft' WHERE id=$1",[storeId]);await db.exec('SET ROLE zayvi_app');
  });
  await t.test('transaction rollback leaves no session record',async()=>{
   const token='r'.repeat(43),sessionHash=createHash('sha256').update(token).digest('hex');
   await assert.rejects(adapters.transactions.withTenantTransaction(tenantId,async()=>{
    await sessions.writeSession({identity,tenantId,membershipId:member,role:'owner',store:{id:storeId,tenantId,status:'draft'}},{sessionHash,providerSessionId:'provider-session',providerTokenId:'provider-token',expiresAt:Math.floor(Date.now()/1000)+600});throw new Error('Rollback fixture');
   }));assert.equal(await sessions.load(token),null);
  });
  await t.test('expired, unknown and foreign-store sessions cannot execute work',async()=>{
   const token=await login();const guarded=createOwnerSessionAccess({tenantId,storeId:'44444444-4444-4444-4444-444444444444'},{...adapters,membershipDirectory:directory,sessions,verifyProviderSession:async()=>({active:true,mfaVerified:true})});await assert.rejects(guarded(token,'store.read',async()=>assert.fail('wrong binding')));
   await db.exec('RESET ROLE');await db.query("UPDATE zayvi_owner_auth.owner_sessions SET created_at=clock_timestamp()-interval '20 minutes',expires_at=clock_timestamp()-interval '10 minutes' WHERE session_hash=$1",[createHash('sha256').update(token).digest('hex')]);await db.exec('SET ROLE zayvi_app');assert.equal(await sessions.load(token),null);assert.equal(await sessions.load('not-a-cookie'),null);await assert.rejects(access('x'.repeat(43),'store.read',async()=>assert.fail('unknown cookie')));
  });
  await t.test('session functions are not executable by unrelated roles',async()=>{
   const rows=(await db.query<{allowed:boolean}>("SELECT has_function_privilege('unrelated','zayvi_owner_auth.resolve_session(text)','EXECUTE') AS allowed")).rows;assert.equal(rows[0].allowed,false);
  });
 }finally{await db.close();}
});
