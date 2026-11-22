import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import {HAMMY_SALES_BUILD_ORDER} from '../lib/hammy-sales-roadmap';
import HammyShop,{HammyQuickView} from '../components/pilots/HammyShop';
import {hammyShoppingFlow,initialHammyShoppingFlow} from '../lib/hammy-shopping-flow';
import {HAMMY_SAMPLE_PRODUCTS} from '../lib/hammy-pilot';
const product=HAMMY_SAMPLE_PRODUCTS[0],line={productId:product.id,size:product.sizes[0],colour:product.colours[0],qty:1};
test('adding from quick view closes it and confirms without opening the basket',()=>{
 const quick=hammyShoppingFlow(initialHammyShoppingFlow,{type:'quick-view',productId:product.id});assert.equal(quick.quickProductId,product.id);assert.equal(quick.basketOpen,false);
 const added=hammyShoppingFlow(quick,{type:'add-success',line});assert.equal(added.quickProductId,null);assert.equal(added.basketOpen,false);assert.deepEqual(added.receipt,line);
 const dismissed=hammyShoppingFlow(added,{type:'dismiss-receipt'});assert.equal(dismissed.receipt,null);assert.equal(dismissed.basketOpen,false);
});
test('the basket only opens on an explicit request and route changes clear overlays',()=>{
 const added=hammyShoppingFlow(initialHammyShoppingFlow,{type:'add-success',line});
 const opened=hammyShoppingFlow(added,{type:'open-basket'});assert.equal(opened.basketOpen,true);assert.equal(opened.receipt,null);assert.equal(opened.quickProductId,null);
 assert.deepEqual(hammyShoppingFlow(opened,{type:'route-change'}),initialHammyShoppingFlow);
 const closed=hammyShoppingFlow(hammyShoppingFlow(initialHammyShoppingFlow,{type:'quick-view',productId:product.id}),{type:'close-quick'});assert.equal(closed.quickProductId,null);assert.equal(closed.basketOpen,false);
});
test('quick view includes specifications, option selection and a context-preserving full-details link',()=>{
 const html=renderToStaticMarkup(<HammyQuickView product={product} ready adding={false} onAdd={()=>({ok:true})} onClose={()=>{}} department="Women" filters={{query:'denim',size:'M'}}/>);
 assert.match(html,/role="dialog"/);assert.match(html,/aria-modal="true"/);assert.match(html,/Product specifications/);assert.match(html,/garment measurements/);assert.match(html,/Add to basket/);assert.match(html,/Keep shopping/);
 assert.match(html,/view=product&amp;department=Women&amp;product=hammy-demo-women-denim&amp;q=denim&amp;size=M/);
 const collection=renderToStaticMarkup(<HammyShop route={{view:'collection',department:'Women'}}/>);assert.match(collection,/aria-label="Quick view Everyday denim edit"/);assert.match(collection,/aria-haspopup="dialog"/);
});
test('sales-growth phases follow the agreed dependency order without treating planned phases as connected',()=>{
 assert.deepEqual(HAMMY_SALES_BUILD_ORDER.map(item=>item.id),['identity','checkout','recovery','bundles','service']);
 const prior=new Set<string>();for(const phase of HAMMY_SALES_BUILD_ORDER){for(const dependency of phase.requires)assert(prior.has(dependency));assert(phase.checks.length>0);prior.add(phase.id);}
});

test('quick view offers specifications, options and a full-product link without a basket detour',()=>{
 const html=renderToStaticMarkup(<HammyQuickView product={product} ready adding={false} onAdd={()=>({ok:true})} onClose={()=>{}} department="Women" filters={{query:'denim',sort:'low'}}/>);
 assert.match(html,/role="dialog"/);assert.match(html,/Product specifications/);assert.match(html,/Fabric composition, garment measurements and care instructions have not been provided/);
 assert.match(html,/Choose size|Size/);assert.match(html,/Add to basket/);assert.match(html,/Keep shopping/);assert.match(html,/Full product details/);
 assert.match(html,/product=hammy-demo-women-denim&amp;q=denim&amp;sort=low/);assert.doesNotMatch(html,/Review full basket|Your basket/);
});
test('the sales roadmap keeps identity and real checkout ahead of growth automation',()=>{
 assert.deepEqual(HAMMY_SALES_BUILD_ORDER.map(phase=>phase.id),['identity','checkout','recovery','bundles','service']);
 const before=new Set<string>();for(const phase of HAMMY_SALES_BUILD_ORDER){assert(phase.requires.every(id=>before.has(id)));before.add(phase.id);}
});

test('optional shopping details stay collapsed while primary choices remain available',()=>{
 const collection=renderToStaticMarkup(<HammyShop route={{view:'collection'}}/>);
 const disclosures=[...collection.matchAll(/<details([^>]*)>/g)];
 assert(disclosures.length>=2);for(const disclosure of disclosures)assert.doesNotMatch(disclosure[1],/\bopen(?:=|\s|$)/);
 assert.match(collection,/Find a style/);assert.match(collection,/Choose options/);assert.match(collection,/Checkout unavailable/);
 assert.doesNotMatch(collection,/About this pilot|Refine your selection|No order, stock reservation/);
 const quick=renderToStaticMarkup(<HammyQuickView product={product} ready adding={false} onAdd={()=>({ok:true})} onClose={()=>{}} filters={{}}/>);
 assert.doesNotMatch(quick,/<details[^>]*\bopen(?:=|\s|>)/);assert.match(quick,/Size/);assert.match(quick,/Colour/);assert.match(quick,/Add to basket/);
 assert.doesNotMatch(quick,/Sample sizes|Sample colours|Explore the fit/);
});
