import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPair,exportJWK,createLocalJWKSet,SignJWT,type JWTPayload} from 'jose';
import {createOwnerIdentityProvider,type OwnerSessionVerifier} from '../lib/owner-identity';
import {TenantAccessError} from '../lib/tenant-access';
const config={userPoolId:'eu-west-2_TestPool',clientId:'testclient123',requiredScopes:['zayvi/store.access']};
const issuer='https://cognito-idp.eu-west-2.amazonaws.com/eu-west-2_TestPool';
const subject='11111111-1111-1111-1111-111111111111';
const keys=await generateKeyPair('RS256'),other=await generateKeyPair('RS256');
const jwk={...await exportJWK(keys.publicKey),kid:'trusted',alg:'RS256',use:'sig'};
const resolver=createLocalJWKSet({keys:[jwk]});
function claims():JWTPayload {const now=Math.floor(Date.now()/1000);return {iss:issuer,sub:subject,iat:now,exp:now+900,auth_time:now-10,client_id:config.clientId,token_use:'access',scope:'openid zayvi/store.access',username:'user',jti:'token-1',origin_jti:'session-1'};}
async function sign(payload:JWTPayload,opts:{otherKey?:boolean;alg?:string;kid?:string}={}){return new SignJWT(payload).setProtectedHeader({alg:opts.alg||'RS256',kid:opts.kid||'trusted',typ:'JWT'}).sign(opts.otherKey?other.privateKey:keys.privateKey);}
const active:OwnerSessionVerifier=async()=>({active:true,mfaVerified:true});
function provider(check=active){return createOwnerIdentityProvider(config,check,resolver);}
async function rejects(payload:JWTPayload){await assert.rejects(provider().verifyAccessToken(await sign(payload)),e=>e instanceof TenantAccessError&&e.code==='UNAUTHENTICATED'&&!e.message.includes('token-1'));}
test('a signed access token resolves identity only after the trusted session check',async()=>{
 let called=0;const p=provider(async session=>{called++;assert.deepEqual(session,{issuer,subject,tokenId:'token-1',sessionId:'session-1',authenticationTime:claims().auth_time});return {active:true,mfaVerified:true};});
 const result=await p.verifyAccessToken(await sign(claims()));assert.equal(result.subject,subject);assert.equal(result.issuer,issuer);assert.equal(result.mfaVerified,true);assert.equal(called,1);assert(!('role' in result));
});
test('forged signatures, unknown signing keys and malformed tokens never reach session checking',async()=>{
 let checked=false;const p=provider(async()=>{checked=true;return {active:true,mfaVerified:true};});
 for(const token of ['', 'not-a-jwt','x'.repeat(16385),await sign(claims(),{otherKey:true}),await sign(claims(),{kid:'unknown'})])await assert.rejects(p.verifyAccessToken(token),TenantAccessError);
 assert.equal(checked,false);
});
test('ID tokens, wrong pools, other clients and machine identities are rejected',async()=>{
 for(const overrides of [{token_use:'id'},{iss:'https://other.example'},{client_id:'foreign'},{sub:'machine-client'},{username:''},{aud:'another-resource'}])await rejects({...claims(),...overrides});
});
test('expired, future, excessively long-lived and incomplete claims fail closed',async()=>{
 const now=Math.floor(Date.now()/1000);
 for(const overrides of [{exp:now-10,iat:now-100},{iat:now+100,exp:now+1000},{exp:now+4000},{auth_time:now+10},{auth_time:-1}])await rejects({...claims(),...overrides});
 for(const name of ['sub','exp','iat','auth_time','scope','token_use','client_id','username','jti','origin_jti']){const payload=claims();delete payload[name];await rejects(payload);}
});
test('scopes are exact grants and optional resource audience is verified',async()=>{
 await rejects({...claims(),scope:'zayvi/store.access.extra'});
 const p=createOwnerIdentityProvider({...config,resourceAudience:'https://api.zayvi.store'},active,resolver);
 await assert.rejects(p.verifyAccessToken(await sign(claims())),TenantAccessError);
 assert.equal((await p.verifyAccessToken(await sign({...claims(),aud:'https://api.zayvi.store'}))).subject,subject);
});
test('revoked sessions, missing MFA and session-check outages reject otherwise valid tokens',async()=>{
 for(const check of [async()=>({active:false,mfaVerified:true}),async()=>({active:true,mfaVerified:false}),async()=>{throw new Error('private provider diagnostics');}]){
  await assert.rejects(provider(check).verifyAccessToken(await sign({...claims(),amr:['mfa'],role:'owner',email:'owner@example.test'})),e=>e instanceof TenantAccessError&&e.message==='A verified owner sign-in is required.');
 }
});
test('algorithm substitution is denied before accepting a differently signed token',async()=>{const alternative=await generateKeyPair('RS512');const token=await new SignJWT(claims()).setProtectedHeader({alg:'RS512',kid:'trusted'}).sign(alternative.privateKey);await assert.rejects(provider().verifyAccessToken(token),TenantAccessError);});
test('configuration is server-owned, region-bound and copied before token verification',async()=>{
 for(const bad of [{...config,userPoolId:'https://attacker.invalid'},{...config,userPoolId:'us-east-1_Other'},{...config,clientId:''},{...config,requiredScopes:[]},{...config,requiredScopes:['two scopes']}])assert.throws(()=>createOwnerIdentityProvider(bad,active,resolver),/configuration/);
 const mutable={...config,requiredScopes:[...config.requiredScopes]};const p=createOwnerIdentityProvider(mutable,active,resolver);mutable.clientId='attacker';mutable.requiredScopes[0]='other';assert.equal((await p.verifyAccessToken(await sign(claims()))).subject,subject);
});
