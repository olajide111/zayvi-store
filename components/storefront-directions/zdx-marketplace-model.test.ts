import test from 'node:test';
import assert from 'node:assert/strict';
import {marketProducts,changeMarketBag,marketBagSummary} from './zdx-marketplace-model';
const filters={query:'',department:'All',seller:'All',sort:'featured'};
test('market search combines words and matches sellers as well as products',()=>{
 assert.deepEqual(marketProducts({...filters,query:'  EKO tote '},'NG').map(p=>p.id),['s1']);
 assert.equal(marketProducts({...filters,query:'not-a-sample-product'},'NG').length,0);
 assert.equal(marketProducts({...filters,department:'Home',seller:'Brixton Beauty'},'GB').length,0);
});
test('sort uses explicit prices in the selected market without changing source order',()=>{
 assert.equal(marketProducts({...filters,sort:'low'},'NG')[0].id,'s4');
 assert.equal(marketProducts({...filters,sort:'high'},'GB')[0].id,'s5');
 assert.equal(marketProducts(filters,'NG')[0].id,'s1');
});
test('bag starts empty, merges quantities, groups sellers and reprices on market switch',()=>{
 let bag=changeMarketBag([], 's1',1);bag=changeMarketBag(bag,'s1',1);bag=changeMarketBag(bag,'s5',1);bag=changeMarketBag(bag,'s2',1);
 const ng=marketBagSummary(bag,'NG');assert.equal(ng.count,4);assert.equal(ng.groups.length,2);assert.equal(ng.groups[0][1].length,2);assert.equal(ng.total,205000);
 assert.equal(marketBagSummary(bag,'GB').total,122);
 bag=changeMarketBag(bag,'s1',-2);assert(!bag.some(l=>l.id==='s1'));assert.equal(marketBagSummary(bag,'NG').count,2);
 assert.deepEqual(changeMarketBag(bag,'unknown',1),bag);assert.deepEqual(changeMarketBag(bag,'s2',0.5),bag);
 assert.equal(marketBagSummary([{id:'unknown',quantity:1},{id:'s1',quantity:-2}],'NG').count,0);
});
