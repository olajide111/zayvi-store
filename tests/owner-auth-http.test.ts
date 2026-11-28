import {HAMMY_OWNER_LOGIN_CONTEXT} from '../lib/hammy-owner-login-context';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createMerchantRegistrationHandlers,createOwnerAuthHandlers,MERCHANT_REGISTRATION_COOKIE,MERCHANT_REGISTRATION_START,OWNER_BINDING_COOKIE,OWNER_SESSION_COOKIE,type OwnerAuthHttpDependencies} from '../lib/owner-auth-http';
import {createMerchantRegistrationFlow,createOwnerLogin,MERCHANT_REGISTRATION_CALLBACK} from '../lib/owner-login';
import {createEncryptedOwnerLoginAttempts} from '../lib/owner-login-attempts';
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

test("merchant signup retains store name only in the encrypted, one-use attempt and issues a scoped session", async () => {
  const rows = new Map<string, string>();
  const attempts = createEncryptedOwnerLoginAttempts({
    async create(state, browser, payload) { rows.set(state + browser, payload); },
    async consume(state, browser) {
      const key = state + browser, payload = rows.get(key) ?? null;
      rows.delete(key);
      return payload;
    },
  }, new Uint8Array(32).fill(7));
  const context = { key: "merchant-registration", defaultPath: "/platform/app/onboarding", allowedPaths: ["/platform/app/onboarding"] };
  const config = { context, appOrigin: origin, domainPrefix: "zayvi-preview", clientId: "test123", scopes: ["openid", "email", "zayvi/store.access"] };
  const names: string[] = [];
  let exchanges = 0;
  const fetcher = (async (_url, init) => {
    exchanges++;
    assert.equal((init?.body as URLSearchParams).get("redirect_uri"), origin + MERCHANT_REGISTRATION_CALLBACK);
    return Response.json({ access_token: "access", id_token: "identity", token_type: "Bearer", expires_in: 600 });
  }) as typeof fetch;
  const flow = createMerchantRegistrationFlow(config, {
    attempts, fetcher,
    async finishVerifiedRegistration(tokens, nonce, name) {
      assert.equal(tokens.idToken, "identity");
      assert.match(nonce, /^[A-Za-z0-9_-]{43}$/);
      names.push(name);
      return { sessionToken: session };
    },
  });
  const disabled = createMerchantRegistrationHandlers({ origin, context });
  const startRequest = (body: string, requestOrigin = origin) => new Request(origin + MERCHANT_REGISTRATION_START, {
    method: "POST",
    headers: { origin: requestOrigin, "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  assert.equal((await disabled.start(startRequest("storeName=My+Shop"))).status, 503);
  const handlers = createMerchantRegistrationHandlers({ origin, context, enabled: true }, {
    flow,
    sessions: {
      async load(token) {
        assert.equal(token, session);
        return { tenantId: "new-tenant", storeId: "new-store", membershipId: "new-member", issuer: "issuer", subject: "new-owner",
          role: "owner", authenticationTime: 1, providerSessionId: "provider", providerTokenId: "token", expiresAt: Math.floor(Date.now()/1000)+300 };
      },
      async revoke() {},
    },
    async authorise() {},
    async limit() { return true; },
  });
  assert.equal((await handlers.start(startRequest("storeName=My+Shop", "https://other.example"))).status, 403);
  for (const invalid of ["storeName=", "storeName=one&storeName=two", "storeName=one&returnTo=%2Fadmin", "storeName=" + "x".repeat(1100)]) {
    assert.equal((await handlers.start(startRequest(invalid))).status, 400);
  }
  assert.equal(rows.size, 0);

  const started = await handlers.start(startRequest("storeName=+My+Shop+"));
  assert.equal(started.status, 303);
  const signup = new URL(started.headers.get("location")!);
  assert.equal(signup.pathname, "/signup");
  assert.equal(signup.searchParams.get("redirect_uri"), origin + MERCHANT_REGISTRATION_CALLBACK);
  assert.equal(signup.searchParams.get("code_challenge_method"), "S256");
  assert(!signup.toString().includes("Shop"));
  assert.equal(rows.size, 1);
  assert(![...rows.values()][0].includes("My Shop"));
  const registrationCookie = started.headers.get("set-cookie")!.split(";")[0];
  assert.match(registrationCookie, new RegExp("^" + MERCHANT_REGISTRATION_COOKIE + "="));
  const callbackUrl = new URL(origin + MERCHANT_REGISTRATION_CALLBACK);
  callbackUrl.search = new URLSearchParams({ code: "one-use-code", state: signup.searchParams.get("state")!, storeName: "Wrong Shop" }).toString();

  const wrongBrowser = await handlers.callback(new Request(callbackUrl, { headers: { cookie: registrationCookie.replace(MERCHANT_REGISTRATION_COOKIE, OWNER_BINDING_COOKIE) } }));
  assert.equal(exchanges, 0);
  assert(!wrongBrowser.headers.get("set-cookie")!.includes(OWNER_SESSION_COOKIE));
  assert.equal(rows.size, 1);

  const callback = () => new Request(callbackUrl, { headers: { cookie: registrationCookie } });
  const success = await handlers.callback(callback());
  assert.equal(success.headers.get("location"), origin + context.defaultPath);
  assert.match(success.headers.get("set-cookie")!, new RegExp(OWNER_SESSION_COOKIE + "=" + session));
  assert.deepEqual(names, ["My Shop"]);

  const replay = await handlers.callback(callback());
  assert.equal(replay.headers.get("location"), origin + "/platform/app?error=registration_failed");
  assert(!replay.headers.get("set-cookie")!.includes(OWNER_SESSION_COOKIE));
  assert.equal(exchanges, 1);

  // Even with matching context, a regular sign-in cannot complete a signup attempt.
  const direct = await flow.begin("Another Shop");
  const owner = createOwnerLogin(config, { attempts, fetcher, async finishVerifiedSignIn() { throw new Error("Unexpected sign-in"); } });
  await assert.rejects(owner.complete(new URLSearchParams({ code: "code", state: new URL(direct.authorizationUrl).searchParams.get("state")! }), direct.browserBinding));
  assert.equal(exchanges, 1);
});
