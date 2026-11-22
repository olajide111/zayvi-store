import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomBytes,createHash} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {decodeJwt,SignJWT} from 'jose';
import {createPrivateOwnerSessionCompletion,createRemoteOwnerLoginCompletion,type OwnerCompletionRequest} from '../lib/owner-session-completion-rpc';
import {createStoreDatabaseAdapters,type StoreDatabaseClient} from '../lib/store-database';
import {createTenantMembershipDirectory} from '../lib/tenant-membership-directory';
import {createPostgresOwnerSessions} from '../lib/owner-sessions';
import {OwnerLoginError} from '../lib/owner-login';

const tenantId='11111111-1111-1111-1111-111111111111',storeId='22222222-2222-2222-2222-222222222222';
const member='33333333-3333-3333-3333-333333333333',subject='44444444-4444-4444-4444-444444444444';
const providerIssuer='https://cognito-idp.eu-west-2.amazonaws.com/eu-west-2_TestPool';
const config={deployment:'preview',providerIssuer,tenantId,storeId};
const tokens={accessToken:'raw-provider-access',idToken:'raw-provider-id',expiresIn:600};
test('signed session completion preserves private PostgreSQL membership and transaction checks',async t=>{
  const db=new PGlite();await db.waitReady;
  try{
    await db.exec(readFileSync('database/migrations/0001_multi_tenant_foundation.sql','utf8').replace('CREATE EXTENSION IF NOT EXISTS pgcrypto;',''));
    await db.exec(`CREATE ROLE zayvi_app NOLOGIN NOSUPERUSER NOBYPASSRLS;GRANT USAGE ON SCHEMA public TO zayvi_app;
      GRANT SELECT ON tenants,tenant_memberships,stores TO zayvi_app;GRANT UPDATE(id) ON stores TO zayvi_app;
      INSERT INTO tenants(id,name,slug,status) VALUES('${tenantId}','Pilot','pilot','active');
      INSERT INTO tenant_memberships(id,tenant_id,identity_subject,email,role,status) VALUES('${member}','${tenantId}','legacy','owner@example.test','owner','active');
      INSERT INTO stores(id,tenant_id,name,slug) VALUES('${storeId}','${tenantId}','Pilot','pilot');`);
    for(const file of ['identity-membership-directory.sql','owner-login-attempts.sql','owner-sessions.sql'])await db.exec(readFileSync(`database/proposals/${file}`,'utf8'));
    await db.query('INSERT INTO zayvi_identity.membership_directory VALUES($1,$2,$3,$4)',[providerIssuer,subject,tenantId,member]);
    await db.exec('SET ROLE zayvi_app');
    let databaseQueries=0;
    const client:StoreDatabaseClient={async query(sql,values){databaseQueries++;return {rows:(await db.query<Record<string,unknown>>(sql,values)).rows};},release(){}};
    const adapters=createStoreDatabaseAdapters({connect:async()=>client});
    const directory=createTenantMembershipDirectory({discovery:client,withTenantClient:adapters.withTenantClient});
    const sessions=createPostgresOwnerSessions({lookup:client,withTenantClient:adapters.withTenantClient});
    const dependencies={...adapters,membershipDirectory:directory,writeSession:sessions.writeSession};
    const key=randomBytes(32),dispatch=createPrivateOwnerSessionCompletion(config,key,dependencies);
    let last:OwnerCompletionRequest,verifyAllowed=true,invocations=0;
    const verifyLoginTokens=async()=>{
      if(!verifyAllowed)throw new Error('Provider details must not escape');
      const identity={issuer:providerIssuer,subject,mfaVerified:true as const,authenticationTime:Math.floor(Date.now()/1000)-10};
      return {identity,providerSession:{...identity,sessionId:'provider-session',tokenId:'provider-token'},expiresAt:Math.floor(Date.now()/1000)+600};
    };
    const finish=createRemoteOwnerLoginCompletion(config,key,{verifyLoginTokens,async invoke(request){invocations++;last=structuredClone(request);return dispatch(structuredClone(request));}});
    async function count(){await db.exec('RESET ROLE');const n=(await db.query<{n:number}>('SELECT count(*)::int AS n FROM zayvi_owner_auth.owner_sessions')).rows[0].n;await db.exec('SET ROLE zayvi_app');return n;}
    async function admin(sql:string){await db.exec('RESET ROLE');await db.exec(sql);await db.exec('SET ROLE zayvi_app');}
    await t.test('raw handles/tokens stay web-side; committed session uses current database membership',async()=>{
      const {sessionToken}=await finish(tokens,'verified-nonce');
      const stored=await sessions.load(sessionToken);assert.equal(stored?.role,'owner');assert.equal(stored?.membershipId,member);
      assert.equal(stored?.storeId,storeId);assert.equal(decodeJwt(last.proof).jti,createHash('sha256').update(sessionToken).digest('hex'));
      const wire=JSON.stringify(last);assert(!wire.includes(sessionToken));assert(!wire.includes(tokens.accessToken));assert(!wire.includes(tokens.idToken));
      assert.equal(await count(),1);await assert.rejects(db.query('SELECT * FROM zayvi_owner_auth.owner_sessions'),/permission denied/);
    });
    await t.test('replaying the same signed proof cannot create another session',async()=>{
      const before=await count();await assert.rejects(dispatch(last),OwnerLoginError);assert.equal(await count(),before);
    });
    await t.test('failed provider verification never invokes the private service',async()=>{
      verifyAllowed=false;const before=invocations;await assert.rejects(finish(tokens,'nonce'),OwnerLoginError);assert.equal(invocations,before);verifyAllowed=true;
    });
    await t.test('forged, expired, wrong-binding and missing-MFA proofs are denied before database work',async()=>{
      const payload=decodeJwt(last.proof),now=Math.floor(Date.now()/1000);
      const invalid=[{...payload,exp:now-1,iat:now-20},{...payload,iat:now,exp:now+60},
        {...payload,aud:'other-service'},{...payload,aud:['urn:zayvi:preview:owner-db','other-service']},
        {...payload,role:'owner'},{...payload,iss:'other-issuer'},{...payload,mfa:false},
        {...payload,tenant:'55555555-5555-5555-5555-555555555555'},
        {...payload,store:'55555555-5555-5555-5555-555555555555'},
        {...payload,provider_issuer:'https://untrusted.example'},{...payload,sub:'not-a-user'}];
      const before=await count();
      for(const claims of invalid){
        const proof=await new SignJWT(claims).setProtectedHeader({alg:'HS256',typ:'zayvi-owner-completion+jwt'}).sign(key);
        const queries=databaseQueries;await assert.rejects(dispatch({...last,proof}),OwnerLoginError);assert.equal(databaseQueries,queries);
      }
      const forged=await new SignJWT(payload).setProtectedHeader({alg:'HS256',typ:'zayvi-owner-completion+jwt'}).sign(randomBytes(32));
      const queries=databaseQueries;await assert.rejects(dispatch({...last,proof:forged}),OwnerLoginError);assert.equal(databaseQueries,queries);
      await assert.rejects(dispatch({...last,role:'owner'}),OwnerLoginError);
      await assert.rejects(dispatch({...last,sql:'SELECT 1'}),OwnerLoginError);
      assert.equal(await count(),before);
    });
    await t.test('removed membership and paused store prevent a session commit',async()=>{
      const before=await count();await admin(`UPDATE tenant_memberships SET status='removed' WHERE id='${member}'`);
      await assert.rejects(finish(tokens,'nonce'),OwnerLoginError);assert.equal(await count(),before);
      await admin(`UPDATE tenant_memberships SET status='active' WHERE id='${member}';UPDATE stores SET status='paused' WHERE id='${storeId}'`);
      await assert.rejects(finish(tokens,'nonce'),OwnerLoginError);assert.equal(await count(),before);
      await admin(`UPDATE stores SET status='draft' WHERE id='${storeId}'`);
    });
    await t.test('a current database role, never a web-supplied role, is persisted',async()=>{
      await admin(`UPDATE tenant_memberships SET role='read_only' WHERE id='${member}'`);
      const {sessionToken}=await finish(tokens,'nonce');assert.equal((await sessions.load(sessionToken))?.role,'read_only');
      await admin(`UPDATE tenant_memberships SET role='owner' WHERE id='${member}'`);
    });
    await t.test('failure after insertion rolls back the session before returning',async()=>{
      const failing=createPrivateOwnerSessionCompletion(config,key,{...dependencies,async writeSession(context,record){await sessions.writeSession(context,record);throw new Error('After insert');}});
      const remote=createRemoteOwnerLoginCompletion(config,key,{verifyLoginTokens,invoke:failing});
      const before=await count();await assert.rejects(remote(tokens,'nonce'),OwnerLoginError);assert.equal(await count(),before);
    });
    await t.test('lost replies cannot expose a handle or automatically retry completion',async()=>{
      let calls=0;const before=await count();
      const remote=createRemoteOwnerLoginCompletion(config,key,{verifyLoginTokens,async invoke(request){calls++;await dispatch(request);throw new Error('Lost reply with private diagnostics');}});
      await assert.rejects(remote(tokens,'nonce'),error=>error instanceof OwnerLoginError&&!error.message.includes('diagnostics'));
      assert.equal(calls,1);assert.equal(await count(),before+1);
    });
    await t.test('invalid private replies never release the raw session handle',async()=>{
      for(const reply of [null,{version:1,ok:true},{version:1,ok:true,expiresAt:1},{version:1,ok:true,expiresAt:1,role:'owner'}]){
        const remote=createRemoteOwnerLoginCompletion(config,key,{verifyLoginTokens,invoke:async()=>reply});await assert.rejects(remote(tokens,'nonce'),OwnerLoginError);
      }
    });
    assert.throws(()=>createPrivateOwnerSessionCompletion({...config,deployment:'production'},key,dependencies));
    assert.throws(()=>createPrivateOwnerSessionCompletion(config,randomBytes(16),dependencies));
  }finally{await db.close();}
});
