import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync('infra/lambda/index.js','utf8');
const start=source.indexOf('async function checkSchemaMigrations(');
const end=source.indexOf('\nfunction requiredSchemaMigrationsForRoute',start);
const fn=source.slice(start,end);
test('unknown migration requirements fail closed and release the client',async()=>{
 let released=false;
 const context:any={getPool:()=>({connect:async()=>({release(){released=true;}})}),schemaMigrationDefinitions:[{name:'known'}],probeSchemaMigration:async()=>true};
 vm.createContext(context);vm.runInContext(fn+'\nthis.check=checkSchemaMigrations;',context);
 const result=await context.check(['known','unknown']);
 assert.equal(result.ready,false);assert.deepEqual([...result.pending],['unknown']);assert.equal(released,true);
});
test('missing known schema blocks the route',async()=>{
 const context:any={getPool:()=>({connect:async()=>({release(){}})}),schemaMigrationDefinitions:[{name:'known'}],probeSchemaMigration:async()=>false};
 vm.createContext(context);vm.runInContext(fn+'\nthis.check=checkSchemaMigrations;',context);
 assert.equal((await context.check(['known'])).ready,false);
});
