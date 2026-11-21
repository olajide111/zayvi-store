import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import {HAMMY_SAMPLE_PRODUCTS,HAMMY_PILOT} from '../lib/hammy-pilot';
import {addHammyLine,bagKey,readHammyBag,hammyGallery} from '../lib/hammy-shopping';
import HammyShop from '../components/pilots/HammyShop';
const product=HAMMY_SAMPLE_PRODUCTS[0];
const line={productId:product.id,size:product.sizes[0],colour:product.colours[0],qty:1};
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
 assert.match(collection,/Activewear edit/);assert.match(collection,/Choose size &amp; colour/);
 const women=renderToStaticMarkup(<HammyShop route={{view:'collection',department:'Women'}}/>);assert.match(women,/Activewear edit/);assert.doesNotMatch(women,/Training essentials/);assert.doesNotMatch(collection,/Everyday denim edit/);
 const missing=renderToStaticMarkup(<HammyShop route={{view:'product',product:'not-found'}}/>);
 assert.match(missing,/Product not found/);assert.doesNotMatch(missing,/Add to basket/);
});
