import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {createOwnerAttemptDispatcher,createRemoteOwnerAttemptStore,type OwnerAttemptRequest} from '../lib/owner-attempt-rpc';
import {createEncryptedOwnerLoginAttempts,createPostgresEncryptedOwnerAttemptStore} from '../lib/owner-login-attempts';
import {OwnerLoginError,type OwnerLoginAttempt} from '../lib/owner-login';

function attempt():OwnerLoginAttempt{
  const createdAt=Math.floor(Date.now()/1000);
  return {contextKey:'platform',stateHash:randomBytes(32).toString('hex'),browserHash:randomBytes(32).toString('hex'),
    verifier:randomBytes(32).toString('base64url'),nonce:randomBytes(32).toString('base64url'),createdAt,expiresAt:createdAt+600,returnTo:'/owner'};
}
test('private attempt boundary preserves encrypted, one-use PostgreSQL persistence',async()=>{
  const db=new PGlite();await db.waitReady;
  try{
    await db.exec('CREATE ROLE zayvi_app NOLOGIN NOSUPERUSER NOBYPASSRLS');
    await db.exec(readFileSync('database/proposals/owner-login-attempts.sql','utf8'));
    await db.exec('SET ROLE zayvi_app');
    const database=createPostgresEncryptedOwnerAttemptStore({async query(sql,values){return {rows:(await db.query<Record<string,unknown>>(sql,values)).rows};}});
    const dispatch=createOwnerAttemptDispatcher(database),messages:OwnerAttemptRequest[]=[];
    const transport=async(input:OwnerAttemptRequest)=>{messages.push(structuredClone(input));return structuredClone(await dispatch(structuredClone(input)));};
    const key=randomBytes(32),one=createEncryptedOwnerLoginAttempts(createRemoteOwnerAttemptStore(transport),key);
    const two=createEncryptedOwnerLoginAttempts(createRemoteOwnerAttemptStore(transport),key);
    const value=attempt();await one.create(value);
    const wire=JSON.stringify(messages);assert(!wire.includes(value.verifier));assert(!wire.includes(value.nonce));assert(!wire.includes(value.returnTo));
    assert.equal(await two.consume(value.stateHash,'0'.repeat(64),0),null);
    const results=await Promise.all([one.consume(value.stateHash,value.browserHash,0),two.consume(value.stateHash,value.browserHash,0)]);
    assert.equal(results.filter(Boolean).length,1);assert.deepEqual(results.find(Boolean),value);
    await assert.rejects(one.create({...attempt(),expiresAt:value.createdAt+3600}),OwnerLoginError);
    await assert.rejects(db.query('SELECT * FROM zayvi_owner_auth.login_attempts'),/permission denied/);
  }finally{await db.close();}
});
test('dispatcher rejects caller-selected SQL, identity and unknown operations before storage',async()=>{
  let calls=0;
  const dispatch=createOwnerAttemptDispatcher({async create(){calls++;},async consume(){calls++;return null;}});
  const base={version:1,operation:'owner.attempt.consume',stateHash:'a'.repeat(64),browserHash:'b'.repeat(64)};
  for(const input of [null,[],{...base,version:2},{...base,operation:'query'},
    {...base,sql:'SELECT 1'},{...base,tenantId:'tenant'},{...base,role:'owner'},
    {...base,stateHash:'invalid'},{...base,providerUrl:'https://example.com'},
    {...base,operation:'owner.attempt.create',payload:'plaintext',expiresAt:123}]){
    await assert.rejects(dispatch(input),OwnerLoginError);
  }
  assert.equal(calls,0);
});
test('invalid replies and transport errors fail closed without retries or error details',async()=>{
  for(const reply of [null,{version:1,ok:true},{version:1,ok:false},
    {version:1,ok:true,payload:'plaintext'},{version:1,ok:true,payload:null,unexpected:'value'}]){
    const store=createRemoteOwnerAttemptStore(async()=>reply);
    await assert.rejects(store.consume('a'.repeat(64),'b'.repeat(64)),OwnerLoginError);
  }
  let consumed=false,calls=0;
  const dispatch=createOwnerAttemptDispatcher({async create(){},async consume(){consumed=true;return null;}});
  const store=createRemoteOwnerAttemptStore(async input=>{calls++;await dispatch(input);throw new Error('private provider detail');});
  await assert.rejects(store.consume('a'.repeat(64),'b'.repeat(64)),error=>error instanceof OwnerLoginError&&!error.message.includes('private'));
  assert.equal(consumed,true);assert.equal(calls,1);
});
