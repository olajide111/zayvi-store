import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash,randomBytes} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {createPostgresOwnerSessionLifecycle,type StoredOwnerSession} from '../lib/owner-sessions';
import {createOwnerSessionLifecycleDispatcher,createRemoteOwnerSessionLifecycle,OwnerSessionUnavailable,type OwnerLifecycleRequest} from '../lib/owner-session-lifecycle-rpc';
import {createMerchantSessionDispatcher,createRemoteMerchantSessionLifecycle,type MerchantSessionRequest} from '../lib/merchant-session-lifecycle-rpc';
const tenantId='11111111-1111-1111-1111-111111111111',storeId='22222222-2222-2222-2222-222222222222',member='33333333-3333-3333-3333-333333333333',subject='44444444-4444-4444-4444-444444444444';
const otherStore='55555555-5555-5555-5555-555555555555';
const providerIssuer='https://cognito-idp.eu-west-2.amazonaws.com/eu-west-2_Preview';
const config={deployment:'preview',tenantId,storeId,providerIssuer};
const hash=(token:string)=>createHash('sha256').update(token).digest('hex');
const record=():StoredOwnerSession=>({tenantId,storeId,membershipId:member,issuer:providerIssuer,subject,role:'owner',authenticationTime:Math.floor(Date.now()/1000)-10,providerSessionId:'provider-session',providerTokenId:'provider-token',expiresAt:Math.floor(Date.now()/1000)+600});
test('private session lifecycle uses restricted PostgreSQL and keeps raw handles off RPC',async t=>{
 const db=new PGlite();await db.waitReady;
 try{
  await db.exec(readFileSync('database/migrations/0001_multi_tenant_foundation.sql','utf8').replace('CREATE EXTENSION IF NOT EXISTS pgcrypto;',''));
  await db.exec(`CREATE ROLE zayvi_app NOLOGIN NOSUPERUSER NOBYPASSRLS;GRANT USAGE ON SCHEMA public TO zayvi_app;
   INSERT INTO tenants(id,name,slug,status) VALUES('${tenantId}','Hammy','hammy','active');
   INSERT INTO tenant_memberships(id,tenant_id,identity_subject,email,role,status) VALUES('${member}','${tenantId}','legacy','owner@example.test','owner','active');
   INSERT INTO stores(id,tenant_id,name,slug) VALUES('${storeId}','${tenantId}','Hammy','hammy'),('${otherStore}','${tenantId}','Other','other');`);
  for(const file of ['identity-membership-directory.sql','owner-login-attempts.sql','owner-sessions.sql'])await db.exec(readFileSync(`database/proposals/${file}`,'utf8'));
  async function seed(bound=storeId){
   const token=randomBytes(32).toString('base64url');await db.exec('RESET ROLE');
   await db.query(`INSERT INTO zayvi_owner_auth.owner_sessions(session_hash,tenant_id,store_id,membership_id,issuer,subject,role,authentication_time,provider_session_id,provider_token_id,expires_at)
    VALUES($1,$2,$3,$4,$5,$6,'owner',$7,'provider-session','provider-token',clock_timestamp()+interval '10 minutes')`,[hash(token),tenantId,bound,member,providerIssuer,subject,Math.floor(Date.now()/1000)-10]);
   await db.exec('SET ROLE zayvi_app');return token;
  }
  const store=createPostgresOwnerSessionLifecycle({async query(sql,values){return {rows:(await db.query<Record<string,unknown>>(sql,values)).rows};}});
  const dispatch=createOwnerSessionLifecycleDispatcher(config,store),wire:OwnerLifecycleRequest[]=[];
  const remote=()=>createRemoteOwnerSessionLifecycle(config,async input=>{wire.push(structuredClone(input));return structuredClone(await dispatch(structuredClone(input)));});
  const one=remote(),two=remote();
  await t.test('lookup returns bound metadata without granting store access or exposing a handle',async()=>{
   const token=await seed(),found=await one.load(token);assert.equal(found?.storeId,storeId);assert.equal(found?.membershipId,member);
   assert.equal(wire.at(-1)?.sessionHash,hash(token));assert(!JSON.stringify(wire).includes(token));
   assert(!('isActive' in one));await assert.rejects(db.query('SELECT * FROM zayvi_owner_auth.owner_sessions'),/permission denied/);
   const before=wire.length;assert.equal(await one.load(undefined),null);assert.equal(await one.load('invalid'),null);await one.revoke('invalid');assert.equal(wire.length,before);
  });
  await t.test('foreign stores are indistinguishable from missing sessions and cannot be revoked',async()=>{
   const token=await seed(otherStore);assert.equal(await one.load(token),null);await one.revoke(token);assert(await store.loadHash(hash(token)));
   assert.equal(await one.load(randomBytes(32).toString('base64url')),null);
  });
  await t.test('logout is idempotent, uncached and affects only the exact session',async()=>{
   const first=await seed(),second=await seed();assert(await one.load(first));await two.revoke(first);await two.revoke(first);
   assert.equal(await one.load(first),null);assert(await one.load(second));
  });
  await t.test('database expiry is observed and a lost revoke reply cannot leave a cached session active',async()=>{
   const expired=await seed();await db.exec('RESET ROLE');await db.query("UPDATE zayvi_owner_auth.owner_sessions SET created_at=clock_timestamp()-interval '2 minutes',expires_at=clock_timestamp()-interval '1 minute' WHERE session_hash=$1",[hash(expired)]);await db.exec('SET ROLE zayvi_app');assert.equal(await one.load(expired),null);
   const token=await seed();let calls=0;
   const unreliable=createRemoteOwnerSessionLifecycle(config,async input=>{calls++;await dispatch(input);throw new Error('private network details');});
   await assert.rejects(unreliable.revoke(token),OwnerSessionUnavailable);assert.equal(calls,1);assert.equal(await one.load(token),null);
  });
 }finally{await db.close();}
});
test('lifecycle configuration and messages cannot select a tenant, SQL, role or production service',async()=>{
 const store={async loadHash(){return null;},async revokeHash(){assert.fail('must not revoke');}};
 for(const overrides of [{deployment:'production'},{providerIssuer:'https://untrusted.test'},{tenantId:'invalid'},{storeId:'invalid'}]){
  assert.throws(()=>createOwnerSessionLifecycleDispatcher({...config,...overrides},store),OwnerSessionUnavailable);
  assert.throws(()=>createRemoteOwnerSessionLifecycle({...config,...overrides},async()=>null),OwnerSessionUnavailable);
 }
 let calls=0;const dispatch=createOwnerSessionLifecycleDispatcher(config,{...store,async loadHash(){calls++;return null;}});
 const base={version:1,operation:'owner.session.lookup',sessionHash:'a'.repeat(64)};
 for(const input of [null,[],{...base,version:2},{...base,operation:['owner.session.lookup']},{...base,operation:'query'},
  {...base,tenantId},{...base,storeId},{...base,role:'owner'},{...base,sql:'SELECT 1'},{...base,sessionToken:'raw'},{...base,sessionHash:'invalid'}])await assert.rejects(dispatch(input),OwnerSessionUnavailable);
 assert.equal(calls,0);
});
test('reply validation rejects foreign, expired, malformed or oversized session metadata',async()=>{
 const token=randomBytes(32).toString('base64url'),valid=record();
 for(const session of [{...valid,tenantId:otherStore},{...valid,storeId:otherStore},{...valid,issuer:'https://untrusted.test'},
  {...valid,role:'root'},{...valid,subject:'not-a-cognito-subject'},{...valid,expiresAt:0},{...valid,expiresAt:Math.floor(Date.now()/1000)+7200},
  {...valid,authenticationTime:Math.floor(Date.now()/1000)+600},{...valid,providerSessionId:'x'.repeat(513)},{...valid,rawToken:'secret'}]){
  const service=createRemoteOwnerSessionLifecycle(config,async()=>({version:1,ok:true,session}));await assert.rejects(service.load(token),OwnerSessionUnavailable);
 }
 for(const reply of [null,{version:1,ok:true},{version:1,ok:true,session:null,extra:true},{version:1,ok:false,session:null}])await assert.rejects(createRemoteOwnerSessionLifecycle(config,async()=>reply).load(token),OwnerSessionUnavailable);
 await assert.rejects(createRemoteOwnerSessionLifecycle(config,async()=>({version:1,ok:true,session:valid})).revoke(token),OwnerSessionUnavailable);
});
test('private dispatcher hides and preserves sessions outside every pinned binding',async()=>{
 let revoked=0;
 for(const overrides of [{tenantId:otherStore},{storeId:otherStore},{issuer:'https://untrusted.test'}]){
  const dispatch=createOwnerSessionLifecycleDispatcher(config,{async loadHash(){return {...record(),...overrides};},async revokeHash(){revoked++;}});
  const message={version:1,operation:'owner.session.lookup',sessionHash:'a'.repeat(64)};
  assert.deepEqual(await dispatch(message),{version:1,ok:true,session:null});
  assert.deepEqual(await dispatch({...message,operation:'owner.session.revoke'}),{version:1,ok:true});
 }
 assert.equal(revoked,0);
});
test('pinned configuration is copied and unavailable storage fails closed without leaking details',async()=>{
 const input={...config},valid=record(),dispatch=createOwnerSessionLifecycleDispatcher(input,{async loadHash(){return valid;},async revokeHash(){}});input.storeId=otherStore;
 const token=randomBytes(32).toString('base64url'),remote=createRemoteOwnerSessionLifecycle(config,dispatch);assert.equal((await remote.load(token))?.storeId,storeId);
 const broken=createOwnerSessionLifecycleDispatcher(config,{async loadHash(){throw new Error('database credential');},async revokeHash(){}});
 await assert.rejects(broken({version:1,operation:'owner.session.lookup',sessionHash:hash(token)}),error=>error instanceof OwnerSessionUnavailable&&!error.message.includes('credential'));
});

test("merchant lifecycle resolves and revokes only exact registered store sessions in PostgreSQL", async () => {
  const db = new PGlite();
  await db.waitReady;
  const browserTokens = Array.from({ length: 5 }, () => randomBytes(32).toString("base64url"));
  const [merchantToken, independentToken, legacyToken, misboundToken, wrongIssuerToken] = browserTokens;
  const merchantSubject = "12345678-2222-4000-8000-000000000001";
  const secondSubject = "12345678-2222-4000-8000-000000000002";
  const otherIssuer = "https://cognito-idp.eu-west-2.amazonaws.com/eu-west-2_Other";

  try {
    await db.exec(readFileSync("database/migrations/0001_multi_tenant_foundation.sql", "utf8").replace("CREATE EXTENSION IF NOT EXISTS pgcrypto;", ""));
    await db.exec("CREATE ROLE zayvi_app NOLOGIN NOSUPERUSER NOBYPASSRLS; CREATE ROLE rds_iam NOLOGIN");
    for (const file of ["identity-membership-directory.sql", "owner-login-attempts.sql", "owner-sessions.sql", "merchant-registration.sql", "merchant-registration-iam.sql", "merchant-sessions.sql"]) {
      await db.exec(readFileSync("database/proposals/" + file, "utf8"));
    }
    async function register(issuer: string, subject: string) {
      await db.exec("SET ROLE zayvi_merchant_registrar");
      const { rows: [binding] } = await db.query<{ tenant_id: string; store_id: string }>(
        "SELECT * FROM zayvi_registration.create_draft_store($1,$2,$3,$4)", [issuer, subject, "merchant@example.test", "Test Shop"],
      );
      await assert.rejects(db.query("SELECT * FROM zayvi_registration.registrations"), /permission denied/);
      await db.exec("RESET ROLE");
      const { rows: [identity] } = await db.query<{ membership_id: string }>(
        "SELECT membership_id FROM zayvi_identity.membership_directory WHERE issuer=$1 AND subject=$2", [issuer, subject],
      );
      return { ...binding, ...identity, issuer, subject };
    }
    const first = await register(providerIssuer, merchantSubject);
    const second = await register(providerIssuer, secondSubject);
    const otherProvider = await register(otherIssuer, merchantSubject);
    await db.exec(`INSERT INTO tenants(id,name,slug,status) VALUES('${tenantId}','Pilot','pilot','active');
      INSERT INTO tenant_memberships(id,tenant_id,identity_subject,email,role,status) VALUES('${member}','${tenantId}','legacy','owner@example.test','owner','active');
      INSERT INTO stores(id,tenant_id,name,slug) VALUES('${storeId}','${tenantId}','Pilot','pilot');
      INSERT INTO stores(id,tenant_id,name,slug) VALUES('${otherStore}','${first.tenant_id}','Another Store','another');
      INSERT INTO zayvi_identity.membership_directory VALUES('${providerIssuer}','${subject}','${tenantId}','${member}');`);
    async function seed(token: string, bound: typeof first) {
      await db.query(`INSERT INTO zayvi_owner_auth.owner_sessions
        (session_hash,tenant_id,store_id,membership_id,issuer,subject,role,authentication_time,provider_session_id,provider_token_id,expires_at)
        VALUES($1,$2,$3,$4,$5,$6,'owner',$7,'provider-session','provider-token',clock_timestamp()+interval '10 minutes')`,
      [hash(token), bound.tenant_id, bound.store_id, bound.membership_id, bound.issuer, bound.subject, Math.floor(Date.now()/1000)-10]);
    }
    await seed(merchantToken, first);
    await seed(independentToken, second);
    await seed(legacyToken, { tenant_id: tenantId, store_id: storeId, membership_id: member, issuer: providerIssuer, subject });
    await seed(misboundToken, { ...first, store_id: otherStore });
    await seed(wrongIssuerToken, otherProvider);
    await db.exec("SET ROLE zayvi_app");

    const lookup = { async query(sql: string, params?: unknown[]) { return { rows: (await db.query<Record<string, unknown>>(sql, params)).rows }; } };
    const dispatch = createMerchantSessionDispatcher({ deployment: "preview", providerIssuer }, lookup);
    const requests: MerchantSessionRequest[] = [];
    const remote = createRemoteMerchantSessionLifecycle({ deployment: "preview", providerIssuer }, async request => {
      requests.push(request);
      return dispatch(request);
    });
    assert.equal((await remote.load(merchantToken))?.storeId, first.store_id);
    assert.equal((await remote.load(independentToken))?.storeId, second.store_id);
    assert.equal(requests[0].sessionHash, hash(merchantToken));
    assert(!browserTokens.some(token => JSON.stringify(requests).includes(token)));
    await assert.rejects(dispatch({ ...requests[0], storeId }), OwnerSessionUnavailable);

    const generic = createPostgresOwnerSessionLifecycle(lookup);
    for (const outsideToken of [legacyToken, misboundToken, wrongIssuerToken]) {
      assert.equal(await remote.load(outsideToken), null);
      await remote.revoke(outsideToken);
      assert(await generic.loadHash(hash(outsideToken)));
    }
    await remote.revoke(merchantToken);
    await remote.revoke(merchantToken);
    assert.equal(await remote.load(merchantToken), null);
    assert(await remote.load(independentToken));
  } finally {
    await db.close();
  }
});
