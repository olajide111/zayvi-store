import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {THEME_DESIGNS} from '../lib/theme-designs';
import {ALL_STUDIO_THEMES,ADDITIONAL_STUDIO_THEMES} from '../lib/theme-registry';
import {DIRECTION_FAMILIES} from '../lib/storefront-theme-directions';
test('existing 20 designs are byte-for-byte unchanged and remain first in the registry',()=>{
 assert.deepEqual(readFileSync('lib/theme-designs.ts'),execFileSync('git',['show','0e61775375a2ab0f30cc5008c23ad2c17ffc74c4:lib/theme-designs.ts']));
 assert.deepEqual(ALL_STUDIO_THEMES.slice(0,20),THEME_DESIGNS);
});
test('all six directions have distinct IDs without changing existing pricing groups',()=>{
 assert.equal(ALL_STUDIO_THEMES.length,26);assert.equal(new Set(ALL_STUDIO_THEMES.map(t=>t.id)).size,26);
 assert.deepEqual(ADDITIONAL_STUDIO_THEMES.map(t=>t.directionFamily),[...DIRECTION_FAMILIES]);
 assert(ADDITIONAL_STUDIO_THEMES.every(t=>t.reviewOnly&&!t.premium));
 assert.equal(THEME_DESIGNS.filter(t=>t.premium).length,6);
});
test('added themes have unique display names while keeping their existing route IDs',()=>{
 assert.deepEqual(Object.fromEntries(ADDITIONAL_STUDIO_THEMES.map(t=>[t.id,t.name])),{
  'fashion-showroom':'Runway','african-editorial':'Ilé','modern-marketplace':'Soko',
  'atelier-minimal':'Forma','fresh-market':'Oja','spec-sheet':'Volt',
 });
 assert.equal(new Set(ALL_STUDIO_THEMES.map(t=>t.name.toLocaleLowerCase('en-GB'))).size,26);
 const oja=ADDITIONAL_STUDIO_THEMES.find(t=>t.id==='fresh-market')!;
 assert.equal(oja.accent,'#542B58');assert.equal(oja.canvas,'#FFF4E8');
});
