import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash,randomBytes} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {generateKeyPair,exportJWK,createLocalJWKSet,SignJWT} from 'jose';
import type {OwnerRuntimeConfig} from '../lib/owner-auth-runtime';
import {createPreviewRemoteOwnerRuntime,type OwnerPrivateRequest} from '../lib/owner-remote-runtime';
import {createStoreDatabaseAdapters} from '../lib/store-database';
import {createTenantMembershipDirectory} from '../lib/tenant-membership-directory';
import {createPostgresOwnerSessions,createPostgresOwnerSessionLifecycle} from '../lib/owner-sessions';
import {createPostgresEncryptedOwnerAttemptStore} from '../lib/owner-login-attempts';
import {createOwnerAttemptDispatcher} from '../lib/owner-attempt-rpc';
import {createPrivateOwnerSessionCompletion} from '../lib/owner-session-completion-rpc';
import {createOwnerSessionLifecycleDispatcher} from '../lib/owner-session-lifecycle-rpc';
import {createPostgresOwnerLimitStore} from '../lib/owner-rate-limit';
import {createOwnerLimitDispatcher} from '../lib/owner-rate-limit-rpc';
import {createPrivateOwnerStoreSummary} from '../lib/owner-store-summary-rpc';
import {OWNER_BINDING_COOKIE,OWNER_SESSION_COOKIE} from '../lib/owner-auth-http';
import type {StoreDatabaseClient} from '../lib/store-database';
const tenant='11111111-1111-1111-1111-111111111111',store='22222222-2222-2222-2222-222222222222',member='33333333-3333-3333-3333-333333333333',subject='44444444-4444-4444-4444-444444444444';
const origin='https://preview.zayvi.store',issuer='https://cognito-idp.eu-west-2.amazonaws.com/eu-west-2_TestPool';
const config:OwnerRuntimeConfig={mode:'preview',deployment:'preview',origin,context:{key:'runtime-store',defaultPath:'/owner/store',allowedPaths:['/owner/store']},binding:{tenantId:tenant,storeId:store},domainPrefix:'zayvi-preview',provider:{userPoolId:'eu-west-2_TestPool',clientId:'testclient',requiredScopes:['zayvi/store.access']}};
const getCookie=(response:Response,name:string)=>response.headers.get('set-cookie')?.match(new RegExp(`${name}=([^;,]*)`))?.[1];
const post=(path:string,token?:string)=>new Request(`${origin}${path}`,{method:'POST',headers:{origin,...(token?{cookie:`${OWNER_SESSION_COOKIE}=${token}`}:{})}});
test('remote runtime activation is explicit and cannot enable the production deployment path',async()=>{
 for(const input of [{...config,mode:undefined},{...config,mode:'disabled' as const},{...config,deployment:'production'},{...config,deployment:'unknown'}]){
  const runtime=createPreviewRemoteOwnerRuntime(input);assert.equal(runtime.enabled,false);assert.equal((await runtime.handlers.start(post('/api/owner/auth/start'))).status,503);await assert.rejects(runtime.readStore('x'.repeat(43)));
 }
 assert.throws(()=>createPreviewRemoteOwnerRuntime(config),/adapters/);
});
test('remote web runtime composes signed provider responses and every private PostgreSQL boundary',async t=>{
 const db=new PGlite();await db.waitReady;
 try{
  await db.exec(readFileSync('database/migrations/0001_multi_tenant_foundation.sql','utf8').replace('CREATE EXTENSION IF NOT EXISTS pgcrypto;',''));
  await db.exec(`CREATE ROLE zayvi_app NOLOGIN NOSUPERUSER NOBYPASSRLS;GRANT USAGE ON SCHEMA public TO zayvi_app;GRANT SELECT ON tenants,tenant_memberships,stores TO zayvi_app;GRANT UPDATE(id) ON stores TO zayvi_app;
    INSERT INTO tenants(id,name,slug,status) VALUES('${tenant}','Runtime store','runtime','active');
    INSERT INTO tenant_memberships(id,tenant_id,identity_subject,email,role,status) VALUES('${member}','${tenant}','legacy','owner@example.test','owner','active');
    INSERT INTO stores(id,tenant_id,name,slug) VALUES('${store}','${tenant}','Runtime store','runtime');`);
  for(const file of ['identity-membership-directory.sql','owner-login-attempts.sql','owner-sessions.sql','owner-rate-limits.sql'])await db.exec(readFileSync(`database/proposals/${file}`,'utf8'));
  await db.query('INSERT INTO zayvi_identity.membership_directory VALUES($1,$2,$3,$4)',[issuer,subject,tenant,member]);await db.exec('SET ROLE zayvi_app');
  const client:StoreDatabaseClient={async query(sql,values){return {rows:(await db.query<Record<string,unknown>>(sql,values)).rows};},release(){}};
  const database=createStoreDatabaseAdapters({connect:async()=>client});
  const directory=createTenantMembershipDirectory({discovery:client,withTenantClient:database.withTenantClient});
  const sessions=createPostgresOwnerSessions({lookup:client,withTenantClient:database.withTenantClient});
  const binding={deployment:'preview',tenantId:tenant,storeId:store,providerIssuer:issuer};
  const runtimeKeys={attemptEncryption:randomBytes(32),completionProof:randomBytes(32),operationProof:randomBytes(32),limiterHash:randomBytes(32)};
  const attempt=createOwnerAttemptDispatcher(createPostgresEncryptedOwnerAttemptStore(client));
  const completion=createPrivateOwnerSessionCompletion(binding,runtimeKeys.completionProof,{...database,membershipDirectory:directory,writeSession:sessions.writeSession});
  const lifecycle=createOwnerSessionLifecycleDispatcher(binding,createPostgresOwnerSessionLifecycle(client));
  const limiter=createOwnerLimitDispatcher(createPostgresOwnerLimitStore(client));
  const summary=createPrivateOwnerStoreSummary(binding,runtimeKeys.operationProof,{...database,membershipDirectory:directory,sessions:createPostgresOwnerSessionLifecycle(client)});
  const wire:OwnerPrivateRequest[]=[];
  let available=true;
  async function invoke(input:OwnerPrivateRequest):Promise<unknown>{
    wire.push(structuredClone(input));if(!available)throw new Error('private database connection');
    switch(input.operation){
      case 'owner.attempt.create':case 'owner.attempt.consume':return attempt(input);
      case 'owner.session.complete':return completion(input);
      case 'owner.session.lookup':case 'owner.session.revoke':return lifecycle(input);
      case 'owner.limit.consume':return limiter(input);
      case 'owner.store.summary':return summary(input);
    }
  }
  const accessKeys=await generateKeyPair('RS256'),idKeys=await generateKeyPair('RS256');
  const keys=createLocalJWKSet({keys:[{...await exportJWK(accessKeys.publicKey),kid:'access',alg:'RS256'},{...await exportJWK(idKeys.publicKey),kid:'id',alg:'RS256'}]});
  let authorization:URL,wrongNonce=false,allowed=true,providerActive=true,exchanges=0,loginAssurance=0,currentAssurance=0;
  const dependencies={keys:runtimeKeys,identityKeys:keys,invoke,identifyConnection:async()=>allowed?'trusted-connection':'limited-connection',
    async verifyLoginAssurance(){loginAssurance++;return {active:true,mfaVerified:true};},async verifyCurrentAssurance(){currentAssurance++;return {active:providerActive,mfaVerified:true};},
    providerExchange:(async(_url,options)=>{
      exchanges++;const body=options?.body as URLSearchParams;assert.equal(body.get('redirect_uri'),`${origin}/api/owner/auth/callback`);assert.equal(createHash('sha256').update(body.get('code_verifier')!).digest('base64url'),authorization.searchParams.get('code_challenge'));
      const now=Math.floor(Date.now()/1000),common={iss:issuer,sub:subject,iat:now,exp:now+900,auth_time:now-10,origin_jti:'runtime-provider-session'};
      const accessToken=await new SignJWT({...common,token_use:'access',client_id:'testclient',scope:'openid zayvi/store.access',username:'owner',jti:'access-id'}).setProtectedHeader({alg:'RS256',kid:'access',typ:'JWT'}).sign(accessKeys.privateKey);
      const idToken=await new SignJWT({...common,token_use:'id',aud:'testclient',nonce:wrongNonce?'wrong-nonce':authorization.searchParams.get('nonce'),jti:'id-id',at_hash:createHash('sha256').update(accessToken).digest().subarray(0,16).toString('base64url')}).setProtectedHeader({alg:'RS256',kid:'id',typ:'JWT'}).sign(idKeys.privateKey);
      return Response.json({access_token:accessToken,id_token:idToken,token_type:'Bearer',expires_in:900});
    }) as typeof fetch,
  };
  const runtime=createPreviewRemoteOwnerRuntime(config,dependencies);
  async function begin(){const response=await runtime.handlers.start(post('/api/owner/auth/start'));assert.equal(response.status,303);authorization=new URL(response.headers.get('location')!);return {binding:getCookie(response,OWNER_BINDING_COOKIE)!,state:authorization.searchParams.get('state')!};}
  function callback(start:{binding:string;state:string}){return new Request(`${origin}/api/owner/auth/callback?code=provider-code&state=${start.state}`,{headers:{cookie:`${OWNER_BINDING_COOKIE}=${start.binding}`}});}
  const status=(token:string)=>runtime.handlers.status(new Request(`${origin}/api/owner/auth/status`,{headers:{cookie:`${OWNER_SESSION_COOKIE}=${token}`}}));
  let liveToken='';
  await t.test('HTTP start, PKCE exchange, signed token pair, membership and session commit compose',async()=>{
    const started=await begin(),response=await runtime.handlers.callback(callback(started));assert.equal(response.status,303);assert.equal(response.headers.get('location'),`${origin}/owner/store`);liveToken=getCookie(response,OWNER_SESSION_COOKIE)!;assert.match(liveToken,/^[A-Za-z0-9_-]{43}$/);assert.equal(loginAssurance,1);assert.equal((await status(liveToken)).status,200);assert(currentAssurance>0);assert.equal((await runtime.readStore(liveToken)).id,store);assert(!('authorise' in runtime));assert(!JSON.stringify(wire).includes(liveToken));
    const before=exchanges;const replay=await runtime.handlers.callback(callback(started));assert(!getCookie(replay,OWNER_SESSION_COOKIE));assert.equal(exchanges,before);
  });
  await t.test('a wrong nonce cannot reach assurance or create a cookie',async()=>{
    wrongNonce=true;const before=loginAssurance,started=await begin(),response=await runtime.handlers.callback(callback(started));assert(!getCookie(response,OWNER_SESSION_COOKIE));assert.equal(loginAssurance,before);wrongNonce=false;
  });
  await t.test('current provider revocation and revoked memberships deny an earlier session',async()=>{
    providerActive=false;assert.equal((await status(liveToken)).status,401);providerActive=true;
    await db.exec('RESET ROLE');await db.query("UPDATE tenant_memberships SET status='removed' WHERE id=$1",[member]);await db.exec('SET ROLE zayvi_app');assert.equal((await status(liveToken)).status,401);
    await db.exec('RESET ROLE');await db.query("UPDATE tenant_memberships SET status='active' WHERE id=$1",[member]);await db.exec('SET ROLE zayvi_app');
  });
  await t.test('another trusted store binding cannot use this session',async()=>{
    const other=createPreviewRemoteOwnerRuntime({...config,binding:{tenantId:tenant,storeId:'55555555-5555-5555-5555-555555555555'}},dependencies);await assert.rejects(other.readStore(liveToken));
  });
  await t.test('rate limiting blocks start before exchanging or persisting a new login',async()=>{
    allowed=false;const before=exchanges;for(let i=0;i<10;i++)assert.equal((await runtime.handlers.start(post('/api/owner/auth/start'))).status,303);assert.equal((await runtime.handlers.start(post('/api/owner/auth/start'))).status,429);assert.equal(exchanges,before);allowed=true;
  });
  await t.test('private transport outage denies the handler and exposes no database details',async()=>{
    available=false;const response=await status(liveToken);assert.equal(response.status,503);assert(!(await response.text()).includes('database connection'));available=true;
  });
  await t.test('secrets must be distinct and missing trusted identity prevents login',async()=>{
    assert.throws(()=>createPreviewRemoteOwnerRuntime(config,{...dependencies,keys:{...runtimeKeys,completionProof:runtimeKeys.attemptEncryption}}),/distinct/);
    const missing=createPreviewRemoteOwnerRuntime(config,{...dependencies,identifyConnection:async()=>null});assert.equal((await missing.handlers.start(post('/api/owner/auth/start'))).status,503);
  });
  await t.test('logout revokes the server record and later requests fail',async()=>{
    assert.equal((await runtime.handlers.logout(post('/api/owner/auth/logout',liveToken))).status,204);assert.equal((await status(liveToken)).status,401);
    for(const operation of ['owner.attempt.create','owner.attempt.consume','owner.session.complete','owner.session.lookup','owner.limit.consume','owner.store.summary','owner.session.revoke'])assert(wire.some(message=>message.operation===operation));
  });
 }finally{await db.close();}
});
