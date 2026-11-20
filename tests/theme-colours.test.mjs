import {test} from 'node:test';
import assert from 'node:assert/strict';
import {hexColour,customColours,contrastRatio,buttonTextColour} from '../lib/theme-colours.ts';
const fallback={canvas:'#ffffff',ink:'#111111',accent:'#223344',accentInk:'#ffffff'};
test('only complete hex colours can reach CSS variables',()=>{
 for(const input of ['red','#fff','url(https://example.com)',';display:none',null,{},123,'#12345678'])assert.equal(hexColour(input,'fallback'),'fallback');
 assert.equal(hexColour('#AbCdEf','fallback'),'#abcdef');
});
test('invalid saved palettes fall back field by field',()=>{
 assert.deepEqual(customColours({canvas:'transparent',ink:null,accent:'#ffffff'},fallback),{canvas:'#ffffff',ink:'#111111',accent:'#ffffff',accentInk:'#111111'});
 assert.equal(customColours(null,fallback).canvas,'#ffffff');
});
test('contrast has known reference values and is symmetric',()=>{
 assert.equal(contrastRatio('#000000','#ffffff'),21);
 assert.equal(contrastRatio('#ffffff','#ffffff'),1);
 assert.equal(contrastRatio('#123456','#abcdef'),contrastRatio('#abcdef','#123456'));
});
test('button text selects the higher contrast foreground',()=>{
 assert.equal(buttonTextColour('#ffffff'),'#111111');assert.equal(buttonTextColour('#000000'),'#ffffff');
 for(const accent of ['#ff0000','#00ff00','#0000ff','#837aaa']){const picked=buttonTextColour(accent);const other=picked==='#ffffff'?'#111111':'#ffffff';assert(contrastRatio(accent,picked)>=contrastRatio(accent,other));}
});
