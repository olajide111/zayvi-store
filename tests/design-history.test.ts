import test from 'node:test';
import assert from 'node:assert/strict';
import {parseDesignHistory,requestDesignHistory} from '../lib/design-history';
const version={id:'version-1',version:1,createdAt:'2026-11-21T20:00:00Z',themeId:'original',draft:{brand:'Merchant'}};

test('history validates the global save baseline and rejects malformed version rows',()=>{
 assert.deepEqual(parseDesignHistory({baseVersion:0,versions:[]}),{baseVersion:0,versions:[]});
 assert.equal(parseDesignHistory({baseVersion:4,versions:[version]}).versions[0].themeId,'original');
 for(const value of [null,{baseVersion:-1,versions:[]},{baseVersion:0,versions:[version]},{baseVersion:1,versions:[{...version,createdAt:'bad'}]},{baseVersion:1,versions:[{...version,draft:[]}]}])assert.throws(()=>parseDesignHistory(value));
});
test('failed history reads expose the API error rather than accepting a baseline',async()=>{
 const fetcher=(async()=>new Response(JSON.stringify({error:'Unauthorised'}),{status:401})) as typeof fetch;
 await assert.rejects(()=>requestDesignHistory({fetcher}),/Unauthorised/);
});
test('history deadline cancels the read and offers an explicit retry',async()=>{
 let calls=0;
 const fetcher=((_url,options)=>{calls++;return new Promise((_resolve,reject)=>options?.signal?.addEventListener('abort',()=>reject(new Error('aborted')),{once:true}));}) as typeof fetch;
 await assert.rejects(()=>requestDesignHistory({fetcher,timeoutMs:5}),/took too long/);
 assert.equal(calls,1);
});
test('a timed-out save is not retried and reports an uncertain outcome',async()=>{
 let calls=0;
 const fetcher=((_url,options)=>{calls++;return new Promise((_resolve,reject)=>options?.signal?.addEventListener('abort',()=>reject(new Error('aborted')),{once:true}));}) as typeof fetch;
 await assert.rejects(()=>requestDesignHistory({body:{themeId:'original'},fetcher,timeoutMs:5}),/may have been saved.*Refresh/);
 assert.equal(calls,1);
});
test('a completed save with a lost response can be recovered by reading history without another write',async()=>{
 let writes=0,saved=false;
 const fetcher=(async(_url,options)=>{
  if(options?.method==='POST'){writes++;saved=true;throw new Error('Connection lost');}
  return new Response(JSON.stringify({baseVersion:saved?1:0,versions:saved?[version]:[]}));
 }) as typeof fetch;
 await assert.rejects(()=>requestDesignHistory({body:{themeId:'original'},fetcher}),/Refresh versions.*completed save/);
 const recovered=await requestDesignHistory({fetcher});
 assert.equal(recovered.baseVersion,1);assert.equal(recovered.versions.length,1);assert.equal(writes,1);
});
