'use client';
import {useState} from 'react';
import Link from 'next/link';
import type {StudioTheme} from '@/lib/theme-registry';
import {THEME_FONTS,themePalettes,validateAppearance,appearanceQuery,type ThemeAppearance} from '@/lib/theme-appearance';
export default function SetupAppearance({theme,brand,initial,onSave,disabled}:{theme:StudioTheme;brand:string;initial?:ThemeAppearance;onSave:(appearance:ThemeAppearance)=>Promise<void>;disabled:boolean}){
 const [draft,setDraft]=useState<ThemeAppearance>(()=>initial||validateAppearance(undefined,theme));
 const [error,setError]=useState('');
 const query=appearanceQuery(draft,brand);
 async function save(){try{const valid=validateAppearance(draft,theme);setError('');await onSave(valid);}catch(e){setError(e instanceof Error?e.message:'Could not save appearance.');}}
 return <section className="mt-5 border-t pt-5"><h3 className="font-semibold">Make {theme.name} yours</h3><p className="my-2 text-sm">Preview your colours and typography before saving. These choices do not activate a theme.</p>
 <fieldset disabled={disabled} className="space-y-3"><legend className="sr-only">Theme appearance</legend><label className="block">Colour palette<select className="ml-3 min-h-11 rounded border p-2" value={draft.palette} onChange={e=>{const palette=themePalettes(theme).find(p=>p.id===e.target.value);setDraft({...draft,palette:e.target.value as ThemeAppearance['palette'],colours:palette?.colours||draft.colours});}}>{themePalettes(theme).map(p=><option key={p.id} value={p.id}>{p.label}</option>)}<option value="custom">My brand colours</option></select></label>
 {draft.palette==='custom'&&<div className="flex flex-wrap gap-4">{(['canvas','ink','accent'] as const).map(k=><label key={k}>{k==='canvas'?'Background':k==='ink'?'Text':'Accent'}<input type="color" className="ml-2 h-11 w-14" value={draft.colours[k]} onChange={e=>setDraft({...draft,colours:{...draft.colours,[k]:e.target.value}})}/></label>)}</div>}
 <label className="block">Typography<select className="ml-3 min-h-11 rounded border p-2" value={draft.font} onChange={e=>setDraft({...draft,font:e.target.value as ThemeAppearance['font']})}>{THEME_FONTS.map(f=><option key={f.id} value={f.id}>{f.label}</option>)}</select></label>
 <button type="button" className="min-h-11 rounded bg-[#215241] px-4 text-white disabled:opacity-50" onClick={()=>void save()}>Save colours and font</button></fieldset>
 {error&&<p role="alert" className="my-2 text-red-800">{error}</p>}
 <Link href={`/admin/themes/${theme.id}/demo?${query}`} className="my-3 inline-flex min-h-11 items-center underline">Open full device demo with these choices</Link>
 <iframe title={`${theme.name} appearance preview`} src={`/admin/themes/${theme.id}/preview?${query}`} className="h-[600px] w-full rounded-xl border bg-white"/>
 </section>;
}
