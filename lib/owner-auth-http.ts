import {createOwnerLoginContext,type OwnerLoginContext} from './owner-login-context';
import {MERCHANT_REGISTRATION_CALLBACK,type createMerchantRegistrationFlow,type createOwnerLogin} from './owner-login';
import type {StoredOwnerSession} from './owner-sessions';
export const OWNER_BINDING_COOKIE='__Host-zayvi_owner_binding';
export const MERCHANT_REGISTRATION_COOKIE='__Host-zayvi_merchant_registration';
export const MERCHANT_REGISTRATION_START='/api/owner/registration/start';
export const OWNER_SESSION_COOKIE='__Host-zayvi_owner_session';
type Action='start'|'callback'|'status'|'logout';
export type OwnerAuthHttpDependencies={
  flow:ReturnType<typeof createOwnerLogin>;
  sessions:{load(token:string|undefined):Promise<StoredOwnerSession|null>;revoke(token:string|undefined):Promise<void>};
  /** Must run createOwnerSessionAccess with store.read, including live assurance. */
  authorise(token:string):Promise<void>;
  /** Durable, trusted-server rate limiting. No permissive/in-memory default. */
  limit(action:Action,request:Request):Promise<boolean>;
};
const opaque=(value:unknown):value is string=>typeof value==='string'&&/^[A-Za-z0-9_-]{43}$/.test(value);
function cookie(request:Request,name:string){
  const values=(request.headers.get('cookie')??'').split(';').map(value=>value.trim()).filter(value=>value.startsWith(`${name}=`));
  const value=values.length===1?values[0].slice(name.length+1):undefined;return opaque(value)?value:undefined;
}
const setCookie=(name:string,value:string,maxAge:number)=>`${name}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
const headers=()=>new Headers({'Cache-Control':'no-store','Pragma':'no-cache','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'});
/** Prepared Web handlers; no routes are mounted by this module. Disabled by default. */
type OwnerHttpConfig={origin:string;enabled?:boolean;context:OwnerLoginContext};
type RegistrationHttpDependencies=Omit<OwnerAuthHttpDependencies,'flow'> & {
  flow:ReturnType<typeof createMerchantRegistrationFlow>;
};

export function createOwnerAuthHandlers(config:OwnerHttpConfig,dependencies?:OwnerAuthHttpDependencies){
  return createHostedOwnerHandlers(config,dependencies,dependencies&&(()=>dependencies.flow.begin()),false);
}

export function createMerchantRegistrationHandlers(config:OwnerHttpConfig,dependencies?:RegistrationHttpDependencies){
  const handlers=createHostedOwnerHandlers(config,dependencies,dependencies&&(async request=>{
    const storeName=await readRegistrationStoreName(request);
    return storeName===null?null:dependencies.flow.begin(storeName);
  }),true);
  return {start:handlers.start,callback:handlers.callback};
}

async function readRegistrationStoreName(request:Request){
  if(request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/x-www-form-urlencoded'||!request.body)return null;
  const reader=request.body.getReader(),decoder=new TextDecoder();
  let size=0,body='';
  try{
    for(;;){
      const {done,value}=await reader.read();
      if(done)break;
      size+=value.byteLength;
      if(size>1024){void reader.cancel().catch(()=>{});return null;}
      body+=decoder.decode(value,{stream:true});
    }
    const form=new URLSearchParams(body+decoder.decode());
    const names=form.getAll('storeName'),name=names[0]?.trim();
    return names.length===1&&form.size===1&&name&&name.length<=80&&!/\p{Cc}/u.test(name)?name:null;
  }finally{reader.releaseLock();}
}

function createHostedOwnerHandlers(
  config:OwnerHttpConfig,
  dependencies:OwnerAuthHttpDependencies|RegistrationHttpDependencies|undefined,
  begin:((request:Request)=>Promise<Awaited<ReturnType<OwnerAuthHttpDependencies['flow']['begin']>>|null>)|undefined,
  registration:boolean,
){
  const origin=new URL(config.origin),context=createOwnerLoginContext(config.context);
  if(origin.protocol!=='https:'||origin.origin!==config.origin)throw new Error('A pinned HTTPS owner origin is required.');
  if(config.enabled&&(!dependencies||typeof dependencies.limit!=='function'||typeof dependencies.authorise!=='function'))throw new Error('Complete owner HTTP dependencies are required.');
  const bindingCookie=registration?MERCHANT_REGISTRATION_COOKIE:OWNER_BINDING_COOKIE;
  const json=(body:unknown,status:number)=>Response.json(body,{status,headers:headers()});
  async function gate(action:Action,request:Request,method:string){
    if(!config.enabled||!dependencies)return json({error:'Owner sign-in is not available yet.'},503);
    if(request.method!==method)return json({error:'Method not allowed.'},405);
    const url=new URL(request.url);
    if(url.origin!==origin.origin||(method==='POST'&&request.headers.get('origin')!==origin.origin)||
      (registration&&url.pathname!==(action==='start'?MERCHANT_REGISTRATION_START:MERCHANT_REGISTRATION_CALLBACK)))return json({error:'Request not allowed.'},403);
    try{if(!await dependencies.limit(action,request))return json({error:'Please try again shortly.'},429);}catch{return json({error:'Sign-in is temporarily unavailable.'},503);}
    return null;
  }
  return {
    async start(request:Request){
      const blocked=await gate('start',request,'POST');if(blocked)return blocked;
      try{
        const result=await begin!(request);
        if(!result)return json({error:'Enter a store name of up to 80 characters.'},400);
        const destination=new URL(result.authorizationUrl);
        if(destination.protocol!=='https:'||!destination.hostname.endsWith('.auth.eu-west-2.amazoncognito.com')||!opaque(result.browserBinding)||(registration&&destination.pathname!=='/signup'))throw new Error();
        const h=headers();h.set('Location',destination.toString());h.append('Set-Cookie',setCookie(bindingCookie,result.browserBinding,600));return new Response(null,{status:303,headers:h});
      }catch{return json({error:'Sign-in could not start. Please try again.'},503);}
    },
    async callback(request:Request){
      const blocked=await gate('callback',request,'GET');if(blocked)return blocked;
      const h=headers();h.append('Set-Cookie',setCookie(bindingCookie,'',0));
      try{
        const result=await dependencies!.flow.complete(new URL(request.url).searchParams,cookie(request,bindingCookie));
        if(!opaque(result.sessionToken)||!context.allows(result.returnTo))throw new Error();
        const session=await dependencies!.sessions.load(result.sessionToken),ttl=session?Math.min(3600,session.expiresAt-Math.floor(Date.now()/1000)):0;
        if(ttl<=0||!Number.isInteger(ttl))throw new Error();
        h.append('Set-Cookie',setCookie(OWNER_SESSION_COOKIE,result.sessionToken,ttl));h.set('Location',new URL(result.returnTo,origin).toString());
      }catch{h.set('Location',new URL(registration?'/platform/app?error=registration_failed':'/owner/sign-in?error=sign_in_failed',origin).toString());}
      return new Response(null,{status:303,headers:h});
    },
    async status(request:Request){
      const blocked=await gate('status',request,'GET');if(blocked)return blocked;
      const value=cookie(request,OWNER_SESSION_COOKIE);if(!value)return json({authenticated:false},401);
      try{await dependencies!.authorise(value);return json({authenticated:true},200);}catch{return json({authenticated:false},401);}
    },
    async logout(request:Request){
      const blocked=await gate('logout',request,'POST');if(blocked)return blocked;
      try{await dependencies!.sessions.revoke(cookie(request,OWNER_SESSION_COOKIE));const h=headers();h.append('Set-Cookie',setCookie(OWNER_SESSION_COOKIE,'',0));h.append('Set-Cookie',setCookie(OWNER_BINDING_COOKIE,'',0));return new Response(null,{status:204,headers:h});}
      catch{return json({error:'Sign-out could not complete. Please try again.'},503);}
    },
  };
}
