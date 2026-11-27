import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import SalesValueChart from '../components/admin/SalesValueChart';
import OrderTrend from '../components/admin/OrderTrend';
import DailyMetricChart from '../components/admin/DailyMetricChart';
import {chartScale,chartDateIndices} from '../lib/chart-scale';
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
test('axis scales cover pennies, high NGN values, zero activity and integer order counts',()=>{
 for(const values of [[0],[.01,.02],[120,2],[350000,450000],[Number.NaN,Infinity,1]]){
  const scale=chartScale(values);
  assert(Number.isFinite(scale.max)&&scale.max>0);
  assert(scale.max>=Math.max(0,...values.filter(Number.isFinite)));
  assert.equal(scale.ticks[0],0);assert.equal(scale.ticks.at(-1),scale.max);
  const labels=scale.ticks.map(value=>value.toFixed(2));assert.equal(new Set(labels).size,labels.length);
 }
 for(const peak of [0,1,3,9,25,125])assert(chartScale([peak],true).ticks.every(Number.isInteger));
});
test('date ticks are sparse on phones and retain both ends of long and short periods',()=>{
 assert.deepEqual(chartDateIndices(0,true),[]);assert.deepEqual(chartDateIndices(1),[0]);
 for(const length of [2,7,30,90]){
  const ticks=chartDateIndices(length,true);assert(ticks.length<=3);assert.equal(ticks[0],0);assert.equal(ticks.at(-1),length-1);
  assert.equal(new Set(ticks).size,ticks.length);
 }
 assert.equal(chartDateIndices(90).length,6);
});
test('sales and order charts share readable axes, independent accessible controls and a zero-based volume scale',()=>{
 const html=renderToStaticMarkup(<><SalesValueChart data={report}/><OrderTrend data={report}/></>);
 assert.match(html,/21 Nov/);assert.match(html,/23 November 2026/);assert.match(html,/Orders over time/);
 assert.match(html,/Previous chart day/);assert.match(html,/Next chart day/);
 assert.match(html,/Select a day in the orders chart/);assert.match(html,/Includes all recorded order statuses/);
 const ids=[...html.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length);
 assert.doesNotMatch(html,/NaN|Infinity/);
});
test('zero and single-day charts keep exact values without inventing a sales curve',()=>{
 const props={title:'Daily value',subtitle:'UTC',formatValue:(v:number)=>`£${v.toFixed(2)}`,formatTick:String,caption:'Paid value',legend:'GBP',description:'Current paid orders',tableLabel:'Figures'};
 const single=renderToStaticMarkup(<DailyMetricChart {...props} points={[{day:'2026-11-23',value:2}]}/>);
 assert.match(single,/£2\.00/);assert.doesNotMatch(single,/<path d="M/);assert.match(single,/type="range"[^>]*disabled/);
 const zero=renderToStaticMarkup(<DailyMetricChart {...props} points={[{day:'2026-11-22',value:0},{day:'2026-11-23',value:0}]}/>);
 assert.match(zero,/£0\.00/);assert.doesNotMatch(zero,/NaN|Infinity/);
});
