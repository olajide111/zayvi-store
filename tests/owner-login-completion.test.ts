import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createOwnerLoginCompletion,type OwnerSessionRecord} from '../lib/owner-login-completion';
import {OwnerLoginError} from '../lib/owner-login';
const tenantId='11111111-1111-1111-1111-111111111111',storeId='22222222-2222-2222-2222-222222222222';
const identity={issuer:'https://issuer.example',subject:'user',authenticationTime:100,mfaVerified:true as const};
function fixture(options:{revoked?:boolean;foreignStore?:boolean;commitFails?:boolean;verifyFails?:boolean}={}){
 const calls:string[]=[];let record:OwnerSessionRecord|undefined;
 const finish=createOwnerLoginCompletion({tenantId,storeId},{
  async verifyLoginTokens(tokens,nonce){calls.push('tokens');assert.equal(tokens.accessToken,'access');assert.equal(nonce,'expected-nonce');if(options.verifyFails)throw new Error('Invalid pair');return {identity,providerSession:{...identity,tokenId:'provider-token',sessionId:'provider-session'},expiresAt:Math.floor(Date.now()/1000)+600};},
  membershipDirectory:{async findMemberships(verified){calls.push('discover');assert.equal(verified.subject,identity.subject);return [{tenantId,tenantName:'Hammy',tenantStatus:'active',membershipId:'membership',membershipStatus:'active',role:'owner'}];},async isMembershipActive(){calls.push('membership');return !options.revoked;}},
  transactions:{async withTenantTransaction<T>(tenant:string,work:()=>Promise<T>){assert.equal(tenant,tenantId);calls.push('begin');try{const result=await work();if(options.commitFails)throw new Error('Commit lost');calls.push('commit');return result;}catch(error){calls.push('rollback');throw error;}}},
  stores:{async findStore(){calls.push('store');return {id:storeId,tenantId:options.foreignStore?'other':tenantId,status:'draft'};}},
  async writeSession(context,value){calls.push('session');assert.equal(context.store.id,storeId);assert.equal(context.identity.subject,identity.subject);record=value;},
 });
 return {finish,calls,record:()=>record};
}
const tokens={accessToken:'access',idToken:'identity',expiresIn:600};
test('session handles are issued only after token verification, store authorisation and commit',async()=>{
 const f=fixture(),result=await f.finish(tokens,'expected-nonce');assert.match(result.sessionToken,/^[A-Za-z0-9_-]{43}$/);assert.deepEqual(f.calls,['tokens','discover','begin','membership','store','session','commit']);assert.equal(f.record()?.sessionHash,createHash('sha256').update(result.sessionToken).digest('hex'));assert(!JSON.stringify(f.record()).includes(result.sessionToken));assert(!('accessToken' in f.record()!));
});
test('failed verification, revoked membership or a foreign store cannot write a session',async()=>{
 for(const options of [{verifyFails:true},{revoked:true},{foreignStore:true}]){const f=fixture(options);await assert.rejects(f.finish(tokens,'expected-nonce'),OwnerLoginError);assert(!f.calls.includes('session'));assert.equal(f.record(),undefined);}
});
test('commit failure returns no session handle',async()=>{
 const f=fixture({commitFails:true});await assert.rejects(f.finish(tokens,'expected-nonce'),OwnerLoginError);assert.equal(f.calls.at(-1),'rollback');assert(f.calls.includes('session'));
});
