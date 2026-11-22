"use client";
import {useState} from 'react';
import {Copy} from 'lucide-react';
import {buildCampaignLink,type CampaignLinkInput} from '@/lib/campaign-links';
export default function CampaignLinkBuilder(){
  const [input,setInput]=useState<CampaignLinkInput>({destination:'',source:'',medium:'social',campaign:'',content:''});
  const [result,setResult]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState('');
  function update(field:keyof CampaignLinkInput,value:string){setInput(current=>({...current,[field]:value}));setResult('');setNotice('');setError('');}
  async function copy(){try{await navigator.clipboard.writeText(result);setNotice('Link copied.');}catch{setNotice('Copy is unavailable. Select and copy the link below.');}}
  return <section className="rounded-2xl border border-[#dfe6e1] bg-white p-5" aria-labelledby="campaign-link-title">
    <h2 id="campaign-link-title" className="font-semibold">Create a campaign link</h2>
    <p className="mt-2 text-sm leading-relaxed text-[#64756b]">Label links for a public store page. Creating a link does not send or publish anything, and campaign attribution is not connected yet.</p>
    <form className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={event=>{event.preventDefault();try{setResult(buildCampaignLink(input));setError('');setNotice('');}catch(e){setError(e instanceof Error?e.message:'Check the link details.');}}}>
      {([
        ['destination','Public store page','https://your-store.com/collection'],['source','Source','instagram'],
        ['medium','Medium','social'],['campaign','Campaign','winter-collection'],['content','Creative label (optional)','video-a'],
      ] as [keyof CampaignLinkInput,string,string][]).map(([key,label,placeholder])=><label key={key} className={`text-xs font-medium text-[#52635b] ${key==='destination'?'sm:col-span-2':''}`}>{label}<input type={key==='destination'?'url':'text'} required={key!=='content'} value={input[key]} maxLength={key==='destination'?2048:80} placeholder={placeholder} onChange={event=>update(key,event.target.value)} className="mt-1 block min-h-11 w-full rounded-lg border border-[#dfe6e1] bg-white px-3 text-sm text-[#202923]"/></label>)}
      <div className="flex items-end"><button type="submit" className="min-h-11 rounded-lg bg-[#215241] px-4 text-sm font-semibold text-white">Create link</button></div>
    </form>
    {error&&<p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    {result&&<div className="mt-4 rounded-xl bg-[#f5f8f5] p-4"><label className="text-xs font-medium text-[#52635b]">Campaign URL<textarea readOnly value={result} rows={3} onFocus={event=>event.target.select()} className="mt-2 block w-full resize-y rounded-lg border border-[#dfe6e1] bg-white p-3 text-sm"/></label><button type="button" onClick={copy} className="mt-2 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#215241]"><Copy size={15}/>Copy link</button></div>}
    {notice&&<p role="status" className="mt-2 text-sm text-[#52635b]">{notice}</p>}
  </section>;
}
