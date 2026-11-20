import test from 'node:test';
import assert from 'node:assert/strict';
import {REFINED_PRODUCTS,refinedFilter,refinedChange,refinedTotals,refinedCompare,refinedPrice,type RefinedLine} from './zdx-refined-data';
test('grocery unit prices are explicit and basket totals avoid floating point drift',()=>{
 const items=REFINED_PRODUCTS['fresh-market'],plantain=items[0],rice=items.find(p=>p.id==='rice')!;
 assert.equal(refinedPrice(plantain,'NG')/plantain.pack!,450);
 assert.equal(refinedPrice(rice,'GB')/rice.pack!,1.9);
 let bag:RefinedLine[]=[];for(let i=0;i<3;i++)bag=refinedChange(items,bag,'plantain','',1);
 assert.deepEqual(refinedTotals(items,bag,'GB'),{count:3,total:6.6});
 assert.equal(refinedTotals(items,bag,'NG').total,5400);
 bag=refinedChange(items,bag,'plantain','',-3);assert.equal(bag.length,0);
});
test('editorial bag keeps chosen sizes on separate lines and rejects unchosen sizes',()=>{
 const items=REFINED_PRODUCTS['african-editorial'];let bag:RefinedLine[]=[];
 assert.deepEqual(refinedChange(items,bag,'wrap','',1),[]);
 bag=refinedChange(items,bag,'wrap','M',1);bag=refinedChange(items,bag,'wrap','L',1);bag=refinedChange(items,bag,'wrap','M',1);
 assert.equal(bag.length,2);assert.equal(bag.find(l=>l.variant==='M')?.quantity,2);
 bag=refinedChange(items,bag,'wrap','M',-2);assert.deepEqual(bag,[{id:'wrap',variant:'L',quantity:1}]);
 assert.deepEqual(refinedChange(items,bag,'wrap','INVALID',1),bag);
 assert.deepEqual(refinedChange(items,bag,'wrap','L',.5),bag);
});
test('equipment search matches SKU and specification while category and sort combine',()=>{
 const items=REFINED_PRODUCTS['spec-sheet'];
 assert.equal(refinedFilter(items,' INV-3K 48 ','All','edit','NG')[0].id,'inverter');
 assert.deepEqual(refinedFilter(items,'48 V','Lighting','edit','NG'),[]);
 assert.equal(refinedFilter(items,'','Batteries','low','GB')[0].id,'station');
 assert.equal(refinedFilter(items,'no_such_sample','All','edit','GB').length,0);
 assert.equal(items[0].id,'inverter');
});
test('comparison aligns different technical fields, deduplicates and limits to three',()=>{
 const items=REFINED_PRODUCTS['spec-sheet'];const result=refinedCompare(items,['inverter','inverter','battery','panel','station']);
 assert.equal(result.products.length,3);assert.deepEqual(result.products.map(p=>p.id),['inverter','battery','panel']);
 assert.deepEqual(result.rows.find(r=>r.key==='Capacity')?.values,['—','5120 Wh','—']);
 assert.deepEqual(result.rows.find(r=>r.key==='Certification')?.values,['Not supplied','Not supplied','Not supplied']);
});
test('Forma keeps a six-piece wardrobe with valid size-specific footwear lines',()=>{
 const items=REFINED_PRODUCTS['atelier-minimal'];assert.equal(items.length,6);
 assert.equal(refinedFilter(items,'','Accessories','edit','GB').length,2);
 const bag=refinedChange(items,[],'forma-loafer','EU 43',1);
 assert.equal(bag[0].variant,'EU 43');assert.equal(refinedTotals(items,bag,'NG').total,435000);
 assert.deepEqual(refinedChange(items,bag,'forma-loafer','EU 36',1),bag);
});
