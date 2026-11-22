import type {createOwnerLogin} from './owner-login';
import type {StoredOwnerSession} from './owner-sessions';
export const OWNER_BINDING_COOKIE='__Host-zayvi_owner_binding';
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
export function createOwnerAuthHandlers(config:{origin:string;enabled?:boolean},dependencies?:OwnerAuthHttpDependencies){
  const origin=new URL(config.origin);
  if(origin.protocol!=='https:'||origin.origin!==config.origin)throw new Error('A pinned HTTPS owner origin is required.');
  if(config.enabled&&(!dependencies||typeof dependencies.limit!=='function'||typeof dependencies.authorise!=='function'))throw new Error('Complete owner HTTP dependencies are required.');
  const json=(body:unknown,status:number)=>Response.json(body,{status,headers:headers()});
  async function gate(action:Action,request:Request,method:string){
    if(!config.enabled||!dependencies)return json({error:'Owner sign-in is not available yet.'},503);
    if(request.method!==method)return json({error:'Method not allowed.'},405);
    if(new URL(request.url).origin!==origin.origin||(method==='POST'&&request.headers.get('origin')!==origin.origin))return json({error:'Request not allowed.'},403);
    try{if(!await dependencies.limit(action,request))return json({error:'Please try again shortly.'},429);}catch{return json({error:'Sign-in is temporarily unavailable.'},503);}
    return null;
  }
  return {
    async start(request:Request){
      const blocked=await gate('start',request,'POST');if(blocked)return blocked;
      try{
        const result=await dependencies!.flow.begin();const destination=new URL(result.authorizationUrl);
        if(destination.protocol!=='https:'||!destination.hostname.endsWith('.auth.eu-west-2.amazoncognito.com')||!opaque(result.browserBinding))throw new Error();
        const h=headers();h.set('Location',destination.toString());h.append('Set-Cookie',setCookie(OWNER_BINDING_COOKIE,result.browserBinding,600));return new Response(null,{status:303,headers:h});
      }catch{return json({error:'Sign-in could not start. Please try again.'},503);}
    },
    async callback(request:Request){
      const blocked=await gate('callback',request,'GET');if(blocked)return blocked;
      const h=headers();h.append('Set-Cookie',setCookie(OWNER_BINDING_COOKIE,'',0));
      try{
        const result=await dependencies!.flow.complete(new URL(request.url).searchParams,cookie(request,OWNER_BINDING_COOKIE));
        if(!opaque(result.sessionToken)||!['/admin/pilots/hammy','/admin/pilots/hammy/integrations'].includes(result.returnTo))throw new Error();
        const session=await dependencies!.sessions.load(result.sessionToken),ttl=session?Math.min(3600,session.expiresAt-Math.floor(Date.now()/1000)):0;
        if(ttl<=0||!Number.isInteger(ttl))throw new Error();
        h.append('Set-Cookie',setCookie(OWNER_SESSION_COOKIE,result.sessionToken,ttl));h.set('Location',new URL(result.returnTo,origin).toString());
      }catch{h.set('Location',new URL('/owner/sign-in?error=sign_in_failed',origin).toString());}
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
