import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {createOwnerAuthLimiter,createPostgresOwnerLimitStore,OwnerLimitUnavailable} from '../lib/owner-rate-limit';
import {createOwnerLimitDispatcher,createRemoteOwnerLimitStore,type OwnerLimitRequest} from '../lib/owner-rate-limit-rpc';
test('separate server adapters share the PostgreSQL allowance; application cannot edit or read budgets',async()=>{
 const db=new PGlite();await db.waitReady;
 try{
  await db.exec('CREATE ROLE zayvi_app NOLOGIN NOSUPERUSER NOBYPASSRLS');
  await db.exec(readFileSync('database/proposals/owner-login-attempts.sql','utf8'));
  await db.exec(readFileSync('database/proposals/owner-rate-limits.sql','utf8'));
  await db.exec('SET ROLE zayvi_app');
  const store=createPostgresOwnerLimitStore({async query(sql,values){return {rows:(await db.query<Record<string,unknown>>(sql,values)).rows};}});
  const dispatch=createOwnerLimitDispatcher(store),wire:OwnerLimitRequest[]=[];
  const remote=()=>createRemoteOwnerLimitStore(async value=>{wire.push(value);return dispatch(structuredClone(value));});
  const key=randomBytes(32),identify=async()=> 'trusted-connection-key';
  const one=createOwnerAuthLimiter({key,identify,store:remote()}),two=createOwnerAuthLimiter({key,identify,store:remote()});
  const req=new Request('https://preview.zayvi.store/api/owner/auth/start',{headers:{'x-forwarded-for':'attacker-choice'}});
  const replies=await Promise.all(Array.from({length:12},(_,i)=>(i%2?one:two)('start',req)));
  assert.equal(replies.filter(Boolean).length,10);
  assert(!JSON.stringify(wire).includes('trusted-connection-key'));assert(!JSON.stringify(wire).includes('attacker-choice'));
  assert.equal(new Set(wire.map(value=>value.keyHash)).size,1);
  assert.equal(await one('logout',req),true,'action budgets are independent');
  await assert.rejects(db.query('SELECT * FROM zayvi_owner_auth.rate_limits'),/permission denied/);
  await assert.rejects(db.query('DELETE FROM zayvi_owner_auth.rate_limits'),/permission denied/);
  await assert.rejects(db.query('SELECT zayvi_owner_auth.purge_limits()'),/permission denied/);
  await assert.rejects(db.query("SELECT zayvi_owner_auth.consume_limit('start','global')"),/Invalid limiter/);
  await db.exec('RESET ROLE');
  const global=await db.query<{hits:number}>("SELECT hits FROM zayvi_owner_auth.rate_limits WHERE action='start' AND key_hash='global'");
  assert.equal(global.rows[0].hits,12);
  await db.exec("UPDATE zayvi_owner_auth.rate_limits SET window_start=0 WHERE action='start'");
  await db.exec('SET ROLE zayvi_app');assert.equal(await one('start',req),true,'expired windows reset on database time');
  await db.exec('RESET ROLE');
  await db.exec("UPDATE zayvi_owner_auth.rate_limits SET hits=1001 WHERE action='start' AND key_hash='global'");
  await db.exec('SET ROLE zayvi_app');assert.equal(await store.consume('start','f'.repeat(64)),false);
  await db.exec('RESET ROLE');
  assert.equal((await db.query("SELECT 1 FROM zayvi_owner_auth.rate_limits WHERE key_hash=$1",['f'.repeat(64)])).rows.length,0,'exhausted global admission does not create new keys');
  await db.exec("UPDATE zayvi_owner_auth.rate_limits SET window_start=0 WHERE key_hash<>'global'");
  const purged=await db.query<{count:number}>('SELECT zayvi_owner_auth.purge_limits() AS count');assert(purged.rows[0].count>0);
  assert.equal((await db.query("SELECT 1 FROM zayvi_owner_auth.rate_limits WHERE key_hash='global'")).rows.length,2);
 }finally{await db.close();}
});
test('missing trusted identity and unavailable storage fail closed without forwarding raw identifiers',async()=>{
 const key=randomBytes(32),req=new Request('https://preview.zayvi.store',{headers:{'x-forwarded-for':'127.0.0.1'}});let calls=0;
 const store={async consume(){calls++;return true;}};
 for(const identity of [null,'',' ','x'.repeat(257)])await assert.rejects(createOwnerAuthLimiter({key,identify:async()=>identity,store})('start',req),OwnerLimitUnavailable);
 assert.equal(calls,0);assert.throws(()=>createOwnerAuthLimiter({key:new Uint8Array(1),identify:async()=> 'a',store}),OwnerLimitUnavailable);
 const limiter=createOwnerAuthLimiter({key,identify:async()=> 'a',store:{async consume(){throw new Error('database credentials');}}});
 await assert.rejects(limiter('start',req),error=>error instanceof OwnerLimitUnavailable&&!error.message.includes('credentials'));
});
test('typed limiter boundary rejects browser fields, caller-selected policy, unknown operations and invalid replies',async()=>{
 let calls=0;const dispatch=createOwnerLimitDispatcher({async consume(){calls++;return true;}});
 const base={version:1,operation:'owner.limit.consume',action:'start',keyHash:'a'.repeat(64)};
 for(const value of [null,[],{...base,sql:'SELECT 1'},{...base,budget:9999},{...base,window:1},{...base,identity:'raw'},
  {...base,action:'unknown'},{...base,action:['start']},{...base,operation:'owner.limit.purge'},{...base,keyHash:'global'},{...base,version:2}])await assert.rejects(dispatch(value),OwnerLimitUnavailable);
 assert.equal(calls,0);
 for(const reply of [null,{version:1,ok:true},{version:1,ok:true,allowed:'yes'},{version:1,ok:true,allowed:true,extra:1}]){
  await assert.rejects(createRemoteOwnerLimitStore(async()=>reply).consume('start','a'.repeat(64)),OwnerLimitUnavailable);
 }
 let invocations=0;await assert.rejects(createRemoteOwnerLimitStore(async()=>{invocations++;throw new Error('lost response');}).consume('start','a'.repeat(64)),OwnerLimitUnavailable);
 assert.equal(invocations,1);
});
test('database adapter rejects malformed replies and hides database errors',async()=>{
 for(const rows of [[],[{allowed:'true'}],[{allowed:true},{allowed:true}]])await assert.rejects(createPostgresOwnerLimitStore({async query(){return {rows};}}).consume('start','a'.repeat(64)),OwnerLimitUnavailable);
 await assert.rejects(createPostgresOwnerLimitStore({async query(){throw new Error('secret');}}).consume('start','a'.repeat(64)),OwnerLimitUnavailable);
});
