import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {renderToStaticMarkup} from 'react-dom/server';
import {DEFAULT_STORE_PILOT,DEFAULT_STORE_SAMPLE_PRODUCTS} from '../lib/default-store-pilot';
import {HAMMY_PILOT,HAMMY_SAMPLE_PRODUCTS} from '../lib/hammy-pilot';
import {DEFAULT_STORE_BAG_KEY,readDefaultStoreBag,addDefaultStoreLine,updateDefaultStoreVariant,bagKey} from '../lib/default-store-shopping';
import {HAMMY_BAG_KEY,readHammyBag} from '../lib/hammy-shopping';
import {defaultStoreHref} from '../lib/default-store-navigation';
import DefaultStoreShop from '../components/pilots/DefaultStoreShop';
import {adminGroups} from '../components/admin/admin-navigation';
const product=DEFAULT_STORE_SAMPLE_PRODUCTS[0];
const line={productId:product.id,size:product.sizes[0],colour:product.colours[0],qty:1};
test('Default Store is independently named and does not share product objects or basket identity with Hammy',()=>{
 assert.equal(DEFAULT_STORE_PILOT.name,'Default Store');assert.equal(DEFAULT_STORE_PILOT.version,1);
 assert.notEqual(DEFAULT_STORE_PILOT,HAMMY_PILOT);assert.notEqual(DEFAULT_STORE_PILOT.colours,HAMMY_PILOT.colours);
 assert.notEqual(DEFAULT_STORE_SAMPLE_PRODUCTS[0],HAMMY_SAMPLE_PRODUCTS[0]);assert.notEqual(product.images,HAMMY_SAMPLE_PRODUCTS[0].images);
 assert.notEqual(DEFAULT_STORE_BAG_KEY,HAMMY_BAG_KEY);
 assert(DEFAULT_STORE_SAMPLE_PRODUCTS.every(item=>!HAMMY_SAMPLE_PRODUCTS.some(hammy=>hammy.id===item.id)));
 const hammy={...line,productId:HAMMY_SAMPLE_PRODUCTS[0].id};
 assert.deepEqual(readDefaultStoreBag([hammy]),[]);assert.deepEqual(readHammyBag([line]),[]);
});
test('Default Store retains its own navigation and shopping flow',()=>{
 const home=renderToStaticMarkup(<DefaultStoreShop route={{view:'home'}}/>);
 assert.match(home,/DEFAULT STORE · VERSION 1/);assert.match(home,/START WITH YOUR DAY/);assert.match(home,/Everyday essentials/);assert.doesNotMatch(home,/\/pilots\/hammy|HAMMY/);
 const productHtml=renderToStaticMarkup(<DefaultStoreShop route={{view:'product',product:product.id}}/>);
 assert.match(productHtml,/Add to basket/);assert.match(productHtml,/Product image gallery/);
 const url=defaultStoreHref('product','Women',product.id,{query:'denim',size:'M'});assert.match(url,/\/pilots\/default\/preview\?/);assert.match(url,/q=denim/);
 const bag=addDefaultStoreLine([],line);const changed=updateDefaultStoreVariant(bag,bagKey(line),product.sizes[1],line.colour);assert.equal(changed[0].size,product.sizes[1]);assert.equal(bag[0].size,line.size);
});
test('the dashboard opens Default Store and both design routes exist independently',()=>{
 const entry=adminGroups.flatMap(group=>[...group.items]).find(item=>item.title==='Store Templates');
 assert.equal(entry?.href,'/admin/pilots/default');
 for(const name of ['default','hammy'])for(const suffix of ['','/demo','/preview'])assert(existsSync(`app/admin/pilots/${name}${suffix}/page.tsx`));
 for(const file of ['components/pilots/DefaultStoreShop.tsx','lib/default-store-pilot.ts','lib/default-store-navigation.ts','lib/default-store-shopping.ts']){
  assert.doesNotMatch(readFileSync(file,'utf8'),/from ['"][^'"]*hammy|require\(['"][^'"]*hammy/);
 }
 const workspace=readFileSync('components/admin/AdminWorkspace.tsx','utf8');assert.match(workspace,/\/pilots\/default\/preview/);assert.match(workspace,/\/pilots\/default\/demo/);
});
