import {validateThemeDraft} from './theme-draft';
import type {DesignVersion} from './design-history';
export type PreviewRelease={enabled:boolean;current:string|null;events:Array<{id:string;theme_version_id:string;action:'publish'|'rollback';reason:string;created_at:string}>};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function parsePreviewRelease(input:unknown):PreviewRelease{
 const value=input as PreviewRelease|null;
 if(!value||typeof value.enabled!=='boolean'||(value.current!==null&&(typeof value.current!=='string'||!uuid.test(value.current)))||!Array.isArray(value.events))throw new Error('Invalid release response. Refresh release data before continuing.');
 for(const event of value.events){if(!event||typeof event.id!=='string'||!uuid.test(event.id)||typeof event.theme_version_id!=='string'||!uuid.test(event.theme_version_id)||!['publish','rollback'].includes(event.action)||typeof event.reason!=='string'||typeof event.created_at!=='string'||!Number.isFinite(Date.parse(event.created_at)))throw new Error('Invalid release history. Refresh release data before continuing.');}
 return {enabled:value.enabled,current:value.current,events:value.events};
}
export function releaseActionBlocked(release:PreviewRelease|null,version:DesignVersion|undefined,reason:string,action:'publish'|'rollback'){
 if(!release)return 'Refresh release data before continuing.';
 if(!release.enabled)return 'Preview releases are disabled.';
 if(!version||!uuid.test(version.id))return 'Choose a saved design version.';
 try{validateThemeDraft({themeId:version.themeId,draft:version.draft,baseVersion:0});}catch{return 'This design is incompatible. Save a new version in the studio.';}
 if(!reason.trim()||reason.length>500)return 'Enter a release note of up to 500 characters.';
 if(release.current===version.id)return 'This version is already the current Preview release.';
 if(action==='rollback'&&!release.events.some(event=>event.theme_version_id===version.id))return 'Rollback needs a version found in the loaded release history.';
 return '';
}
/** A timed-out write must be reconciled by a read, not automatically retried. */
export async function requestPreviewRelease({body,signal,timeoutMs=15000,fetcher=fetch}:{body?:unknown;signal?:AbortSignal;timeoutMs?:number;fetcher?:typeof fetch}={}):Promise<PreviewRelease>{
 const controller=new AbortController(),cancel=()=>controller.abort();
 signal?.addEventListener('abort',cancel,{once:true});if(signal?.aborted)controller.abort();
 let timedOut=false;const timer=setTimeout(()=>{timedOut=true;controller.abort();},timeoutMs);
 try{
  const response=await fetcher('/api/admin/theme-release',{cache:'no-store',signal:controller.signal,...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
  const data=await response.json();if(!response.ok)throw new Error(typeof data?.error==='string'?data.error:'Release service unavailable.');
  return parsePreviewRelease(data);
 }catch(error){
  if(timedOut)throw new Error(body?'Release response timed out. It may have completed. Refresh release data before trying again.':'Release data took too long to load. Refresh to retry.');
  throw new Error(`${error instanceof Error?error.message:'Release service unavailable.'}${body?' Refresh release data before trying again; the outcome may be unconfirmed.':''}`);
 }finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);}
}
