import test from 'node:test';
import assert from 'node:assert/strict';
import {themeCatalogue} from '../lib/theme-catalogue';
const product={id:'real',name:'Real product',price:3500,currency:'NGN',marketCode:'NG',image:'/products/real.jpg'};
const payload=(products:unknown[])=>({market:'NG',currency:'NGN',products});
test('catalogue retains explicit market prices and relative images',()=>{
 const p=themeCatalogue(payload([product]))[0];assert.equal(p.price,3500);assert.equal(p.currency,'NGN');assert.equal(p.image,product.image);
});
test('missing or unsafe images do not remove genuine products',()=>{
 for(const image of ['',null,'javascript:alert(1)','//external.example/image'])assert.equal(themeCatalogue(payload([{...product,image}]))[0].image,'');
});
test('mismatched markets, currencies and invalid prices are excluded without conversion',()=>{
 assert.deepEqual(themeCatalogue(payload([{...product,currency:'GBP'},{...product,marketCode:'GB'},{...product,price:-1},{...product,price:'3500'}])),[]);
 assert.throws(()=>themeCatalogue({market:'NG',currency:'GBP',products:[product]}));
 assert.throws(()=>themeCatalogue({products:[product]}));
 assert.deepEqual(themeCatalogue(payload([])),[]);
});
