import {resolveReleasedTheme,previewThemeStorefrontEnabled} from '../lib/released-theme';
import test from 'node:test';
import assert from 'node:assert/strict';
import {validateThemeRelease,previewReleasesEnabled} from '../lib/theme-release';
import {queryThemeRelease} from '../infra/lambda/theme-releases';
const a='11111111-1111-1111-1111-111111111111',b='22222222-2222-2222-2222-222222222222';
const env={NODE_ENV:'test' as const,THEME_RELEASE_MODE:'preview',AWS_LAMBDA_FUNCTION_NAME:'zayvi-preview-api'};
const draft={kind:'studio-draft',themeId:'canvas',draft:{brand:'Store',headline:'Hello',font:'sans',palette:'theme',motion:'off',colours:{canvas:'#ffffff',ink:'#111111',accent:'#111111'}}};
test('release validation and Preview environment guard fail closed',async()=>{
 assert.equal(previewReleasesEnabled({...env,AWS_LAMBDA_FUNCTION_NAME:'zayvi-production-api'}),false);
 assert.throws(()=>validateThemeRelease({action:'publish',versionId:a,reason:'Missing expected pointer'}));
 const deps={getPool:()=>{throw new Error('Must not access DB');},withTenant:()=>{throw new Error();}};
 assert.equal((await queryThemeRelease(deps,null,false,{NODE_ENV:'test'})).enabled,false);
 await assert.rejects(queryThemeRelease(deps,{action:'publish'},true,{NODE_ENV:'test'}),(e:any)=>e.statusCode===423);
});
function fixture(){let current:string|null=null;const events:any[]=[];let released=0;
 const tx={release(){released++;},async query(sql:string,args:any[]){
  assert.equal(args[0],'tenant');
  if(sql.includes('SELECT id FROM stores'))return {rowCount:1,rows:[{id:'store'}]};
  assert.equal(args[1],'store');
  if(sql.includes('SELECT theme_version_id'))return {rows:current?[{theme_version_id:current}]:[]};
  if(sql.includes('SELECT config'))return {rowCount:1,rows:[{config:{...draft,draft:{...draft.draft,brand:args[2]===a?'Release A':'Release B'}}}]};
  if(sql.includes('SELECT id FROM store_theme_release_events')){const rows=events.filter(e=>e.theme_version_id===args[2]);return {rowCount:rows.length,rows};}
  if(sql.includes('INSERT INTO store_theme_releases')){current=args[2];return {};}
  if(sql.includes('INSERT INTO store_theme_release_events')){events.push({id:String(events.length),theme_version_id:args[2],action:args[3],reason:args[4]});return {};}
  return {rows:[...events].reverse()};
 }};
 return {deps:{getPool:()=>({connect:async()=>tx}),withTenant:async(_t:any,fn:any)=>fn(tx,'tenant')},events,current:()=>current,released:()=>released};
}
test('publish preserves history, rejects stale pointers and permits previously released rollback',async()=>{
 const f=fixture();const send=(versionId:string,expectedReleaseId:string|null,action='publish')=>queryThemeRelease(f.deps,{versionId,expectedReleaseId,action,reason:'Reviewed Preview design'},true,env);
 const first=await send(a,null);assert.equal(f.current(),a);assert.equal(resolveReleasedTheme(first)?.config.draft.brand,'Release A');
 await assert.rejects(send(b,null),(e:any)=>e.statusCode===409);assert.equal(f.events.length,1);
 await assert.rejects(send(b,a,'rollback'),(e:any)=>e.statusCode===400);assert.equal(f.current(),a);
 const second=await send(b,a);assert.equal(resolveReleasedTheme(second)?.config.draft.brand,'Release B');const restored=await send(a,b,'rollback');assert.equal(resolveReleasedTheme(restored)?.config.draft.brand,'Release A');assert.equal(f.current(),a);assert.equal(f.events.length,3);
 await send(a,a);assert.equal(f.events.length,3);assert.equal(f.released(),6);
});

test('released rendering refuses invalid configurations and production activation',()=>{
 assert.equal(previewThemeStorefrontEnabled({VERCEL_ENV:'production',ZAYVI_PREVIEW_THEME_STOREFRONT:'enabled'}),false);
 assert.equal(previewThemeStorefrontEnabled({VERCEL_ENV:'preview',ZAYVI_PREVIEW_THEME_STOREFRONT:'enabled'}),true);
 assert.equal(previewThemeStorefrontEnabled({VERCEL_ENV:'preview'}),false);
 assert.equal(resolveReleasedTheme({enabled:true,current:a,design:{themeId:'unregistered',draft:{}}}),null);
 assert.equal(resolveReleasedTheme({enabled:false,current:a,design:{themeId:'canvas',draft:draft.draft}}),null);
});
