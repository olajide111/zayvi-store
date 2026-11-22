import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {createPostgresOwnerLoginAttempts} from '../lib/owner-login-attempts';
import {createOwnerLogin,OwnerLoginError,type OwnerLoginAttempt} from '../lib/owner-login';
function attempt():OwnerLoginAttempt{const createdAt=Math.floor(Date.now()/1000);return {stateHash:randomBytes(32).toString('hex'),browserHash:randomBytes(32).toString('hex'),verifier:randomBytes(32).toString('base64url'),nonce:randomBytes(32).toString('base64url'),createdAt,expiresAt:createdAt+600,returnTo:'/admin/pilots/hammy'};}
test('encrypted login attempts against embedded PostgreSQL',async t=>{
 const db=new PGlite();await db.waitReady;
 try{
  await db.exec('CREATE ROLE zayvi_app NOLOGIN NOSUPERUSER NOBYPASSRLS;CREATE ROLE unrelated NOLOGIN;');
  await db.exec(readFileSync('database/proposals/owner-login-attempts.sql','utf8'));
  await db.exec('SET ROLE zayvi_app');
  const client={async query(sql:string,values?:unknown[]){return {rows:(await db.query<Record<string,unknown>>(sql,values)).rows};}};
  const key=randomBytes(32),first=createPostgresOwnerLoginAttempts(client,key),second=createPostgresOwnerLoginAttempts(client,key);
  await t.test('independent app instances consume encrypted attempts only once',async()=>{
   const value=attempt();await first.create(value);await db.exec('RESET ROLE');
   const stored=(await db.query<{encrypted_payload:string}>('SELECT encrypted_payload FROM zayvi_owner_auth.login_attempts WHERE state_hash=$1',[value.stateHash])).rows[0].encrypted_payload;
   assert(!stored.includes(value.verifier));assert(!stored.includes(value.nonce));await db.exec('SET ROLE zayvi_app');
   assert.deepEqual(await second.consume(value.stateHash,value.browserHash,Math.floor(Date.now()/1000)),value);
   assert.equal(await first.consume(value.stateHash,value.browserHash,Math.floor(Date.now()/1000)),null);
  });
  await t.test('a wrong browser cannot consume another browser’s attempt',async()=>{
   const value=attempt();await first.create(value);assert.equal(await second.consume(value.stateHash,'0'.repeat(64),0),null);assert.deepEqual(await second.consume(value.stateHash,value.browserHash,0),value);
  });
  await t.test('database expiry cannot be bypassed by an old application clock',async()=>{
   const value=attempt();await first.create(value);await db.exec('RESET ROLE');
   await db.query("UPDATE zayvi_owner_auth.login_attempts SET created_at=clock_timestamp()-interval '20 minutes',expires_at=clock_timestamp()-interval '15 minutes' WHERE state_hash=$1",[value.stateHash]);await db.exec('SET ROLE zayvi_app');
   assert.equal(await second.consume(value.stateHash,value.browserHash,value.createdAt-3600),null);
  });
  await t.test('ciphertext swapped between attempts fails authentication and stays consumed',async()=>{
   const one=attempt(),two=attempt();await first.create(one);await first.create(two);await db.exec('RESET ROLE');
   await db.query('UPDATE zayvi_owner_auth.login_attempts SET encrypted_payload=(SELECT encrypted_payload FROM zayvi_owner_auth.login_attempts WHERE state_hash=$1) WHERE state_hash=$2',[two.stateHash,one.stateHash]);await db.exec('SET ROLE zayvi_app');
   await assert.rejects(second.consume(one.stateHash,one.browserHash,0),OwnerLoginError);assert.equal(await first.consume(one.stateHash,one.browserHash,0),null);
  });
  await t.test('direct table access and public function execution are denied',async()=>{
   await assert.rejects(db.query('SELECT * FROM zayvi_owner_auth.login_attempts'),/permission denied/);
   const privilege=(await db.query<{allowed:boolean}>("SELECT has_function_privilege('unrelated','zayvi_owner_auth.consume_attempt(text,text)','EXECUTE') AS allowed")).rows[0];assert.equal(privilege.allowed,false);
  });
  await t.test('PKCE callback works through another instance without an in-memory attempt store',async()=>{
   let completed=0;
   const config={domainPrefix:'zayvi-preview',clientId:'testclient',appOrigin:'https://preview.zayvi.store',scopes:['openid','zayvi/store.access']};
   const dependencies={fetcher:(async()=>Response.json({access_token:'access',id_token:'identity',token_type:'Bearer',expires_in:900})) as typeof fetch,
    async finishVerifiedSignIn(){completed++;return {sessionToken:'s'.repeat(43)};}};
   const start=await createOwnerLogin(config,{...dependencies,attempts:first}).begin();
   const url=new URL(start.authorizationUrl),params=new URLSearchParams({state:url.searchParams.get('state')!,code:'one-use-code'});
   const callback=createOwnerLogin(config,{...dependencies,attempts:second});
   assert.equal((await callback.complete(params,start.browserBinding)).sessionToken,'s'.repeat(43));
   await assert.rejects(callback.complete(params,start.browserBinding),OwnerLoginError);assert.equal(completed,1);
  });
 }finally{await db.close();}
});
