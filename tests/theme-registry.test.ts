import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {THEME_DESIGNS} from '../lib/theme-designs';
import {ALL_STUDIO_THEMES,ADDITIONAL_STUDIO_THEMES,LONDON_SIGNATURE_THEMES,ESSENTIAL_THEMES} from '../lib/theme-registry';
import {DIRECTION_FAMILIES} from '../lib/storefront-theme-directions';
import {groupedThemes,THEME_GALLERY_GROUPS,balancedThemeRows,themeCardSpan} from '../components/themes/theme-gallery-groups';
test('the eighteen unaffected definitions stay byte-for-byte unchanged; Adire and Accra remain free',()=>{
 const unaffected=(value:string)=>value.split('\n').filter(line=>!/^  \{id:'(?:adire|accra)'/.test(line)).join('\n');
 assert.equal(unaffected(readFileSync('lib/theme-designs.ts','utf8')),unaffected(execFileSync('git',['show','0e61775375a2ab0f30cc5008c23ad2c17ffc74c4:lib/theme-designs.ts'],{encoding:'utf8'})));
 assert(THEME_DESIGNS.filter(t=>['adire','accra'].includes(t.id)).every(t=>t.free&&!t.premium));
 assert.deepEqual(ALL_STUDIO_THEMES.slice(0,20),THEME_DESIGNS);
});
test('all six directions have distinct IDs without changing existing pricing groups',()=>{
 assert.equal(ALL_STUDIO_THEMES.length,30);assert.equal(new Set(ALL_STUDIO_THEMES.map(t=>t.id)).size,30);
 assert.deepEqual(ADDITIONAL_STUDIO_THEMES.map(t=>t.directionFamily),[...DIRECTION_FAMILIES]);
 assert(ADDITIONAL_STUDIO_THEMES.every(t=>t.reviewOnly&&!t.premium));
 assert.equal(THEME_DESIGNS.filter(t=>t.premium).length,6);
});
test('added themes have unique display names while keeping their existing route IDs',()=>{
 assert.deepEqual(Object.fromEntries(ADDITIONAL_STUDIO_THEMES.map(t=>[t.id,t.name])),{
  'fashion-showroom':'Runway','african-editorial':'Ilé','modern-marketplace':'Soko',
  'atelier-minimal':'Forma','fresh-market':'Oja','spec-sheet':'Volt',
 });
 assert.equal(new Set(ALL_STUDIO_THEMES.map(t=>t.name.toLocaleLowerCase('en-GB'))).size,30);
 const oja=ADDITIONAL_STUDIO_THEMES.find(t=>t.id==='fresh-market')!;
 assert.equal(oja.accent,'#542B58');assert.equal(oja.canvas,'#FFF4E8');
});

test('curated gallery groups cover every theme exactly once and preserve filters',()=>{
 const all=groupedThemes(ALL_STUDIO_THEMES),ids=all.flatMap(g=>g.themes.map(t=>t.id));
 assert.equal(ids.length,30);assert.equal(new Set(ids).size,30);
 assert.deepEqual([...ids].sort(),ALL_STUDIO_THEMES.map(t=>t.id).sort());
 assert.deepEqual(all[0].themes.slice(0,2).map(t=>t.id),['adire','accra']);
 assert.equal(THEME_GALLERY_GROUPS.length,6);
 const forma=groupedThemes(ALL_STUDIO_THEMES.filter(t=>t.id==='atelier-minimal'));
 assert.equal(forma.length,1);assert.equal(forma[0].id,'fashion');
 assert.equal(groupedThemes([]).length,0);
});

test('London signatures are distinct free themes, usable alongside either regional collection',()=>{
 assert.deepEqual(LONDON_SIGNATURE_THEMES.map(t=>[t.id,t.name,t.signatureFamily]),[['mayfair','Mayfair','mayfair'],['camden','Camden','camden'],['soho','Soho','soho']]);
 assert(LONDON_SIGNATURE_THEMES.every(t=>t.free&&!t.premium&&!t.reviewOnly));
 assert.notEqual(LONDON_SIGNATURE_THEMES[0].canvas,LONDON_SIGNATURE_THEMES[1].canvas);
 assert.notEqual(LONDON_SIGNATURE_THEMES[0].accent,LONDON_SIGNATURE_THEMES[1].accent);
 const group=groupedThemes(LONDON_SIGNATURE_THEMES);assert.equal(group.length,1);assert.equal(group[0].id,'london');
});

test('balanced rows and card spans fill each row on desktop and tablet without filler cards',()=>{
 for(let count=1;count<=6;count++)for(const columns of [1,2,3]){
  const rows=balancedThemeRows(count,columns);assert.equal(rows.reduce((a,b)=>a+b,0),count);
  assert(Math.max(...rows)-Math.min(...rows)<=1);
  let at=0;for(const length of rows){let spans=0;for(let n=0;n<length;n++)spans+=themeCardSpan(count,at++,columns);assert.equal(spans,12);}
 }
 assert.deepEqual(balancedThemeRows(0,3),[]);
 assert.deepEqual(balancedThemeRows(5,3),[3,2]);assert.deepEqual(balancedThemeRows(4,3),[2,2]);
});
test('Canvas is a free plain white essential theme',()=>{
 const canvas=ESSENTIAL_THEMES.find(t=>t.id==='canvas')!;assert(canvas.free&&!canvas.premium&&!canvas.reviewOnly);
 assert.equal(canvas.canvas,'#FFFFFF');assert.equal(canvas.accent,'#171717');
});
test('Camden campaign and its palette remain unchanged',()=>{
 const before=execFileSync('git',['show','aa6928dec19a36e170c8cbce7f9b8d4337750388:components/storefront-directions/ZdxRefinedStorefronts.tsx'],{encoding:'utf8'});
 const after=readFileSync('components/storefront-directions/ZdxRefinedStorefronts.tsx','utf8');
 const campaign=(source:string)=>{const start=source.indexOf('export function Camden(');const end=source.indexOf('\nexport function ',start+1);return source.slice(start,end<0?undefined:end).trim();};
 assert.equal(campaign(after),campaign(before));
 const t=LONDON_SIGNATURE_THEMES.find(t=>t.id==='camden')!;assert.equal(t.canvas,'#F1F0EC');assert.equal(t.accent,'#C82F3D');
});
