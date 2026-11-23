import test from 'node:test';
import assert from 'node:assert/strict';
import {selectCustomers,customerDate,customerSegment,type CustomerRecord} from '../lib/customer-workspace';
const rows:CustomerRecord[]=[
  {id:'one',name:'Ada',email:'ada@example.test',phone:'080123',status:'active',orderCount:3,createdAt:'2026-01-01',lastOrderAt:'2026-11-22'},
  {id:'two',name:'Bola',email:'bola@example.test',status:'blocked',orderCount:1,createdAt:'2026-02-01',lastOrderAt:'2026-11-20'},
  {id:'three',name:'Chidi',email:'chidi@example.test',status:'active',orderCount:0,createdAt:'2026-03-01'},
];
test('customer segments intersect search and account status without modifying records',()=>{
  assert.deepEqual(selectCustomers(rows,{segment:'repeat',status:'active',query:' ADA@EXAMPLE.TEST '}).map(c=>c.id),['one']);
  assert.deepEqual(selectCustomers(rows,{segment:'none'}).map(c=>c.id),['three']);assert.deepEqual(selectCustomers(rows,{query:'080123'}).map(c=>c.id),['one']);
  assert.equal(customerSegment(rows[1]),'single');assert.deepEqual(rows.map(c=>c.id),['one','two','three']);
});
test('sorting uses recorded activity with a creation-date fallback and handles absent dates',()=>{
  assert.deepEqual(selectCustomers([...rows].reverse(),{sort:'orders'}).map(c=>c.id),['one','two','three']);
  assert.deepEqual(selectCustomers(rows,{sort:'name'}).map(c=>c.id),['one','two','three']);
  assert.equal(customerDate(null),'Not recorded');assert.equal(customerDate('invalid'),'Not recorded');assert.equal(customerDate('2026-11-22'),'22 Nov 2026');
});
