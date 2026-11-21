import test from 'node:test';
import assert from 'node:assert/strict';
import {validateThemeDraft} from '../lib/theme-draft';
import {queryThemeDrafts} from '../infra/lambda/theme-drafts';
const input={themeId:'canvas',baseVersion:0,draft:{brand:'Shop',headline:'Hello',font:'sans',palette:'custom',motion:'off',colours:{canvas:'#ffffff',ink:'#111111',accent:'#215241'}}};
test('draft validation strips authority fields and rejects unsupported settings',()=>{
 const v=validateThemeDraft({...input,tenantId:'other',published:true});
 assert.equal(v.config.kind,'studio-draft');assert.equal('published' in v.config,false);
 for(const patch of [{themeId:'missing'},{baseVersion:-1},{baseVersion:0.5},{draft:{...input.draft,font:'url(evil)'}},{draft:{...input.draft,colours:{...input.draft.colours,ink:'#ffffff'}}}])assert.throws(()=>validateThemeDraft({...input,...patch}));
});
function fixture(){
 let version=0,releases=0;const statements:string[]=[];const rows:any[]=[];
 const client={release(){releases++;},async query(sql:string,args:any[]){
  statements.push(sql);assert.equal(args[0],'trusted-tenant');
  if(sql.includes('SELECT id FROM stores'))return {rowCount:1,rows:[{id:'trusted-store'}]};
  assert.equal(args[1],'trusted-store');
  if(sql.includes('MAX(version_number)'))return {rows:[{version}]};
  if(sql.includes('INSERT INTO')){version=args[2];rows.unshift({id:String(version),version_number:version,created_at:'2026-11-21',config:JSON.parse(args[4])});return {rowCount:1};}
  return {rows};
 }};
 return {deps:{getPool:()=>({connect:async()=>client}),withTenant:async(_c:any,fn:any)=>fn(client,'trusted-tenant')},statements,releases:()=>releases};
}
test('draft versions are scoped, immutable and reject stale saves',async()=>{
 const f=fixture();const first=await queryThemeDrafts(f.deps,input,true);
 assert.equal(first.baseVersion,1);assert.equal(first.versions.length,1);assert.equal(first.publishingEnabled,false);
 await assert.rejects(queryThemeDrafts(f.deps,input,true),(error:any)=>error.statusCode===409);
 const second=await queryThemeDrafts(f.deps,{...input,baseVersion:1},true);
 assert.equal(second.versions.length,2);assert.equal(second.baseVersion,2);
 assert.ok(f.statements.some(s=>s.includes('FOR UPDATE')));
 assert.ok(f.statements.every(s=>!s.includes('store_theme_releases')&&!s.includes('UPDATE store_theme_versions')));
 assert.equal(f.releases(),3);
});
