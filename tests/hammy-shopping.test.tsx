import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import {HAMMY_SAMPLE_PRODUCTS,HAMMY_PILOT} from '../lib/hammy-pilot';
import {addHammyLine,bagKey,readHammyBag,hammyGallery,filterHammyProducts,relatedHammyProducts,updateHammyVariant} from '../lib/hammy-shopping';
import {hammyHref,readHammyFilters,hammyFiltersFromSearchParams} from '../lib/hammy-navigation';
import Preview from '../app/admin/pilots/hammy/preview/page';
import HammyShop,{HammyBasketItem} from '../components/pilots/HammyShop';
const product=HAMMY_SAMPLE_PRODUCTS[0];
const line={productId:product.id,size:product.sizes[0],colour:product.colours[0],qty:1};
test('basket selections expose a named save-for-later action without removing option editing',()=>{
 const html=renderToStaticMarkup(<HammyBasketItem line={line} product={product} productHref="/product" onNavigate={()=>{}} onChange={()=>{}} onRemove={()=>{}} onEdit={()=>undefined} onSave={()=>{}}/>);
 assert.match(html,/Save for later/);assert(html.includes(`aria-label="Save ${product.name}, ${line.size}, ${line.colour} for later"`));assert.match(html,/Edit options/);
});
test('basket merges only identical product/size/colour combinations',()=>{
 const one=addHammyLine([],line),two=addHammyLine(one,line);
 assert.equal(one[0].qty,1);assert.equal(two[0].qty,2);
 const different=addHammyLine(two,{...line,size:product.sizes[1]});
 assert.equal(different.length,2);assert.notEqual(bagKey(different[0]),bagKey(different[1]));
 assert.throws(()=>addHammyLine([],{...line,size:''}),/Choose/);
 assert.throws(()=>addHammyLine([{...line,qty:10}],line),/limit/);
});
test('stored basket rejects old-store products, invalid variants and browser-supplied totals',()=>{
 const restored=readHammyBag([{...line,price:0,total:0},{...line,productId:'old-zayvi-product'},{...line,size:'unknown'},{...line,qty:100},{...line,qty:1.5}]);
 assert.deepEqual(restored,[line]);assert.deepEqual(readHammyBag({lines:[line]}),[]);
});
test('image galleries allow twenty distinct pictures and remove unsafe or duplicate URLs',()=>{
 const images=Array.from({length:24},(_,index)=>`/images/item-${index}.webp`);
 assert.equal(hammyGallery(images).length,20);
 assert.deepEqual(hammyGallery(['/image.webp','/image.webp','javascript:alert(1)','//other/image.webp','https://images.example/photo.webp']),['/image.webp','https://images.example/photo.webp']);
});
test('all eight fashion departments have sample products, with sportswear and footwear included',()=>{
 assert.equal(HAMMY_PILOT.departments.length,8);
 for(const department of HAMMY_PILOT.departments)assert(HAMMY_SAMPLE_PRODUCTS.some(item=>item.category===department));
 assert(HAMMY_SAMPLE_PRODUCTS.length>=14);
});
test('product flow presents a gallery and required options, while cards open choices rather than adding silently',()=>{
 const html=renderToStaticMarkup(<HammyShop route={{view:'product',product:product.id}}/>);
 assert.match(html,/Product image gallery/);assert.match(html,/Size/);assert.match(html,/required/);assert.match(html,/Colour/);assert.match(html,/Add to basket/);assert.match(html,/Delivery &amp; returns/);
 const collection=renderToStaticMarkup(<HammyShop route={{view:'collection',department:'Sportswear'}}/>);
 assert.match(collection,/Activewear edit/);assert.match(collection,/Choose options/);
 const women=renderToStaticMarkup(<HammyShop route={{view:'collection',department:'Women'}}/>);assert.match(women,/Activewear edit/);assert.doesNotMatch(women,/Training essentials/);assert.doesNotMatch(collection,/Everyday denim edit/);
 const missing=renderToStaticMarkup(<HammyShop route={{view:'product',product:'not-found'}}/>);
 assert.match(missing,/Product not found/);assert.doesNotMatch(missing,/Add to basket/);
});

test('collection refinements intersect department, size, colour and budget without mutating the catalogue',()=>{
 const before=HAMMY_SAMPLE_PRODUCTS.map(item=>item.id);
 const women=filterHammyProducts(HAMMY_SAMPLE_PRODUCTS,'Women',{size:'M',colour:'Black',budget:'under50',sort:'low'});
 assert(women.length>0);assert(women.every(item=>(item.category==='Women'||item.department==='Women')&&item.sizes.includes('M')&&item.colours.includes('Black')&&item.price<=50));
 assert.deepEqual(women.map(item=>item.price),women.map(item=>item.price).sort((a,b)=>a-b));
 assert.deepEqual(filterHammyProducts(HAMMY_SAMPLE_PRODUCTS,'Baby',{size:'UK 9'}),[]);
 assert.deepEqual(filterHammyProducts(HAMMY_SAMPLE_PRODUCTS,undefined,{query:'  RUNNING  '}).map(item=>item.id),['hammy-demo-trainers']);
 assert.deepEqual(HAMMY_SAMPLE_PRODUCTS.map(item=>item.id),before);
});
test('related styles prioritise the same department, exclude the current product and stay bounded',()=>{
 const related=relatedHammyProducts(product);
 assert.equal(related.length,4);assert(related.every(item=>item.id!==product.id));assert.equal(related[0].category,product.category);assert.equal(new Set(related.map(item=>item.id)).size,4);
 const html=renderToStaticMarkup(<HammyShop route={{view:'product',product:product.id}}/>);
 assert.match(html,/Next product image/);assert.match(html,/Previous product image/);assert.match(html,/More styles to explore/);
 const collection=renderToStaticMarkup(<HammyShop route={{view:'collection',department:'Baby'}}/>);
 assert.match(collection,/Filters/);assert.match(collection,/All sizes/);assert.match(collection,/0–3 months/);assert.doesNotMatch(collection,/UK 9/);
});

test('Hammy home has distinct editorial departments and sports/footwear routes without enabling checkout',()=>{
 const home=renderToStaticMarkup(<HammyShop route={{view:'home'}}/>);
 assert.match(home,/Every kind/);assert.match(home,/Made to/);
 assert.match(home,/Shop sportswear/);assert.match(home,/Find your footwear/);
 assert.match(home,/aria-label="Footer shop"/);assert.match(home,/aria-label="Footer customer care"/);assert.match(home,/Checkout unavailable/);
 assert.match(home,/loading="eager"/);
});

test('basket option edits preserve quantities and merge matching variants only',()=>{
 const other={...line,size:product.sizes[1],qty:3};
 const bag=[{...line,qty:2},other];
 const updated=updateHammyVariant(bag,bagKey(line),other.size,other.colour);
 assert.deepEqual(updated,[{...other,qty:5}]);assert.equal(bag.length,2);assert.equal(bag[0].qty,2);
 const separate=updateHammyVariant([line],bagKey(line),other.size,other.colour);
 assert.deepEqual(separate,[{...line,size:other.size}]);
 assert.equal(updateHammyVariant(bag,bagKey(line),line.size,line.colour),bag);
});
test('invalid basket edits or over-limit merges preserve the existing basket for correction',()=>{
 const bag=[{...line,qty:9},{...line,size:product.sizes[1],qty:2}];
 assert.throws(()=>updateHammyVariant(bag,bagKey(line),product.sizes[1],line.colour),/limit/);
 assert.throws(()=>updateHammyVariant(bag,bagKey(line),'invalid',line.colour),/Choose/);
 assert.throws(()=>updateHammyVariant(bag,'missing',line.size,line.colour),/no longer/);
 assert.equal(bag[0].qty,9);assert.equal(bag[1].qty,2);
 const restored=addHammyLine([line],{...line,qty:2});assert.equal(restored[0].qty,3);
 assert.throws(()=>addHammyLine([{...line,qty:10}],line),/limit/);
});
test('basket items expose named editing/removal and disable decrement at one',()=>{
 const html=renderToStaticMarkup(<HammyBasketItem line={line} product={product} productHref="/sample-product" onNavigate={()=>{}} onChange={()=>{}} onRemove={()=>{}} onEdit={()=>undefined}/>);
 assert.match(html,/Edit size and colour for/);assert.match(html,/Edit options/);assert.match(html,/Remove Everyday denim edit/);assert.match(html,/disabled="" aria-label="Decrease/);assert.match(html,/Quantity for/);
});

test('collection URL filters round-trip through product and basket links with safe encoding',()=>{
 const filters={query:'denim & layers',size:'M',colour:'Black',sort:'low',budget:'under50'};
 for(const view of ['product','bag','collection'] as const){
  const url=new URL(hammyHref(view,'Women',view==='product'?product.id:undefined,filters),'https://example.test');
  assert.deepEqual(readHammyFilters(Object.fromEntries(url.searchParams),'Women'),filters);
  assert.equal(url.pathname,'/admin/pilots/hammy/preview');assert.equal(url.searchParams.get('view'),view);
 }
 assert.equal(readHammyFilters({q:'cotton '}).query,'cotton ');
});
test('URL filters reject repeated/unknown options and bound free text',()=>{
 const values=readHammyFilters({q:'a'.repeat(1000),size:'UK 9',colour:'unknown',budget:'free',sort:['high','low']},'Baby');
 assert.equal(hammyFiltersFromSearchParams(new URLSearchParams('q=one&q=two&sort=high&sort=low')).query,'');assert.equal(hammyFiltersFromSearchParams(new URLSearchParams('sort=high&sort=low')).sort,'featured');
 assert.equal(values.query?.length,80);assert.equal(values.size,'');assert.equal(values.colour,'');assert.equal(values.budget,'');assert.equal(values.sort,'featured');
 assert.equal(new URL(hammyHref('collection','invalid'), 'https://example.test').searchParams.has('department'),false);
});
test('filtered pages render their initial selection and product return links retain it',async()=>{
 const filters={query:'denim',size:'M',colour:'Black',sort:'low',budget:'under50'};
 const html=renderToStaticMarkup(await Preview({searchParams:Promise.resolve({view:'collection',department:'Women',q:'denim',size:'M',colour:'Black',sort:'low',budget:'under50'})}));
 assert.match(html,/Active filters/);assert.match(html,/Remove Search: denim filter/);assert.match(html,/1 styles/);assert.doesNotMatch(html,/Occasionwear edit/);
 const productHtml=renderToStaticMarkup(<HammyShop route={{view:'product',product:product.id,department:'Women',filters}}/>);
 assert.match(productHtml,/view=collection&amp;department=Women&amp;q=denim&amp;size=M&amp;colour=Black&amp;sort=low&amp;budget=under50/);
});
