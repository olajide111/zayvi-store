import test from 'node:test';
import assert from 'node:assert/strict';
import {orderQueue,orderNextAction} from '../lib/order-work-queue';
test('paid orders need review while unpaid and refunded orders never suggest dispatch',()=>{
 const base={paymentStatus:'paid',fulfilmentStatus:'unfulfilled',orderStatus:'confirmed'};
 assert.equal(orderQueue(base),'review');assert.equal(orderNextAction(base).title,'Review fulfilment');
 assert.equal(orderQueue({...base,paymentStatus:'pending'}),'payment');
 assert.equal(orderNextAction({...base,paymentStatus:'refunded'}).title,'Review refund');
 assert.equal(orderQueue({...base,orderStatus:'cancelled'}),'closed');
 assert.equal(orderNextAction({...base,orderStatus:'cancelled'}).title,'View cancellation');
 assert.equal(orderQueue({...base,fulfilmentStatus:'fulfilled'}),'closed');
});
import {BUSINESS_TYPES,themeFitsIndustry} from '../lib/theme-studio';
test('own-production categories have theme recommendations',()=>{
 assert.ok(BUSINESS_TYPES.includes('Handmade & own production'));
 assert.equal(themeFitsIndustry({industries:['Art']},'Handmade & own production'),true);
 assert.equal(themeFitsIndustry({industries:['Trade']},'Manufacturing & own brand'),true);
});
