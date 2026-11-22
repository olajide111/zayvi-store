import test from 'node:test';
import assert from 'node:assert/strict';
import {validateStoreSetup} from '../lib/store-setup';
const valid={name:' Zayvi ',industry:'Fashion',otherIndustry:'',style:'Either',themeId:'canvas'};
test('setup trims names and accepts registered theme preferences',()=>assert.equal(validateStoreSetup(valid).name,'Zayvi'));
test('setup rejects unknown themes and invalid required details',()=>{
 for(const patch of [{name:''},{themeId:'injected'},{industry:'unknown'},{style:'unknown'},{otherIndustry:42},{industry:'Other',otherIndustry:''}])assert.throws(()=>validateStoreSetup({...valid,...patch}));
});
test('setup accepts no preference and does not accept publishing authority',()=>{
 const result=validateStoreSetup({...valid,themeId:'',published:true,tenantId:'other'});
 assert.equal(result.themeId,'');assert.equal('tenantId' in result,false);assert.equal('published' in result,false);
});
test('appearance uses theme defaults and rejects unreadable custom text',()=>{
 const result=validateStoreSetup(valid);
 assert.equal(result.appearance?.font,'theme');
 assert.throws(()=>validateStoreSetup({...valid,appearance:{palette:'custom',font:'sans',colours:{canvas:'#ffffff',ink:'#ffffff',accent:'#000000'}}}));
 assert.throws(()=>validateStoreSetup({...valid,appearance:{palette:'signature',font:'remote-script'}}));
 const custom=validateStoreSetup({...valid,appearance:{palette:'custom',font:'serif',colours:{canvas:'#ffffff',ink:'#111111',accent:'#334455'}}});
 assert.equal(custom.appearance?.font,'serif');
 assert.equal(custom.appearance?.colours.accent,'#334455');
});
test('a fresh setup has no implicit theme and changing its name cannot supply one',()=>{
 const fresh=validateStoreSetup({...valid,name:'New pilot',themeId:'',appearance:undefined});
 assert.equal(fresh.themeId,'');assert.equal(fresh.appearance,undefined);
 const updated=validateStoreSetup({...fresh,name:'Another name'});
 assert.equal(updated.themeId,'');
});
