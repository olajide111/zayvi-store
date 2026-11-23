import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {queryCommerceAnalytics} from '../infra/lambda/commerce-analytics';
import {parseAnalyticsQuery} from '../lib/analytics-query.cjs';
import {analyticsCsv,dailyOrderSeries,dailyPaidValueSeries,growthActions,percentageChange,type AnalyticsReport} from '../lib/analytics-report';
import {buildCampaignLink} from '../lib/campaign-links';
const tenant='11111111-1111-1111-1111-111111111111',foreign='22222222-2222-2222-2222-222222222222';
const now=new Date('2026-11-22T12:00:00Z');
test('analytics filters and cohorts against PostgreSQL with forced tenant RLS',async t=>{
  const db=new PGlite();await db.waitReady;
  try{
    await db.exec(`CREATE ROLE analytics_app NOLOGIN NOSUPERUSER NOBYPASSRLS;
      CREATE TABLE commerce_orders(id text PRIMARY KEY,tenant_id uuid,order_number text,market_code char(2),currency_code char(3),
        total numeric(20,4),payment_status text,fulfilment_status text,order_status text,created_at timestamptz);
      ALTER TABLE commerce_orders ENABLE ROW LEVEL SECURITY;ALTER TABLE commerce_orders FORCE ROW LEVEL SECURITY;
      CREATE POLICY tenant_scope ON commerce_orders USING(tenant_id::text=NULLIF(current_setting('app.tenant_id',true),''));
      GRANT SELECT ON commerce_orders TO analytics_app;`);
    const rows=[
      ['one',tenant,'GB','GBP',100,'paid','2026-11-21T12:00:00Z'],
      ['two',tenant,'NG','NGN',5000,'paid','2026-11-20T12:00:00Z'],
      ['three',tenant,'NG','NGN',3000,'partially_refunded','2026-11-19T12:00:00Z'],
      ['four',tenant,'NG','NGN',6000,'unpaid','2026-11-18T12:00:00Z'],
      ['five',tenant,'GB','GBP',20,'failed','2026-11-17T12:00:00Z'],
      ['previous',tenant,'GB','GBP',75,'paid','2026-10-13T12:00:00Z'],
      ['foreign',foreign,'GB','GBP',999,'paid','2026-11-21T12:00:00Z'],
      ['boundary',tenant,'GB','GBP',80,'paid','2026-10-23T12:00:00Z'],
      ['future',tenant,'GB','GBP',900,'paid','2026-11-22T12:00:00Z'],
    ];
    for(const row of rows)await db.query("INSERT INTO commerce_orders VALUES($1,$2,$1,$3,$4,$5,$6,'unfulfilled','confirmed',$7)",row);
    await db.exec('SET ROLE analytics_app');await db.query("SELECT set_config('app.tenant_id',$1,false)",[tenant]);
    const tx={query:(sql:string,args:unknown[])=>db.query<Record<string,unknown>>(sql,args)};
    const report=await queryCommerceAnalytics(tx,tenant,{range:'30d',market:'all'},now) as AnalyticsReport;
    await t.test('rolling periods include the start and exclude the end without cross-tenant rows',()=>{
      assert.equal(report.orders.total,6);assert.equal(report.orders.paid,3);assert.equal(report.orders.unpaid,1);
      assert.equal(report.orders.partiallyRefunded,1);assert.equal(report.orders.awaitingFulfilment,3);
      assert.equal(report.previous?.orders.total,1);assert.equal(report.period.from,'2026-10-23T12:00:00.000Z');
      assert(!report.recentOrders.some(r=>['foreign','future','previous'].includes(r.id)));
    });
    await t.test('currencies and refunded order values remain separate, not invented net revenue',()=>{
      const gb=report.markets.find(m=>m.currency==='GBP')!,ng=report.markets.find(m=>m.currency==='NGN')!;
      assert.equal(gb.paidValue,180);assert.equal(gb.paidAverageOrderValue,90);assert.equal(ng.paidValue,5000);
      assert.equal(ng.refundedOrderValue,3000);assert.equal(report.measurement.trafficAvailable,false);
      assert.equal(report.measurement.campaignAttributionAvailable,false);
    });
    await t.test('market filtering applies to summaries, comparisons, charts and recent rows',async()=>{
      const ng=await queryCommerceAnalytics(tx,tenant,{range:'30d',market:'NG'},now);
      assert.equal(ng.orders.total,3);assert.equal(ng.previous?.orders.total,0);assert.equal(ng.markets.length,1);
      assert(ng.daily.every((r:{marketCode:string})=>r.marketCode==='NG'));assert(ng.recentOrders.every((r:{marketCode:string})=>r.marketCode==='NG'));
    });
    await t.test('all-time preserves the legacy shape and has no misleading prior comparison',async()=>{
      const all=await queryCommerceAnalytics(tx,tenant,{},now);assert.equal(all.orders.total,7);assert.equal(all.previous,null);
      assert.equal(all.period.from,null);assert.equal(all.filters.range,'all');
    });
    await t.test('RLS blocks changing the query tenant and empty periods return honest zeros',async()=>{
      const other=await queryCommerceAnalytics(tx,foreign,{range:'7d'},now);assert.equal(other.orders.total,0);assert.deepEqual(other.markets,[]);
      const empty=await queryCommerceAnalytics(tx,tenant,{range:'7d'},new Date('2025-01-01T00:00:00Z'));assert.equal(empty.orders.total,0);assert.deepEqual(empty.daily,[]);
    });
    await t.test('daily counts fill gaps without mixing money and export keeps currency labels',()=>{
      const series=dailyOrderSeries(report);assert.equal(series.reduce((n,p)=>n+p.orders,0),6);assert(series.some(p=>p.orders===0));
      const csv=analyticsCsv(report);assert(csv.includes('"GBP"'));assert(csv.includes('"NGN"'));assert(csv.includes('not refund amount'));
      assert.equal(percentageChange(4,2),100);assert.equal(percentageChange(2,0),null);
      assert.equal(growthActions(report).find(a=>a.key==='payment')?.count,1);
      assert(analyticsCsv({...report,markets:[{...report.markets[0],marketCode:'=HYPERLINK("bad")'}]}).includes("'=HYPERLINK"));
    });
    await t.test('sales graph separates GBP from NGN and zero-fills days without paid orders',()=>{
      const gb=dailyPaidValueSeries(report,'GB','GBP'),ng=dailyPaidValueSeries(report,'NG','NGN');
      assert.equal(gb.reduce((sum,p)=>sum+p.value,0),180);assert.equal(ng.reduce((sum,p)=>sum+p.value,0),5000);
      assert.equal(ng.find(p=>p.day==='2026-11-19')?.value,0);assert(gb.some(p=>p.value===0));
      assert(dailyPaidValueSeries(report,'GB','NGN').every(p=>p.value===0));
      assert.deepEqual(gb.map(p=>p.day),ng.map(p=>p.day));
    });
  }finally{await db.close();}
});
test('invalid filters are rejected before queries can execute',()=>{
  for(const input of [{range:'forever'},{market:'US'},{range:['7d','30d']},{market:'NG\' OR TRUE --'}])assert.throws(()=>parseAnalyticsQuery(input));
});
test('campaign links preserve product selections and replace duplicate tracking fields safely',()=>{
  const input={destination:'https://shop.example/products/shirt?size=L&utm_source=old&utm_source=duplicate#details',source:'instagram',medium:'social',campaign:'winter collection',content:'video-a'};
  const result=new URL(buildCampaignLink(input));assert.equal(result.searchParams.get('size'),'L');assert.equal(result.hash,'#details');
  assert.deepEqual(result.searchParams.getAll('utm_source'),['instagram']);assert.equal(result.searchParams.get('utm_campaign'),'winter collection');
  for(const destination of ['javascript:alert(1)','http://shop.example','https://user:secret@shop.example','https://shop.example/admin/orders','https://shop.example/api/orders'])assert.throws(()=>buildCampaignLink({...input,destination}));
  assert.throws(()=>buildCampaignLink({...input,campaign:''}));
});
