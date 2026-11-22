import {HAMMY_OWNER_LOGIN_CONTEXT} from '../lib/hammy-owner-login-context';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createOwnerAuthHandlers,OWNER_BINDING_COOKIE,OWNER_SESSION_COOKIE,type OwnerAuthHttpDependencies} from '../lib/owner-auth-http';
const origin='https://preview.zayvi.store',binding='b'.repeat(43),session='s'.repeat(43);
function fixture(){
 const calls:string[]=[];let revoked=false,denied=false,limited=false;
 const deps:OwnerAuthHttpDependencies={flow:{async begin(){calls.push('begin');return {authorizationUrl:'https://zayvi-preview.auth.eu-west-2.amazoncognito.com/oauth2/authorize?state=public-state',browserBinding:binding,maxAge:600};},async complete(_params,cookie){calls.push('complete');if(cookie!==binding)throw new Error('private detail');return {sessionToken:session,returnTo:'/admin/pilots/hammy'};}},
 sessions:{async load(token){calls.push('load');assert.equal(token,session);return {tenantId:'tenant',storeId:'store',membershipId:'member',issuer:'issuer',subject:'subject',role:'owner',authenticationTime:1,providerSessionId:'provider',providerTokenId:'token',expiresAt:Math.floor(Date.now()/1000)+300};},async revoke(value){calls.push('revoke');if(value)assert.equal(value,session);revoked=true;}},
 async authorise(value){calls.push('authorise');assert.equal(value,session);if(denied||revoked)throw new Error('private detail');},async limit(){calls.push('limit');return !limited;}};
 return {handlers:createOwnerAuthHandlers({origin,enabled:true,context:HAMMY_OWNER_LOGIN_CONTEXT},deps),calls,deny(){denied=true;},limit(){limited=true;}};
}
const post=(path:string,requestOrigin=origin)=>new Request(`${origin}${path}`,{method:'POST',headers:{origin:requestOrigin,cookie:`${OWNER_SESSION_COOKIE}=${session}`}});
test('owner HTTP is disabled unless explicitly configured',async()=>{
 const handlers=createOwnerAuthHandlers({origin,context:HAMMY_OWNER_LOGIN_CONTEXT});const response=await handlers.start(post('/api/owner/auth/start'));assert.equal(response.status,503);assert.equal(response.headers.get('cache-control'),'no-store');assert(!response.headers.has('set-cookie'));
});
test('start uses a secure host-only binding cookie and never puts the binding in JSON',async()=>{
 const f=fixture(),response=await f.handlers.start(post('/api/owner/auth/start'));assert.equal(response.status,303);assert.match(response.headers.get('set-cookie')!,/HttpOnly; Secure; SameSite=Lax/);assert.match(response.headers.get('set-cookie')!,/Path=\/; Max-Age=600/);assert(!response.headers.get('set-cookie')!.includes('Domain='));assert(!response.headers.get('location')!.includes(binding));assert.equal(await response.text(),'');
});
test('cross-origin POSTs and rate-limited requests have no authentication side effects',async()=>{
 const f=fixture();assert.equal((await f.handlers.start(post('/api/owner/auth/start','https://attacker.example'))).status,403);assert(!f.calls.includes('begin'));f.limit();assert.equal((await f.handlers.start(post('/api/owner/auth/start'))).status,429);assert(!f.calls.includes('begin'));
});
test('callback clears the binding and returns an opaque secure cookie after server completion',async()=>{
 const f=fixture(),request=new Request(`${origin}/api/owner/auth/callback?code=code&state=state`,{headers:{cookie:`${OWNER_BINDING_COOKIE}=${binding}`}}),response=await f.handlers.callback(request);
 assert.equal(response.status,303);assert.equal(response.headers.get('location'),`${origin}/admin/pilots/hammy`);const cookies=response.headers.get('set-cookie')!;assert(cookies.includes(`${OWNER_BINDING_COOKIE}=;`));assert(cookies.includes(`${OWNER_SESSION_COOKIE}=${session};`));assert.equal(response.headers.get('referrer-policy'),'no-referrer');assert.deepEqual(f.calls,['limit','complete','load']);
});
test('callback failures and duplicate binding cookies cannot set an owner session',async()=>{
 const f=fixture(),request=new Request(`${origin}/api/owner/auth/callback?error=private`,{headers:{cookie:`${OWNER_BINDING_COOKIE}=${binding};${OWNER_BINDING_COOKIE}=${binding}`}}),response=await f.handlers.callback(request);assert.equal(response.headers.get('location'),`${origin}/owner/sign-in?error=sign_in_failed`);assert(!response.headers.get('set-cookie')!.includes(OWNER_SESSION_COOKIE));assert(!(await response.text()).includes('private'));
});
test('status requires current server authorisation and exposes no owner details',async()=>{
 const f=fixture(),request=()=>new Request(`${origin}/api/owner/auth/status`,{headers:{cookie:`${OWNER_SESSION_COOKIE}=${session}`}});const ok=await f.handlers.status(request());assert.deepEqual(await ok.json(),{authenticated:true});f.deny();assert.equal((await f.handlers.status(request())).status,401);assert(f.calls.includes('authorise'));
});
test('logout requires same-origin POST, revokes first and clears both cookies',async()=>{
 const f=fixture();assert.equal((await f.handlers.logout(new Request(`${origin}/api/owner/auth/logout`))).status,405);assert(!f.calls.includes('revoke'));const response=await f.handlers.logout(post('/api/owner/auth/logout'));assert.equal(response.status,204);assert(f.calls.includes('revoke'));assert(response.headers.get('set-cookie')!.includes(`${OWNER_SESSION_COOKIE}=;`));assert(response.headers.get('set-cookie')!.includes(`${OWNER_BINDING_COOKIE}=;`));
});
