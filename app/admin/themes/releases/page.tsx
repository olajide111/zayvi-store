'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {ALL_STUDIO_THEMES} from '@/lib/theme-registry';
import {validateThemeDraft} from '@/lib/theme-draft';
import {requestDesignHistory,type DesignVersion} from '@/lib/design-history';
import {requestPreviewRelease,releaseActionBlocked,type PreviewRelease} from '@/lib/theme-release-review';
export default function ThemeReleases(){
 const [release,setRelease]=useState<PreviewRelease|null>(null),[versions,setVersions]=useState<DesignVersion[]>([]),[selected,setSelected]=useState(''),[reason,setReason]=useState(''),[notice,setNotice]=useState('Loading Preview release…'),[busy,setBusy]=useState(true),[review,setReview]=useState<'publish'|'rollback'|null>(null);
 async function refresh(signal?:AbortSignal){
  setBusy(true);setReview(null);setNotice('Loading Preview release and saved designs…');
  try{
   const [current,history]=await Promise.all([requestPreviewRelease({signal}),requestDesignHistory({signal})]);if(signal?.aborted)return;
   setRelease(current);setVersions(history.versions);setSelected(id=>history.versions.some(version=>version.id===id)?id:'');
   setNotice(current.enabled?'Choose a saved design, inspect its catalogue preview and review the release action.':'Preview releases are disabled. You can inspect saved designs; no release action is available.');
  }catch(error){if(!signal?.aborted){setRelease(null);setVersions([]);setSelected('');setNotice(error instanceof Error?error.message:'Release data unavailable. Refresh to retry.');}}
  finally{if(!signal?.aborted)setBusy(false);}
 }
 useEffect(()=>{const controller=new AbortController();void refresh(controller.signal);return()=>controller.abort();},[]);
 const version=versions.find(item=>item.id===selected),currentVersion=versions.find(item=>item.id===release?.current);
 const themeName=(id:string)=>ALL_STUDIO_THEMES.find(theme=>theme.id===id)?.name||id;
 const publishBlocked=releaseActionBlocked(release,version,reason,'publish'),rollbackBlocked=releaseActionBlocked(release,version,reason,'rollback');
 let preview='';if(version){try{const {theme,config}=validateThemeDraft({themeId:version.themeId,draft:version.draft,baseVersion:0});preview=`/admin/themes/${theme.id}/preview?${new URLSearchParams({source:'store',brand:config.draft.brand,headline:config.draft.headline,font:config.draft.font,palette:config.draft.palette,motion:config.draft.motion,canvas:config.draft.colours.canvas,ink:config.draft.colours.ink,accent:config.draft.colours.accent})}`;}catch{}}
 async function change(action:'publish'|'rollback'){
  if(busy||releaseActionBlocked(release,version,reason,action)||!release||!version)return;
  setBusy(true);setReview(null);
  try{
   const data=await requestPreviewRelease({body:{action,versionId:version.id,expectedReleaseId:release.current,reason}});
   setRelease(data);setNotice('Preview release recorded. Review the released storefront; the customer homepage requires separate Preview enablement.');setReason('');
  }catch(error){setRelease(null);setNotice(error instanceof Error?error.message:'Could not confirm the release. Refresh release data before trying again.');}
  finally{setBusy(false);}
 }
 const currentLabel=!release?'Not loaded':!release.enabled?'Unavailable while releases are disabled':currentVersion?`${themeName(currentVersion.themeId)} · Version ${currentVersion.version}`:release.current?`Saved version ${release.current}`:'No release recorded';
 return <main className="mx-auto max-w-6xl space-y-5 p-5"><Link href="/admin/launch" className="underline">Back to setup</Link><h1 className="text-3xl font-semibold">Preview theme releases</h1><p>Review saved designs, record a Preview release, or restore a previously released version. This does not launch a seller or enable checkout.</p><p role="status">{notice}</p>
 <div className="flex flex-wrap gap-5"><button type="button" disabled={busy} className="min-h-11 underline" onClick={()=>void refresh()}>Refresh release data</button><Link href="/admin/themes/released" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center underline">Open released storefront (new tab)</Link></div>
 <section className="rounded-xl border bg-white p-5"><h2 className="font-semibold">Current Preview design</h2><p className="mt-2">{currentLabel}</p></section>
 <fieldset disabled={busy} className="space-y-5"><legend className="sr-only">Preview release selection</legend><label className="block">Saved design<select className="ml-3 min-h-11 rounded border p-2" value={selected} onChange={event=>{setSelected(event.target.value);setReview(null);}}><option value="">Choose a version</option>{versions.map(item=><option key={item.id} value={item.id}>{themeName(item.themeId)} · Version {item.version}</option>)}</select></label>
 {!busy&&release&&!versions.length&&<p>No saved design versions yet. <Link className="underline" href="/admin/themes">Open a theme and save a version first.</Link></p>}
 {preview&&<iframe title="Selected saved design with current catalogue" src={preview} className="h-[650px] w-full rounded border"/>}
 <label className="block">Release note<textarea maxLength={500} className="mt-2 block w-full rounded border p-3" value={reason} onChange={event=>{setReason(event.target.value);setReview(null);}}/></label>
 <div className="grid gap-4 sm:grid-cols-2"><div><button type="button" disabled={!!publishBlocked} className="min-h-11 rounded border px-4 disabled:opacity-50" onClick={()=>setReview('publish')}>Review Preview release</button>{publishBlocked&&<p className="mt-2 text-sm">{publishBlocked}</p>}</div><div><button type="button" disabled={!!rollbackBlocked} className="min-h-11 rounded border px-4 disabled:opacity-50" onClick={()=>setReview('rollback')}>Review rollback</button>{rollbackBlocked&&<p className="mt-2 text-sm">{rollbackBlocked}</p>}</div></div>
 {review&&version&&<section className="space-y-3 rounded-xl border border-[#215241] bg-white p-5"><h2 className="text-xl font-semibold">Confirm {review==='publish'?'Preview release':'Preview rollback'}</h2><p>From: {currentLabel}</p><p>To: {themeName(version.themeId)} · Version {version.version}</p><p className="break-words">Release note: {reason}</p><p>Changes the Preview release pointer and records an event. It does not enable checkout or change production. Previous saved versions remain available.</p><div className="flex flex-wrap gap-4"><button type="button" disabled={!!releaseActionBlocked(release,version,reason,review)} className="min-h-11 rounded bg-[#215241] px-4 text-white disabled:opacity-50" onClick={()=>void change(review)}>Confirm {review==='publish'?'Preview release':'rollback'}</button><button type="button" className="min-h-11 underline" onClick={()=>setReview(null)}>Keep current release</button></div></section>}
 </fieldset>
 <h2 className="text-xl font-semibold">Release history</h2>{release?.enabled&&!release.events.length&&<p>No release events recorded.</p>}<ul>{release?.events.map(event=><li key={event.id} className="my-3 rounded border p-3"><p>{event.action} · {versions.find(item=>item.id===event.theme_version_id)?`Version ${versions.find(item=>item.id===event.theme_version_id)!.version}`:event.theme_version_id}</p><p>{event.reason}</p><time dateTime={event.created_at}>{new Date(event.created_at).toLocaleString('en-GB')}</time></li>)}</ul></main>;
}
