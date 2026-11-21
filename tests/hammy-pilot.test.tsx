import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import {HAMMY_PILOT,HAMMY_THEME,HAMMY_SAMPLE_PRODUCTS} from '../lib/hammy-pilot';
import ThemedShop from '../components/themes/ThemedShop';
import ThemeDemo from '../components/themes/ThemeDemo';
import Preview from '../app/admin/pilots/hammy/preview/page';
const props={theme:HAMMY_THEME,brand:HAMMY_PILOT.name,headline:HAMMY_PILOT.headline,font:'serif',palette:'custom',colourInput:HAMMY_PILOT.colours,motion:'subtle',view:'home',sampleProducts:HAMMY_SAMPLE_PRODUCTS};
test('Hammy has its own general-fashion brief and a category-appropriate optional theme',()=>{
 assert.equal(HAMMY_PILOT.name,'Hammy Store');assert.equal(HAMMY_PILOT.industry,'General fashion');
 assert.equal(HAMMY_THEME.id,'atelier');assert.equal(HAMMY_THEME.premium,undefined);
 assert.deepEqual([...new Set(HAMMY_SAMPLE_PRODUCTS.map(product=>product.category))],HAMMY_PILOT.departments);
 assert(HAMMY_SAMPLE_PRODUCTS.every(product=>product.id.startsWith('hammy-demo-')&&product.currency==='GBP'));
});
test('sample catalogue is isolated from store mode, which still loads authoritative products',()=>{
 const demo=renderToStaticMarkup(<ThemedShop {...props} source="demo"/>);
 assert.match(demo,/Hammy Store/);assert.match(demo,/Baby/);assert.match(demo,/SAMPLE PRODUCTS/);assert.match(demo,/NO ORDERS OR PAYMENTS/);
 const store=renderToStaticMarkup(<ThemedShop {...props} source="store"/>);
 assert.match(store,/Loading your store/);assert.doesNotMatch(store,/Everyday denim edit|Baby soft essentials/);
});
test('department navigation filters only the pilot sample collection and rejects unknown departments',async()=>{
 const page=await Preview({searchParams:Promise.resolve({department:'Kids'})});
 const html=renderToStaticMarkup(page);
 assert.match(html,/Kids’ summer edit/);assert.doesNotMatch(html,/Everyday denim edit/);
 assert.match(html,/DESIGN PREVIEW/);
 const unknown=renderToStaticMarkup(await Preview({searchParams:Promise.resolve({department:'invalid'})}));
 assert.match(unknown,/Your style/);
});
test('pilot device frames use pilot routes and do not offer a save into the current store',()=>{
 const html=renderToStaticMarkup(<ThemeDemo theme={HAMMY_THEME} query="" title="Hammy Store · Atelier" previewPath="/admin/pilots/hammy/preview" backHref="/admin/pilots/hammy" backLabel="Hammy Store" studioHref={null}/>);
 assert.match(html,/\/admin\/pilots\/hammy\/preview/);assert.match(html,/Phone/);assert.match(html,/Tablet/);assert.doesNotMatch(html,/Open design studio/);
});
