import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import {ALL_STUDIO_THEMES,ORIGINAL_THEME} from '../lib/theme-registry';
import {validateStoreSetup} from '../lib/store-setup';
import {validateThemeDraft} from '../lib/theme-draft';
import {themePreviewEngine} from '../lib/theme-preview-engine';
import ThemedShop from '../components/themes/ThemedShop';
import OriginalThemeHome from '../components/themes/OriginalThemeHome';

test('Original remains an optional free theme without being the first choice',()=>{
 assert.notEqual(ALL_STUDIO_THEMES[0].id,'original');assert.equal(ORIGINAL_THEME.free,true);assert(!ORIGINAL_THEME.premium);
 const setup=validateStoreSetup({name:'My shop',industry:'General retail',otherIndustry:'',style:'Either',themeId:'original'});
 assert.equal(setup.themeId,'original');
 assert.equal(validateThemeDraft({themeId:'original',baseVersion:0,draft:{brand:'My shop',headline:'My collection',font:'sans',palette:'theme',motion:'off',colours:setup.appearance!.colours}}).theme.id,'original');
 for(const source of ['demo','store'])assert.equal(themePreviewEngine(ORIGINAL_THEME,source),'catalogue');
});
test('Original has a distinctive demo and uses its own categories and explicit prices',()=>{
 const html=renderToStaticMarkup(<ThemedShop theme={ORIGINAL_THEME} brand="My shop" headline="My own collection" font="sans" motion="off" palette="theme" view="home" source="demo"/>);
 assert.match(html,/My own collection/);assert.match(html,/A good place to start/);assert.match(html,/The current edit/);assert.match(html,/DEMO STORE/);assert.match(html,/NO ORDERS OR PAYMENTS/);assert.doesNotMatch(html,/A NEW PERSPECTIVE/);
 const real=renderToStaticMarkup(<OriginalThemeHome products={[{id:'ng-one',name:'Woven bag',image:'',price:3500,currency:'NGN',category:'Handmade',description:''}]} headline="" onOpen={()=>{}} onAdd={()=>{}} onBrowse={()=>{}}/>);
 assert.match(real,/Woven bag/);assert.match(real,/Handmade/);assert.match(real,/3,500.00/);assert.doesNotMatch(real,/Technology|Travel/);
});
