import test from 'node:test';
import assert from 'node:assert/strict';
import {HAMMY_SAMPLE_PRODUCTS} from '../lib/hammy-pilot';
import {bagKey,moveHammySelection,readHammyShopping,HAMMY_BAG_KEY,HAMMY_SHOPPING_KEY} from '../lib/hammy-shopping';
const product=HAMMY_SAMPLE_PRODUCTS[0],line={productId:product.id,size:product.sizes[0],colour:product.colours[0],qty:2};
test('saving and restoring keeps product options and quantities without mutating either list',()=>{
  const bag=[line],saved:typeof bag=[];
  const moved=moveHammySelection(bag,saved,bagKey(line));assert.deepEqual(moved.from,[]);assert.deepEqual(moved.to,[line]);
  assert.deepEqual(bag,[line]);assert.deepEqual(saved,[]);
  const restored=moveHammySelection(moved.to,moved.from,bagKey(line));assert.deepEqual(restored.to,[line]);assert.deepEqual(restored.from,[]);
});
test('restore merges matching options and refuses overflow without discarding a saved selection',()=>{
  const saved=[line],bag=[{...line,qty:3}];const moved=moveHammySelection(saved,bag,bagKey(line));assert.equal(moved.to[0].qty,5);
  const full=[{...line,qty:10}];assert.throws(()=>moveHammySelection(saved,full,bagKey(line)),/limit/);
  assert.deepEqual(saved,[line]);assert.equal(full[0].qty,10);assert.throws(()=>moveHammySelection([],bag,'unknown'));
});
test('one stored snapshot validates both lists and rejects foreign-store/invalid selections',()=>{
  const state=readHammyShopping({bag:[line],saved:[{...line,price:0},{...line,productId:'default-store-product'},{...line,size:'invalid'}]});
  assert.deepEqual(state,{bag:[line],saved:[line]});assert.deepEqual(readHammyShopping(null),{bag:[],saved:[]});
  assert.notEqual(HAMMY_SHOPPING_KEY,HAMMY_BAG_KEY);assert(HAMMY_SHOPPING_KEY.includes('hammy'));
});
