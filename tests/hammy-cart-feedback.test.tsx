import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import {hammyFlightPath} from '../lib/hammy-cart-feedback';
import {HammyAddedConfirmation} from '../components/pilots/HammyShop';
import {HAMMY_SAMPLE_PRODUCTS} from '../lib/hammy-pilot';
import {addHammyLine} from '../lib/hammy-shopping';
import Integrations from '../app/admin/pilots/hammy/integrations/page';
test('cart thumbnail starts and ends within narrow phone and desktop viewports',()=>{
 for(const viewport of [{width:320,height:568},{width:390,height:844},{width:1440,height:900}]){
  const result=hammyFlightPath({left:-50,top:viewport.height+400,width:600,height:800},{left:viewport.width-30,top:0,width:90,height:44},viewport);
  for(const point of [result.from,result.to]){assert(point.x>=8);assert(point.x+104<=viewport.width-8);assert(point.y>=8);assert(point.y+124<=viewport.height-8);}
 }
});
test('add confirmation shows the actual chosen options, quantity and merged basket subtotal',()=>{
 const product=HAMMY_SAMPLE_PRODUCTS[0],line={productId:product.id,size:product.sizes[1],colour:product.colours[1],qty:2};
 const bag=addHammyLine(addHammyLine([],line),line),count=bag.reduce((n,item)=>n+item.qty,0);
 const html=renderToStaticMarkup(<HammyAddedConfirmation line={line} product={product} count={count} total={count*product.price}/>);
 assert.match(html,/Added to your basket/);assert.match(html,/S · Black/);assert.match(html,/Qty 2 · £90.00/);assert.match(html,/4 items/);assert.match(html,/£180.00/);assert.match(html,/role="status"/);
});
test('failed capacity validation leaves the previous basket available for correction',()=>{
 const product=HAMMY_SAMPLE_PRODUCTS[0],line={productId:product.id,size:product.sizes[0],colour:product.colours[0],qty:10},bag=[line];
 assert.throws(()=>addHammyLine(bag,{...line,qty:1}),/limit/);assert.deepEqual(bag,[line]);assert.equal(bag[0].qty,10);
});
test('Hammy integration review explicitly distinguishes its preview from connected selling services',()=>{
 const html=renderToStaticMarkup(<Integrations/>);
 assert.match(html,/selling integrations are not complete/);assert.match(html,/not a live database or provider health check/);
 assert.match(html,/Not connected/);assert.match(html,/Hammy connection pending/);assert.match(html,/Checkout disabled/);
 assert.match(html,/sample products/);assert.match(html,/browser session/);
});
