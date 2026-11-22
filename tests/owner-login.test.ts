import {HAMMY_OWNER_LOGIN_CONTEXT} from '../lib/hammy-owner-login-context';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createOwnerLogin,OwnerLoginError,type OwnerLoginAttempt} from '../lib/owner-login';
const config={domainPrefix:'zayvi-preview',clientId:'testclient123',appOrigin:'https://preview.zayvi.store',scopes:['openid','zayvi/store.access'],context:HAMMY_OWNER_LOGIN_CONTEXT};
const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
function fixture(options:{fetcher?:typeof fetch;finishFails?:boolean}={}){
 let clock=1000,exchanges=0,completed=0;const attempts=new Map<string,OwnerLoginAttempt>();
 const flow=createOwnerLogin(config,{
  now:()=>clock,
  attempts:{async create(attempt){attempts.set(attempt.stateHash,{...attempt});},async consume(stateHash,browserHash,now){const row=attempts.get(stateHash);if(!row||row.browserHash!==browserHash||row.expiresAt<=now)return null;attempts.delete(stateHash);return row;}},
  fetcher:options.fetcher??(async(url,init)=>{
   exchanges++;assert.equal(url,'https://zayvi-preview.auth.eu-west-2.amazoncognito.com/oauth2/token');assert.equal(init?.method,'POST');assert.equal(init?.redirect,'error');assert(init?.signal);
   const params=init?.body as URLSearchParams;assert.equal(params.get('redirect_uri'),'https://preview.zayvi.store/api/owner/auth/callback');assert.equal(params.get('grant_type'),'authorization_code');assert.match(params.get('code_verifier')!,/^[A-Za-z0-9_-]{43}$/);
   return Response.json({access_token:'access',id_token:'identity',refresh_token:'refresh',token_type:'Bearer',expires_in:3600});
  }) as typeof fetch,
  async finishVerifiedSignIn(tokens,nonce){completed++;assert.equal(tokens.accessToken,'access');assert.equal(tokens.idToken,'identity');assert.equal(tokens.refreshToken,'refresh');assert.match(nonce,/^[A-Za-z0-9_-]{43}$/);if(options.finishFails)throw new Error('private failure');return {sessionToken:'s'.repeat(43)};},
 });
 return {flow,attempts,expire(){clock+=601;},counts:()=>({exchanges,completed}),async begin(){const start=await flow.begin();const url=new URL(start.authorizationUrl);return {...start,url,params:new URLSearchParams({state:url.searchParams.get('state')!,code:'one-use-code'})};}};
}
test('authorisation uses random state, nonce, a browser binding and S256 without exposing the verifier',async()=>{
 const f=fixture(),one=await f.begin(),two=await f.begin();assert.notEqual(one.browserBinding,two.browserBinding);assert.notEqual(one.url.searchParams.get('state'),two.url.searchParams.get('state'));
 const attempt=f.attempts.get(digest(one.url.searchParams.get('state')!))!;assert.equal(attempt.browserHash,digest(one.browserBinding));assert.equal(one.url.searchParams.get('code_challenge'),createHash('sha256').update(attempt.verifier).digest('base64url'));assert.equal(one.url.searchParams.get('code_challenge_method'),'S256');assert.equal(one.url.searchParams.get('nonce'),attempt.nonce);assert(!one.authorizationUrl.includes(attempt.verifier));assert.equal(one.maxAge,600);
});
test('a matching callback exchanges once and returns only an opaque session and an allowed destination',async()=>{
 const f=fixture(),start=await f.begin();assert.deepEqual(await f.flow.complete(start.params,start.browserBinding),{sessionToken:'s'.repeat(43),returnTo:'/admin/pilots/hammy'});assert.deepEqual(f.counts(),{exchanges:1,completed:1});await assert.rejects(f.flow.complete(start.params,start.browserBinding),OwnerLoginError);assert.deepEqual(f.counts(),{exchanges:1,completed:1});
});
test('another browser or an unknown state cannot consume the valid login',async()=>{
 const f=fixture(),start=await f.begin();await assert.rejects(f.flow.complete(start.params,'x'.repeat(43)),OwnerLoginError);await assert.rejects(f.flow.complete(new URLSearchParams({state:'x'.repeat(43),code:'code'}),start.browserBinding),OwnerLoginError);assert.equal(f.attempts.size,1);assert.deepEqual(f.counts(),{exchanges:0,completed:0});await f.flow.complete(start.params,start.browserBinding);
});
test('expired attempts, duplicate parameters and missing browser cookies do not exchange codes',async()=>{
 for(const mode of ['expired','duplicate-state','duplicate-code','missing-cookie','code-and-error']){const f=fixture(),start=await f.begin();if(mode==='expired')f.expire();if(mode==='duplicate-state')start.params.append('state','x'.repeat(43));if(mode==='duplicate-code')start.params.append('code','another-code');if(mode==='code-and-error')start.params.append('error','access_denied');await assert.rejects(f.flow.complete(start.params,mode==='missing-cookie'?undefined:start.browserBinding),OwnerLoginError);assert.deepEqual(f.counts(),{exchanges:0,completed:0});}
});
test('provider cancellation consumes the attempt and exposes no provider diagnostics',async()=>{
 const f=fixture(),start=await f.begin();start.params.delete('code');start.params.set('error','access_denied');start.params.set('error_description','sensitive provider details');await assert.rejects(f.flow.complete(start.params,start.browserBinding),e=>e instanceof OwnerLoginError&&!e.message.includes('sensitive'));assert.equal(f.attempts.size,0);assert.deepEqual(f.counts(),{exchanges:0,completed:0});
});
test('lost exchange or verification failure never retries the same callback',async()=>{
 for(const mode of ['network','verification']){let requests=0;const f=fixture(mode==='network'?{fetcher:(async()=>{requests++;throw new Error('network failed');}) as typeof fetch}:{finishFails:true});const start=await f.begin();await assert.rejects(f.flow.complete(start.params,start.browserBinding),OwnerLoginError);await assert.rejects(f.flow.complete(start.params,start.browserBinding),OwnerLoginError);assert.equal(mode==='network'?requests:f.counts().completed,1);}
});
test('bad token responses are never used to create sessions',async()=>{
 for(const body of [{access_token:'access'}, {access_token:'access',id_token:'identity',token_type:'Bearer',expires_in:0}, {access_token:'access',id_token:'identity',token_type:'Bearer',expires_in:3601}]){
  const f=fixture({fetcher:(async()=>Response.json(body)) as typeof fetch}),start=await f.begin();await assert.rejects(f.flow.complete(start.params,start.browserBinding),OwnerLoginError);assert.equal(f.counts().completed,0);
 }
});
test('untrusted redirects and provider URLs cannot enter the flow',async()=>{
 const f=fixture();for(const path of ['https://attacker.example','//attacker.example','/admin','/admin/pilots/hammy?returnTo=https://attacker.example','/admin/pilots/hammy/../payments'])await assert.rejects(f.flow.begin(path),OwnerLoginError);
 for(const override of [{appOrigin:'http://preview.zayvi.store'},{appOrigin:'https://preview.zayvi.store/path'},{domainPrefix:'attacker.example'},{scopes:['profile']}])assert.throws(()=>createOwnerLogin({...config,...override},{attempts:{create:async()=>{},consume:async()=>null},finishVerifiedSignIn:async()=>({sessionToken:'x'.repeat(43)})}));
});
