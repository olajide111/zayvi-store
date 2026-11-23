import test from 'node:test';
import assert from 'node:assert/strict';
import {createOrderSearchHandoff,matchesOrderEmail} from '../lib/order-search-handoff';
test('customer search intent is normalised, single use and expires after one minute',()=>{
  let now=1000;const handoff=createOrderSearchHandoff(()=>now);
  assert.equal(handoff.prepare(' Ada@Example.test '),true);assert.equal(handoff.take(),'ada@example.test');assert.equal(handoff.take(),null);
  handoff.prepare('ada@example.test');now+=60000;assert.equal(handoff.take(),null);
});
test('new or invalid selections replace the prior intent and clearing removes it',()=>{
  const handoff=createOrderSearchHandoff();handoff.prepare('ada@example.test');handoff.prepare('bola@example.test');assert.equal(handoff.take(),'bola@example.test');
  handoff.prepare('ada@example.test');assert.equal(handoff.prepare('invalid'),false);assert.equal(handoff.take(),null);
  handoff.prepare('ada@example.test');handoff.clear();assert.equal(handoff.take(),null);
});
test('customer handoff uses full email equality rather than substring or customer-name matching',()=>{
  assert.equal(matchesOrderEmail(' ADA@example.test ','ada@EXAMPLE.test'),true);
  assert.equal(matchesOrderEmail('notada@example.test','ada@example.test'),false);
  assert.equal(matchesOrderEmail('ada@example.test.extra','ada@example.test'),false);
});
