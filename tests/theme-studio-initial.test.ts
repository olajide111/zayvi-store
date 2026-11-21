import test from 'node:test';
import assert from 'node:assert/strict';
import {ALL_STUDIO_THEMES} from '../lib/theme-registry';
import {resolveStudioInitial} from '../lib/theme-studio-initial';
const canvas=ALL_STUDIO_THEMES.find(t=>t.id==='canvas')!;
const setup={profile:{name:'Merchant',industry:'Fashion',otherIndustry:'',style:'Either',themeId:'canvas',appearance:{palette:'custom',font:'serif',colours:{canvas:'#ffffff',ink:'#111111',accent:'#215241'}}}};
test('onboarding appearance opens in its selected studio',()=>{
 const r=resolveStudioInitial(canvas,null,setup);assert.equal(r.draft?.brand,'Merchant');assert.equal(r.draft?.font,'serif');assert.equal(r.draft?.colours.accent,'#215241');
});
test('saved design takes priority over onboarding and is theme scoped',()=>{
 const draft={...resolveStudioInitial(canvas,null,setup).draft!,brand:'Saved studio'};
 const r=resolveStudioInitial(canvas,{latestVersions:[{themeId:'canvas',version:8,draft}]},setup);
 assert.equal(r.draft?.brand,'Saved studio');assert.match(r.source,/8/);
 assert.equal(resolveStudioInitial(ALL_STUDIO_THEMES.find(t=>t.id==='soho')!,null,setup).draft,undefined);
});
test('invalid stored data fails safely and can fall back to onboarding',()=>{
 assert.equal(resolveStudioInitial(canvas,{versions:[{themeId:'canvas',draft:{brand:'invalid'}}]},setup).draft?.brand,'Merchant');
 assert.equal(resolveStudioInitial(canvas,null,{profile:{name:'bad'}}).draft,undefined);
});
