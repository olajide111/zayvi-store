import test from 'node:test';
import assert from 'node:assert/strict';
import {readOrderRouteFilters,orderFiltersHref,EMPTY_ORDER_FILTERS} from '../lib/order-filter-navigation';
test('order queues and status filters survive links and reloads',()=>{
 const filters={...EMPTY_ORDER_FILTERS,queue:'review' as const,payment:'paid',fulfilment:'unfulfilled',currency:'NGN'};
 const href=orderFiltersHref(filters);assert.equal(href,'/admin/orders?queue=review&payment=paid&fulfilment=unfulfilled&currency=NGN');
 assert.deepEqual(readOrderRouteFilters(new URL(href,'https://preview.zayvi.store').searchParams),filters);
 assert.equal(orderFiltersHref(EMPTY_ORDER_FILTERS),'/admin/orders');
});
test('malformed/repeated filters and customer searches do not enter shareable workflow links',()=>{
 assert.deepEqual(readOrderRouteFilters(new URLSearchParams('queue=owner&payment=paid&payment=failed&currency=USD&q=customer@example.com')),EMPTY_ORDER_FILTERS);
 const input={payment:'failed',query:'customer@example.com',tenantId:'untrusted'};
 assert.equal(orderFiltersHref(input),'/admin/orders?payment=failed');
});
test('sales follow-up links decode into an actionable order view',()=>{
 const query=new URLSearchParams('queue=review&payment=paid&fulfilment=unfulfilled');
 const filters=readOrderRouteFilters(query);assert.equal(filters.queue,'review');assert.equal(filters.payment,'paid');assert.equal(filters.fulfilment,'unfulfilled');
});
