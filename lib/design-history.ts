export type DesignVersion={id:string;version:number;createdAt:string;themeId:string;draft:Record<string,unknown>};
export type DesignHistory={baseVersion:number;versions:DesignVersion[]};

export function parseDesignHistory(input:unknown):DesignHistory{
 const value=input as Partial<DesignHistory>|null;
 if(!value||!Number.isSafeInteger(value.baseVersion)||Number(value.baseVersion)<0||!Array.isArray(value.versions))throw new Error('Invalid design history response. Refresh before saving.');
 for(const version of value.versions){
  if(!version||typeof version.id!=='string'||!version.id||!Number.isSafeInteger(version.version)||version.version<1||version.version>Number(value.baseVersion)||typeof version.themeId!=='string'||!version.themeId||typeof version.createdAt!=='string'||!Number.isFinite(Date.parse(version.createdAt))||!version.draft||typeof version.draft!=='object'||Array.isArray(version.draft))throw new Error('Invalid design version response. Refresh before saving.');
 }
 return {baseVersion:Number(value.baseVersion),versions:value.versions};
}

/** Never retries writes: a lost response does not prove that a save failed. */
export async function requestDesignHistory({body,signal,timeoutMs=15000,fetcher=fetch}:{body?:unknown;signal?:AbortSignal;timeoutMs?:number;fetcher?:typeof fetch}={}):Promise<DesignHistory>{
 const controller=new AbortController();
 const cancel=()=>controller.abort();
 signal?.addEventListener('abort',cancel,{once:true});
 if(signal?.aborted)controller.abort();
 let timedOut=false;
 const timer=setTimeout(()=>{timedOut=true;controller.abort();},timeoutMs);
 try{
  const response=await fetcher('/api/admin/theme-drafts',{cache:'no-store',signal:controller.signal,...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
  const data=await response.json();
  if(!response.ok)throw new Error(typeof data?.error==='string'?data.error:'Design history is unavailable.');
  return parseDesignHistory(data);
 }catch(error){
  if(timedOut)throw new Error(body?'Save response timed out. The version may have been saved. Refresh versions before trying again.':'Design history took too long to load. Refresh versions to retry.');
  if(body&&!(error instanceof Error&&error.message.includes('Refresh')))throw new Error(`${error instanceof Error?error.message:'Save response unavailable.'} Refresh versions before trying again; a lost response may follow a completed save.`);
  throw error;
 }finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);}
}
