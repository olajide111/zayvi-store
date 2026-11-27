import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {decodeJwt,SignJWT} from 'jose';
import {createStoreDatabaseAdapters,type StoreDatabaseClient} from '../lib/store-database';
import {createTenantMembershipDirectory} from '../lib/tenant-membership-directory';
import {createPostgresOwnerSessions,createPostgresOwnerSessionLifecycle} from '../lib/owner-sessions';
import {createOwnerLoginCompletion} from '../lib/owner-login-completion';
import {createPrivateOwnerStoreSummary,createRemoteOwnerStoreSummary,OwnerOperationUnavailable,type OwnerSummaryRequest} from '../lib/owner-store-summary-rpc';
const tenantId='11111111-1111-1111-1111-111111111111',storeId='22222222-2222-2222-2222-222222222222',member='33333333-3333-3333-3333-333333333333',subject='44444444-4444-4444-4444-444444444444';
const providerIssuer='https://cognito-idp.eu-west-2.amazonaws.com/eu-west-2_Preview',config={deployment:'preview',providerIssuer,tenantId,storeId};
test('signed private store read checks current PostgreSQL access in the data transaction',async t=>{
 const db=new PGlite();await db.waitReady;
 try{
  await db.exec(readFileSync('database/migrations/0001_multi_tenant_foundation.sql','utf8').replace('CREATE EXTENSION IF NOT EXISTS pgcrypto;',''));
  await db.exec(`CREATE ROLE zayvi_app NOLOGIN NOSUPERUSER NOBYPASSRLS;GRANT USAGE ON SCHEMA public TO zayvi_app;
   GRANT SELECT ON tenants,tenant_memberships,stores TO zayvi_app;GRANT UPDATE(id) ON stores TO zayvi_app;
   INSERT INTO tenants(id,name,slug,status) VALUES('${tenantId}','Hammy tenant','hammy','active');
   INSERT INTO tenant_memberships(id,tenant_id,identity_subject,email,role,status) VALUES('${member}','${tenantId}','legacy','owner@example.test','owner','active');
   INSERT INTO stores(id,tenant_id,name,slug) VALUES('${storeId}','${tenantId}','Hammy Store','hammy');`);
  for(const file of ['identity-membership-directory.sql','owner-login-attempts.sql','owner-sessions.sql'])await db.exec(readFileSync(`database/proposals/${file}`,'utf8'));
  await db.query('INSERT INTO zayvi_identity.membership_directory VALUES($1,$2,$3,$4)',[providerIssuer,subject,tenantId,member]);await db.exec('SET ROLE zayvi_app');
  const queries:string[]=[];
  const client:StoreDatabaseClient={async query(sql,values){queries.push(sql);return {rows:(await db.query<Record<string,unknown>>(sql,values)).rows};},release(){}};
  const adapters=createStoreDatabaseAdapters({connect:async()=>client}),directory=createTenantMembershipDirectory({discovery:client,withTenantClient:adapters.withTenantClient});
  const sessions=createPostgresOwnerSessions({lookup:client,withTenantClient:adapters.withTenantClient});
  const finish=createOwnerLoginCompletion(config,{...adapters,membershipDirectory:directory,writeSession:sessions.writeSession,async verifyLoginTokens(){
   const identity={issuer:providerIssuer,subject,mfaVerified:true as const,authenticationTime:Math.floor(Date.now()/1000)-10};
   return {identity,providerSession:{...identity,sessionId:'provider-session',tokenId:'provider-token-id'},expiresAt:Math.floor(Date.now()/1000)+600};
  }});
  const login=async()=>(await finish({accessToken:'fixture-access-token',idToken:'fixture-id-token',expiresIn:600},'nonce')).sessionToken;
  const secret=randomBytes(32),dispatch=createPrivateOwnerStoreSummary(config,secret,{...adapters,membershipDirectory:directory,sessions:createPostgresOwnerSessionLifecycle(client)});
  let calls=0,last:OwnerSummaryRequest|undefined,active=true,mfaVerified=true;
  const remote=createRemoteOwnerStoreSummary(config,secret,{loadSession:sessions.load,verifyCurrentAssurance:async()=>({active,mfaVerified}),async invoke(input){calls++;last=structuredClone(input);return dispatch(input);}});
  const admin=async(sql:string)=>{await db.exec('RESET ROLE');await db.exec(sql);await db.exec('SET ROLE zayvi_app');};
  await t.test('bound store read commits before reply and excludes raw handles, tokens and identity metadata',async()=>{
   const token=await login();queries.length=0;
   const store=await remote(token);assert.deepEqual(store,{id:storeId,name:'Hammy Store',slug:'hammy',status:'draft'});
   assert.equal(queries.at(-1),'COMMIT');const read=queries.findIndex(sql=>sql.startsWith('SELECT id,name,slug,status'));
   assert(read>queries.findIndex(sql=>sql==='BEGIN'));assert(read>queries.findIndex(sql=>sql.includes('session_is_active')));
   const wire=JSON.stringify(last);assert(!wire.includes(token));assert(!wire.includes('fixture-access-token'));assert(!wire.includes('fixture-id-token'));
   assert(!JSON.stringify(store).includes(subject));assert(!JSON.stringify(store).includes(member));
  });
  await t.test('missing current provider assurance never invokes private operation',async()=>{
   const token=await login(),before=calls;active=false;await assert.rejects(remote(token),OwnerOperationUnavailable);active=true;mfaVerified=false;
   await assert.rejects(remote(token),OwnerOperationUnavailable);mfaVerified=true;assert.equal(calls,before);
  });
  await t.test('forged, expired, overlong, cross-store and wrong-operation proofs are rejected before database work',async()=>{
   assert(last);const base=decodeJwt(last.proof),now=Math.floor(Date.now()/1000);
   for(const changes of [{exp:now-1,iat:now-10},{exp:now+60,iat:now},{iat:now+5,exp:now+10},{mfa:false},
    {operation:'orders.refund'},{store:'55555555-5555-5555-5555-555555555555'},{tenant:'55555555-5555-5555-5555-555555555555'},
    {provider_issuer:'https://untrusted.test'},{aud:['urn:zayvi:preview:owner-store','other']},{role:'owner'}]){
    const proof=await new SignJWT({...base,...changes}).setProtectedHeader({alg:'HS256',typ:'zayvi-owner-store-read+jwt'}).sign(secret);
    const before=queries.length;await assert.rejects(dispatch({...last,proof}),OwnerOperationUnavailable);assert.equal(queries.length,before);
   }
   const forged=await new SignJWT(base).setProtectedHeader({alg:'HS256',typ:'zayvi-owner-store-read+jwt'}).sign(randomBytes(32));
   const before=queries.length;await assert.rejects(dispatch({...last,proof:forged}),OwnerOperationUnavailable);
   await assert.rejects(dispatch({...last,sql:'SELECT 1'}),OwnerOperationUnavailable);assert.equal(queries.length,before);
  });
  await t.test('session revocation and changed membership or store state deny an earlier proof',async()=>{
   const token=await login();await remote(token);assert(last);const proof=last;await sessions.revoke(token);await assert.rejects(dispatch(proof),OwnerOperationUnavailable);
   const next=await login();await remote(next);assert(last);const valid=last;
   for(const [change,restore] of [
    ["UPDATE tenant_memberships SET status='removed'","UPDATE tenant_memberships SET status='active'"],
    ["UPDATE tenant_memberships SET role='read_only'","UPDATE tenant_memberships SET role='owner'"],
    ["UPDATE tenant_memberships SET role='supplier_manager'","UPDATE tenant_memberships SET role='owner'"],
    ["UPDATE stores SET status='paused'","UPDATE stores SET status='draft'"],
   ]){await admin(change);queries.length=0;await assert.rejects(dispatch(valid),OwnerOperationUnavailable);assert(!queries.some(sql=>sql.startsWith('SELECT id,name,slug,status')));await admin(restore);}
  });
  await t.test('provider-session substitution and a lost read reply fail closed without retries',async()=>{
   const token=await login();await remote(token);assert(last);const claims=decodeJwt(last.proof);
   const proof=await new SignJWT({...claims,provider_token:'other-token'}).setProtectedHeader({alg:'HS256',typ:'zayvi-owner-store-read+jwt'}).sign(secret);
   await assert.rejects(dispatch({...last,proof}),OwnerOperationUnavailable);
   let attempts=0;const lost=createRemoteOwnerStoreSummary(config,secret,{loadSession:sessions.load,verifyCurrentAssurance:async()=>({active:true,mfaVerified:true}),async invoke(input){attempts++;await dispatch(input);throw new Error('private transport');}});
   await assert.rejects(lost(token),error=>error instanceof OwnerOperationUnavailable&&!error.message.includes('transport'));assert.equal(attempts,1);
  });
  await t.test('a proof that expires while database access is checked cannot execute the data read',async()=>{
   const token=await login();await remote(token);assert(last);const originalNow=Date.now;
   const delayed=createPrivateOwnerStoreSummary(config,secret,{...adapters,membershipDirectory:directory,sessions:createPostgresOwnerSessionLifecycle(client),
    stores:{async findStore(tenant,store){const found=await adapters.stores.findStore(tenant,store);Date.now=()=>originalNow()+16000;return found;}}});
   queries.length=0;try{await assert.rejects(delayed(last),OwnerOperationUnavailable);}finally{Date.now=originalNow;}
   assert(!queries.some(sql=>sql.startsWith('SELECT id,name,slug,status')));assert.equal(queries.at(-1),'ROLLBACK');
  });
 }finally{await db.close();}
});
test('summary boundary denies invalid configuration, absent sessions and forged result fields',async()=>{
 const secret=randomBytes(32),now=Math.floor(Date.now()/1000),session={tenantId,storeId,membershipId:member,issuer:providerIssuer,subject,role:'owner',authenticationTime:now-10,providerSessionId:'s',providerTokenId:'t',expiresAt:now+600};
 let calls=0;const deps={loadSession:async()=>session,verifyCurrentAssurance:async()=>({active:true,mfaVerified:true}),invoke:async()=>{calls++;return {version:1,ok:true,store:{id:storeId,name:'Hammy',slug:'hammy',status:'draft'}};}};
 assert.throws(()=>createRemoteOwnerStoreSummary({...config,deployment:'production'},secret,deps));
 assert.throws(()=>createRemoteOwnerStoreSummary(config,new Uint8Array(1),deps));
 const remote=createRemoteOwnerStoreSummary(config,secret,deps);await assert.rejects(remote(undefined),OwnerOperationUnavailable);assert.equal(calls,0);
 const token=randomBytes(32).toString('base64url');await assert.rejects(createRemoteOwnerStoreSummary(config,secret,{...deps,loadSession:async()=>null})(token),OwnerOperationUnavailable);
 for(const store of [{id:storeId,name:'Hammy',slug:'hammy',status:['active']},{id:storeId,name:'Hammy',slug:'hammy',status:'active',role:'owner'},
  {id:tenantId,name:'Other',slug:'other',status:'active'}]){
  await assert.rejects(createRemoteOwnerStoreSummary(config,secret,{...deps,invoke:async()=>({version:1,ok:true,store})})(token),OwnerOperationUnavailable);
 }
});
