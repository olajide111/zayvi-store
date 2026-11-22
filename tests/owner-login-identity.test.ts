import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {generateKeyPair,exportJWK,createLocalJWKSet,SignJWT,type JWTPayload} from 'jose';
import {createOwnerLoginIdentityVerifier} from '../lib/owner-identity';
const config={userPoolId:'eu-west-2_TestPool',clientId:'client123',requiredScopes:['zayvi/store.access']};
const issuer='https://cognito-idp.eu-west-2.amazonaws.com/eu-west-2_TestPool',subject='11111111-1111-1111-1111-111111111111',nonce='n'.repeat(43);
const accessKeys=await generateKeyPair('RS256'),idKeys=await generateKeyPair('RS256'),foreignKeys=await generateKeyPair('RS256');
const resolver=createLocalJWKSet({keys:[{...await exportJWK(accessKeys.publicKey),kid:'access',alg:'RS256'},{...await exportJWK(idKeys.publicKey),kid:'id',alg:'RS256'}]});
async function tokens(idOverrides:JWTPayload={},accessOverrides:JWTPayload={},foreign=false){
 const now=Math.floor(Date.now()/1000),common={iss:issuer,sub:subject,iat:now,auth_time:now-10,origin_jti:'session-1'};
 const accessToken=await new SignJWT({...common,exp:now+900,token_use:'access',client_id:config.clientId,scope:'zayvi/store.access',username:'user',jti:'access-jti',...accessOverrides}).setProtectedHeader({alg:'RS256',kid:'access',typ:'JWT'}).sign(accessKeys.privateKey);
 const at_hash=createHash('sha256').update(accessToken).digest().subarray(0,16).toString('base64url');
 const idToken=await new SignJWT({...common,exp:now+600,token_use:'id',aud:config.clientId,nonce,jti:'id-jti',at_hash,...idOverrides}).setProtectedHeader({alg:'RS256',kid:'id',typ:'JWT'}).sign(foreign?foreignKeys.privateKey:idKeys.privateKey);
 return {accessToken,idToken,expiresIn:900};
}
test('different trusted signing keys are supported and the session expires with the earlier token',async()=>{
 let checks=0;const verify=createOwnerLoginIdentityVerifier(config,async(session,pair)=>{checks++;assert.equal(session.subject,subject);assert(pair.accessToken&&pair.idToken);return {active:true,mfaVerified:true};},resolver);
 const result=await verify(await tokens(),nonce);assert.equal(result.identity.subject,subject);assert.equal(result.identity.mfaVerified,true);assert(result.expiresAt<=Math.floor(Date.now()/1000)+600);assert.equal(checks,1);
});
test('a foreign signature or a mismatched nonce, client, subject or session cannot reach assurance checking',async()=>{
 let checked=false;const verify=createOwnerLoginIdentityVerifier(config,async()=>{checked=true;return {active:true,mfaVerified:true};},resolver);
 for(const overrides of [{nonce:'x'.repeat(43)},{sub:'22222222-2222-2222-2222-222222222222'},{aud:'other-client'},{aud:[config.clientId,'other']},{origin_jti:'other-session'},{auth_time:1},{token_use:'access'},{at_hash:'wrong'},{azp:'other-client'}])await assert.rejects(verify(await tokens(overrides),nonce));
 await assert.rejects(verify(await tokens({}, {},true),nonce));assert.equal(checked,false);
});
test('expired or stale ID tokens and missing nonce do not authenticate a callback',async()=>{
 const verify=createOwnerLoginIdentityVerifier(config,async()=>({active:true,mfaVerified:true}),resolver),now=Math.floor(Date.now()/1000);
 for(const override of [{exp:now-30},{iat:now-4000,exp:now+20},{nonce:null}])await assert.rejects(verify(await tokens(override as JWTPayload),nonce));
 await assert.rejects(verify(await tokens(),'short'));
});
test('MFA-looking token claims cannot replace trusted active-session assurance',async()=>{
 for(const assurance of [{active:false,mfaVerified:true},{active:true,mfaVerified:false}]){
  const verify=createOwnerLoginIdentityVerifier(config,async()=>assurance,resolver);await assert.rejects(verify(await tokens({amr:['mfa'],role:'owner'}),nonce));
 }
});
