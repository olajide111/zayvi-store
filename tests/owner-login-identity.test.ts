import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {generateKeyPair,exportJWK,createLocalJWKSet,SignJWT,type JWTPayload} from 'jose';
import {createMerchantRegistrationIdentityVerifier,createOwnerLoginIdentityVerifier} from '../lib/owner-identity';
import {createMerchantRegistrationCompletion} from '../lib/merchant-registration-completion';
import type {OwnerSessionRecord} from '../lib/owner-login-completion';
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

const verifiedEmail = { email: "merchant@example.test", email_verified: true };

test("only a signed, verified email from the matched ID token can register", async () => {
  let assuranceChecks = 0;
  const verify = createMerchantRegistrationIdentityVerifier(config, async () => {
    assuranceChecks++;
    return { active: true, mfaVerified: true };
  }, resolver);

  for (const claims of [{}, { ...verifiedEmail, email_verified: false },
    { ...verifiedEmail, email_verified: "true" }, { ...verifiedEmail, email: "invalid" }]) {
    await assert.rejects(verify(await tokens(claims, verifiedEmail), nonce));
  }
  await assert.rejects(verify(await tokens(verifiedEmail, {}, true), nonce));
  assert.equal(assuranceChecks, 0);

  const identity = await verify(await tokens(verifiedEmail), nonce);
  assert.equal(identity.email, verifiedEmail.email);
  assert.equal(identity.identity.subject, subject);
  assert.equal(assuranceChecks, 1);
});

test("registration binds the verified merchant to a draft before committing a session", async () => {
  const tenantId = "11111111-2222-4000-8000-000000000001";
  const storeId = "11111111-2222-4000-8000-000000000002";
  const calls: string[] = [];
  const records: OwnerSessionRecord[] = [];
  let allowMfa = false;
  let rejectCommit = false;

  const finish = createMerchantRegistrationCompletion([
    config,
    async () => ({ active: true, mfaVerified: allowMfa }),
    resolver,
  ], {
    async connect() {
      calls.push("connect");
      return {
        async query(sql, parameters) {
          calls.push("provision");
          assert.match(sql, /zayvi_registration\.create_draft_store\(\$1,\$2,\$3,\$4\)/);
          assert.deepEqual(parameters, [issuer, subject, verifiedEmail.email, "New Store"]);
          return { rows: [{ tenant_id: tenantId, store_id: storeId }] };
        },
        release() { calls.push("release"); },
      };
    },
  }, {
    membershipDirectory: {
      async findMemberships(identity) {
        assert.equal(identity.subject, subject);
        return [{ tenantId, tenantName: "New Store", tenantStatus: "active", membershipId: "membership", membershipStatus: "active", role: "owner" }];
      },
      async isMembershipActive() { return true; },
    },
    transactions: {
      async withTenantTransaction(tenant, work) {
        assert.equal(tenant, tenantId);
        const result = await work();
        if (rejectCommit) throw new Error("session transaction commit failed");
        calls.push("commit");
        return result;
      },
    },
    stores: {
      async findStore(tenant, store) {
        assert.deepEqual([tenant, store], [tenantId, storeId]);
        return { id: storeId, tenantId, status: "draft" };
      },
    },
    async writeSession(context, record) {
      calls.push("session");
      assert.equal(context.store.id, storeId);
      records.push(record);
    },
  });

  const pair = await tokens(verifiedEmail);
  await assert.rejects(finish(pair, nonce, "New Store"));
  assert.deepEqual(calls, []);
  allowMfa = true;
  await assert.rejects(finish(pair, nonce, " "));
  assert.deepEqual(calls, []);

  rejectCommit = true;
  await assert.rejects(finish(pair, nonce, "New Store"));
  assert.deepEqual(calls, ["connect", "provision", "release", "session"]);
  calls.length = 0;

  rejectCommit = false;
  const result = await finish(pair, nonce, " New Store ");
  assert.deepEqual([result.tenantId, result.storeId], [tenantId, storeId]);
  assert.deepEqual(calls, ["connect", "provision", "release", "session", "commit"]);
  assert.equal(records.at(-1)?.sessionHash, createHash("sha256").update(result.sessionToken).digest("hex"));
  assert.notEqual(records.at(-1)?.sessionHash, result.sessionToken);
});
