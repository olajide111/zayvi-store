import test from 'node:test';
import assert from 'node:assert/strict';
import {parsePreviewRelease,releaseActionBlocked,requestPreviewRelease} from '../lib/theme-release-review';
const a='11111111-1111-1111-1111-111111111111',b='22222222-2222-2222-2222-222222222222';
const event={id:a,theme_version_id:a,action:'publish' as const,reason:'Reviewed',created_at:'2026-11-21T20:00:00Z'};
const release={enabled:true,current:b,events:[event]};
const version={id:a,version:1,createdAt:event.created_at,themeId:'original',draft:{brand:'Store',headline:'Good finds',font:'sans',palette:'theme',motion:'off',colours:{canvas:'#ffffff',ink:'#111111',accent:'#203e31'}}};
test('release responses require explicit enablement, a valid pointer and valid history',()=>{
 assert.equal(parsePreviewRelease({enabled:false,current:null,events:[]}).enabled,false);
 assert.deepEqual(parsePreviewRelease(release),release);
 for(const value of [null,{current:null,events:[]},{enabled:'true',current:null,events:[]},{...release,current:'bad'},{...release,events:[{...event,created_at:'bad'}]},{...release,events:[{...event,id:[a]}]}])assert.throws(()=>parsePreviewRelease(value));
});
test('release actions fail closed for disabled, unavailable, incompatible or already-current designs',()=>{
 for(const state of [null,{...release,enabled:false}])assert.ok(releaseActionBlocked(state,version,'Reviewed','publish'));
 assert.ok(releaseActionBlocked(release,undefined,'Reviewed','publish'));
 assert.ok(releaseActionBlocked(release,{...version,themeId:'unregistered'},'Reviewed','publish'));
 assert.ok(releaseActionBlocked({...release,current:a},version,'Reviewed','publish'));
 assert.ok(releaseActionBlocked(release,version,'','publish'));
});
test('rollback requires loaded prior-release evidence and valid releases can proceed to review',()=>{
 assert.equal(releaseActionBlocked(release,version,'Reviewed','publish'),'');
 assert.equal(releaseActionBlocked(release,version,'Reviewed','rollback'),'');
 assert.match(releaseActionBlocked({...release,events:[]},version,'Reviewed','rollback'),/loaded release history/);
});
test('release deadline cancels a read without repeatedly requesting it',async()=>{
 let calls=0;
 const fetcher=((_url,options)=>{calls++;return new Promise((_resolve,reject)=>options?.signal?.addEventListener('abort',()=>reject(new Error('aborted')),{once:true}));}) as typeof fetch;
 await assert.rejects(()=>requestPreviewRelease({fetcher,timeoutMs:5}),/too long/);assert.equal(calls,1);
});
test('lost release response requires reconciliation and never triggers a second write',async()=>{
 let writes=0,current:string|null=b;
 const fetcher=(async(_url,options)=>{
  if(options?.method==='POST'){writes++;current=a;throw new Error('Connection lost');}
  return new Response(JSON.stringify({...release,current}));
 }) as typeof fetch;
 await assert.rejects(()=>requestPreviewRelease({body:{action:'publish',versionId:a},fetcher}),/Refresh release data/);
 assert.equal((await requestPreviewRelease({fetcher})).current,a);assert.equal(writes,1);
});
