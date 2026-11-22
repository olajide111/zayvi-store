import test from 'node:test';
import assert from 'node:assert/strict';
import {createOwnerLoginContext,type OwnerLoginContext} from '../lib/owner-login-context';
import {HAMMY_OWNER_LOGIN_CONTEXT} from '../lib/hammy-owner-login-context';
import {createOwnerLogin,OwnerLoginError,type OwnerLoginAttempt} from '../lib/owner-login';
import {createOwnerAuthHandlers,OWNER_BINDING_COOKIE,OWNER_SESSION_COOKIE} from '../lib/owner-auth-http';
const generic={key:'another-store',defaultPath:'/owner/stores/another',allowedPaths:['/owner/stores/another']};
const config={domainPrefix:'zayvi-preview',clientId:'testclient',appOrigin:'https://preview.zayvi.store',scopes:['openid','zayvi/store.access']};
function attempts(){const rows=new Map<string,OwnerLoginAttempt>();return {rows,async create(row:OwnerLoginAttempt){rows.set(row.stateHash,{...row});},async consume(state:string,browser:string,now:number){const row=rows.get(state);if(!row||row.browserHash!==browser||row.expiresAt<=now)return null;rows.delete(state);return row;}};}
test('login contexts reject missing keys and untrusted or ambiguous paths',()=>{
 for(const path of ['https://attacker.test','//attacker.test','/owner/../admin','/owner/%2e%2e/admin','/owner?redirect=other','/owner#other','/owner\\admin'])assert.throws(()=>createOwnerLoginContext({...generic,defaultPath:path,allowedPaths:[path]}));
 for(const bad of [{...generic,key:undefined},{...generic,key:12},{...generic,allowedPaths:[]},{...generic,defaultPath:'/missing'}])assert.throws(()=>createOwnerLoginContext(bad as OwnerLoginContext));
});
test('trusted context settings are copied and cannot be broadened by later mutation',()=>{
 const paths=['/owner/one'],input={key:'store-one',defaultPath:'/owner/one',allowedPaths:paths};const result=createOwnerLoginContext(input);input.key='other';input.defaultPath='/owner/two';paths.push('/owner/two');assert.equal(result.key,'store-one');assert.equal(result.defaultPath,'/owner/one');assert.equal(result.allows('/owner/two'),false);
});
test('the shared login flow supports another store without falling back to Hammy',async()=>{
 const repo=attempts();const flow=createOwnerLogin({...config,context:generic},{attempts:repo,finishVerifiedSignIn:async()=>({sessionToken:'s'.repeat(43)})});await flow.begin();const row=[...repo.rows.values()][0];assert.equal(row.contextKey,generic.key);assert.equal(row.returnTo,generic.defaultPath);await assert.rejects(flow.begin('/admin/pilots/hammy'),OwnerLoginError);
});
test('a callback cannot switch login contexts even when they share a destination',async()=>{
 const repo=attempts();let called=false;const deps={attempts:repo,fetcher:(async()=>{called=true;throw new Error('must not exchange');}) as typeof fetch,finishVerifiedSignIn:async()=>({sessionToken:'s'.repeat(43)})};
 const one=createOwnerLogin({...config,context:{...generic,key:'one'}},deps),two=createOwnerLogin({...config,context:{...generic,key:'two'}},deps),start=await one.begin();const state=new URL(start.authorizationUrl).searchParams.get('state')!;
 await assert.rejects(two.complete(new URLSearchParams({state,code:'code'}),start.browserBinding),OwnerLoginError);assert.equal(called,false);
});
test('legacy attempts without an explicit context cannot complete sign-in',async()=>{
 const repo=attempts();let called=false;const flow=createOwnerLogin({...config,context:generic},{attempts:repo,fetcher:(async()=>{called=true;throw new Error();}) as typeof fetch,finishVerifiedSignIn:async()=>({sessionToken:'s'.repeat(43)})});const start=await flow.begin(),row=[...repo.rows.values()][0];delete (row as Partial<OwnerLoginAttempt>).contextKey;
 await assert.rejects(flow.complete(new URLSearchParams({state:new URL(start.authorizationUrl).searchParams.get('state')!,code:'code'}),start.browserBinding),OwnerLoginError);assert.equal(called,false);
});
test('the HTTP layer independently refuses another context destination before setting an owner cookie',async()=>{
 let loaded=false;const handlers=createOwnerAuthHandlers({origin:config.appOrigin,enabled:true,context:HAMMY_OWNER_LOGIN_CONTEXT},{
  flow:{begin:async()=>({authorizationUrl:'https://zayvi-preview.auth.eu-west-2.amazoncognito.com',browserBinding:'b'.repeat(43),maxAge:600}),complete:async()=>({sessionToken:'s'.repeat(43),returnTo:generic.defaultPath})},
  sessions:{load:async()=>{loaded=true;return null;},revoke:async()=>{}},authorise:async()=>{},limit:async()=>true,
 });
 const result=await handlers.callback(new Request(`${config.appOrigin}/api/owner/auth/callback?state=state&code=code`,{headers:{cookie:`${OWNER_BINDING_COOKIE}=${'b'.repeat(43)}`}}));assert.equal(loaded,false);assert(!result.headers.get('set-cookie')!.includes(OWNER_SESSION_COOKIE));assert.match(result.headers.get('location')!,/sign_in_failed/);
});
