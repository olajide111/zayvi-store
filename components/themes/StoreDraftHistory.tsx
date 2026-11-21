'use client';
import {useEffect,useState} from 'react';
import {validateThemeDraft} from '@/lib/theme-draft';
import {draftSaveBlocked} from '@/lib/theme-draft-session';
import {requestDesignHistory,type DesignVersion,type DesignHistory} from '@/lib/design-history';

export default function StoreDraftHistory({themeId,initialBaseVersion,draft,disabled,onRestore,onSaved}:{themeId:string;initialBaseVersion?:number;draft:string;disabled:boolean;onRestore:(draft:Record<string,unknown>)=>void;onSaved:()=>void}){
 const [editorBase,setEditorBase]=useState<number|null>(initialBaseVersion??null);
 const [history,setHistory]=useState<DesignHistory|null>(null),[busy,setBusy]=useState(false),[notice,setNotice]=useState('Loading saved versions…');
 const [review,setReview]=useState<DesignVersion|null>(null);
 async function refresh(signal?:AbortSignal){
  setBusy(true);setNotice('Loading saved versions…');
  try{const data=await requestDesignHistory({signal});if(signal?.aborted)return;setHistory(data);setNotice('Saved versions loaded. Your editor has not changed.');}
  catch(error){if(!signal?.aborted){setHistory(null);setNotice(error instanceof Error?error.message:'Could not load versions.');}}
  finally{if(!signal?.aborted)setBusy(false);}
 }
 useEffect(()=>{const controller=new AbortController();void refresh(controller.signal);return()=>controller.abort();},[themeId]);
 async function save(){
  if(busy||disabled||!history||draftSaveBlocked(editorBase,history.baseVersion))return;
  setBusy(true);setReview(null);
  try{
   const body={themeId,draft:JSON.parse(draft),baseVersion:editorBase};validateThemeDraft(body);
   const data=await requestDesignHistory({body});setHistory(data);setEditorBase(data.baseVersion);onSaved();setNotice('New design version saved to your store. It is not published.');
  }catch(error){setHistory(null);setEditorBase(null);setNotice(error instanceof Error?error.message:'Could not confirm the save. Refresh versions before trying again.');}
  finally{setBusy(false);}
 }
 function restore(version:DesignVersion){
  if(busy||disabled||version.themeId!==themeId)return;
  try{const valid=validateThemeDraft({themeId,draft:version.draft,baseVersion:history?.baseVersion||0});onRestore(valid.config.draft);setEditorBase(history?.baseVersion??null);setReview(null);setNotice(`Version ${version.version} loaded into the editor. Save to create a new version; history remains unchanged.`);}
  catch{setNotice('This version is incompatible and could not be restored.');}
 }
 const versions=history?.versions.filter(version=>version.themeId===themeId)||[];
 return <section className="my-4 border-t pt-4" aria-label="Store design versions"><h2 className="font-semibold">Store design versions</h2><p className="my-2 text-sm">Save across devices. Review an older version before replacing the editor. Your customer storefront stays unchanged.</p>
 <div className="flex flex-wrap gap-2"><button type="button" className="min-h-11 rounded border px-3 disabled:opacity-50" disabled={busy||disabled||!history||draftSaveBlocked(editorBase,history.baseVersion)} onClick={()=>void save()}>{busy?'Please wait…':'Save version to store'}</button><button type="button" className="min-h-11 underline" disabled={busy} onClick={()=>void refresh()}>Refresh versions</button></div>
 {history&&draftSaveBlocked(editorBase,history.baseVersion)&&<div className="my-3 rounded border border-amber-300 bg-amber-50 p-3 text-sm"><p>Your editor and saved history have different baselines. Load a saved version, or deliberately keep these edits as a new version. Existing versions remain unchanged.</p><button type="button" className="min-h-11 underline" disabled={busy||disabled} onClick={()=>{setEditorBase(history.baseVersion);setNotice('Current edits kept. You can now save them as a new version.');}}>Keep my edits against version {history.baseVersion}</button></div>}
 <p role="status" className="my-2 text-sm">{notice}</p>
 {review&&<div className="my-3 space-y-2 rounded-xl border bg-white p-4"><h3 className="font-semibold">Review version {review.version}</h3><p className="text-sm">{String(review.draft.brand||'Unnamed store')} · {new Date(review.createdAt).toLocaleString('en-GB')}</p><p className="text-sm">{String(review.draft.headline||'No custom headline')}</p><p className="text-sm">Loading replaces the current editor settings, including unsaved edits. It does not delete a saved version or publish a storefront.</p><div className="flex flex-wrap gap-3"><button type="button" className="min-h-11 rounded border px-3" disabled={busy||disabled} onClick={()=>restore(review)}>Load version {review.version} into editor</button><button type="button" className="min-h-11 underline" onClick={()=>setReview(null)}>Keep current editor</button></div></div>}
 {history&&!versions.length&&<p className="my-3 text-sm">No saved versions for this theme yet. Save your first version when your design is ready.</p>}
 {!!versions.length&&<ul>{versions.map(version=><li key={version.id} className="my-2 flex flex-wrap items-center gap-2 rounded border p-3 text-sm"><span>Version {version.version} · {new Date(version.createdAt).toLocaleString('en-GB')}</span><button type="button" className="min-h-11 underline" disabled={busy||disabled} onClick={()=>setReview(version)}>Review version {version.version}</button></li>)}</ul>}
 </section>;
}
