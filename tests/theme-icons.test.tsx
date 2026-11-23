import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {renderToStaticMarkup} from 'react-dom/server';
import ThemeIcon from '../components/themes/ThemeIcon';

function renderers(dir:string):string[]{
 return readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
  if(entry.name==='source'||entry.name==='fonts')return [];
  const file=join(dir,entry.name);
  return entry.isDirectory()?renderers(file):/\.(tsx|jsx)$/.test(file)?[file]:[];
 });
}
test('active themes, desktop/mobile board ports and pilots have no text-glyph icons',()=>{
 const files=['components/themes','components/storefront-directions','components/pilots'].flatMap(renderers);
 assert(files.filter(file=>file.includes('/generated/')).length===12);
 for(const file of files){
  const source=readFileSync(file,'utf8');
  assert.doesNotMatch(source,/[←→↗✓✔☰−✳✕✖★☆♥♡]|\p{Emoji_Presentation}/u,file);
  assert.doesNotMatch(source,/Close ×|>×<|>[+]<(?:\/button)/,file);
  assert.doesNotMatch(source,/\b(?:fa-solid|fa-regular|material-icons|glyphicon)\b/,file);
 }
});
test('every shared theme icon renders accessible decorative SVG at the inherited text size',()=>{
 for(const name of ['left','right','external','check','menu','minus','plus','sparkle','close'] as const){
  const html=renderToStaticMarkup(<ThemeIcon name={name}/>);
  assert.match(html,/<svg/);assert.match(html,/aria-hidden="true"/);assert.match(html,/focusable="false"/);
  assert.match(html,/width="1em"/);assert.match(html,/stroke="currentColor"/);
 }
 const html=renderToStaticMarkup(<button aria-label="Increase quantity"><ThemeIcon name="plus"/></button>);
 assert.match(html,/aria-label="Increase quantity"/);
});
test('math and currency remain ordinary product content',()=>{
 const dimensions=readFileSync('components/themes/ThemeDemo.tsx','utf8');
 assert.match(dimensions,/\{w\} × \{h\}/);
 const specs=readFileSync('components/storefront-directions/generated/spec-desktop.jsx','utf8');
 assert.match(specs,/2 × MPPT/);assert.match(specs,/480 × 430 × 180 mm/);
 const market=readFileSync('components/storefront-directions/generated/market-desktop.jsx','utf8');
 assert.match(market,/₦/);assert.match(market,/£/);assert.match(market,/40 × 36 cm/);
});
