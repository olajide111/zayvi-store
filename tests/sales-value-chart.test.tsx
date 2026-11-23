import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import SalesValueChart from '../components/admin/SalesValueChart';
import type {AnalyticsReport} from '../lib/analytics-report';
const report:AnalyticsReport={schemaVersion:2,source:'postgresql',generatedAt:'2026-11-23T12:00:00Z',scope:'existing_commerce_workspace',
  trendFrom:'2026-11-21T00:00:00Z',period:{from:'2026-11-21T00:00:00Z',to:'2026-11-23T12:00:00Z',timezone:'UTC'},filters:{range:'7d',market:'all'},
  orders:{total:3,paid:3,pending:0,unpaid:0,failed:0,partiallyRefunded:0,refunded:0,awaitingFulfilment:3,cancelled:0},previous:null,recentOrders:[],
  measurement:{basis:'Current order status',paidValue:'Currently paid orders',refunds:'Order values',trafficAvailable:false,campaignAttributionAvailable:false,profitAvailable:false},
  markets:[{marketCode:'GB',currency:'GBP',orderCount:2,paidOrders:2,paidValue:120,refundedOrderValue:0,paidAverageOrderValue:60},
    {marketCode:'NG',currency:'NGN',orderCount:1,paidOrders:1,paidValue:5000,refundedOrderValue:0,paidAverageOrderValue:5000}],daily:[
    {day:'2026-11-21',marketCode:'GB',currency:'GBP',orderCount:2,paidOrders:2,paidValue:120},
    {day:'2026-11-21',marketCode:'NG',currency:'NGN',orderCount:1,paidOrders:1,paidValue:5000},
  ]};
test('sales chart starts with one currency and provides exact day controls plus a table',()=>{
  const html=renderToStaticMarkup(<SalesValueChart data={report}/>);
  assert.match(html,/Sales value over time/);assert.match(html,/£120\.00/);assert.doesNotMatch(html,/£5,120|₦5,000/);
  assert.match(html,/Sales chart market and currency/);assert.match(html,/type="range"/);assert.match(html,/View sales figures/);
  assert.match(html,/not net revenue or profit/);
});
test('no order records produce an honest empty state rather than a synthetic sales graph',()=>{
  const html=renderToStaticMarkup(<SalesValueChart data={{...report,markets:[],daily:[]}}/>);
  assert.match(html,/No recorded orders/);assert.doesNotMatch(html,/<svg|type="range"/);
});
