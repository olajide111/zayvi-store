const { parseAnalyticsQuery } = require('../../lib/analytics-query.cjs');
const day = 86400000;
const columns = `COUNT(*)::int AS order_count,
  COUNT(*) FILTER (WHERE payment_status='paid')::int AS paid_orders,
  COUNT(*) FILTER (WHERE payment_status='pending')::int AS pending_orders,
  COUNT(*) FILTER (WHERE payment_status='unpaid')::int AS unpaid_orders,
  COUNT(*) FILTER (WHERE payment_status='failed')::int AS failed_orders,
  COUNT(*) FILTER (WHERE payment_status='partially_refunded')::int AS partial_refunds,
  COUNT(*) FILTER (WHERE payment_status='refunded')::int AS refunded_orders,
  COUNT(*) FILTER (WHERE payment_status='paid' AND fulfilment_status='unfulfilled')::int AS awaiting_fulfilment,
  COUNT(*) FILTER (WHERE order_status='cancelled')::int AS cancelled_orders`;
const where = `tenant_id=$1::uuid AND ($2::timestamptz IS NULL OR created_at >= $2::timestamptz)
  AND created_at < $3::timestamptz AND ($4::text='all' OR market_code=$4::text)`;
const orders = (r = {}) => ({total:Number(r.order_count||0),paid:Number(r.paid_orders||0),pending:Number(r.pending_orders||0),
  unpaid:Number(r.unpaid_orders||0),failed:Number(r.failed_orders||0),partiallyRefunded:Number(r.partial_refunds||0),
  refunded:Number(r.refunded_orders||0),awaitingFulfilment:Number(r.awaiting_fulfilment||0),cancelled:Number(r.cancelled_orders||0)});
async function period(tx, args) {
  const summary = await tx.query(`SELECT ${columns} FROM commerce_orders WHERE ${where}`, args);
  const markets = await tx.query(`SELECT market_code,currency_code,${columns},
    COALESCE(SUM(total) FILTER (WHERE payment_status='paid'),0)::numeric AS paid_value,
    COALESCE(SUM(total) FILTER (WHERE payment_status IN ('partially_refunded','refunded')),0)::numeric AS refunded_order_value
    FROM commerce_orders WHERE ${where} GROUP BY market_code,currency_code ORDER BY market_code,currency_code`,args);
  return {orders:orders(summary.rows[0]),markets:markets.rows.map(r=>({marketCode:r.market_code,currency:r.currency_code,
    orderCount:Number(r.order_count),paidOrders:Number(r.paid_orders),paidValue:Number(r.paid_value),
    refundedOrderValue:Number(r.refunded_order_value),unpaidOrders:Number(r.unpaid_orders),failedOrders:Number(r.failed_orders),
    refundedOrders:Number(r.refunded_orders)+Number(r.partial_refunds),awaitingFulfilment:Number(r.awaiting_fulfilment),
    paidAverageOrderValue:Number(r.paid_orders)>0?Number(r.paid_value)/Number(r.paid_orders):null}))};
}
/** Runs only within the existing trusted tenant transaction; callers cannot choose a tenant. */
async function queryCommerceAnalytics(tx, tenantId, input = {}, now = new Date()) {
  const filters = parseAnalyticsQuery(input),to = now.toISOString();
  const days = filters.range==='all'?null:Number(filters.range.slice(0,-1));
  const from = days===null?null:new Date(now.getTime()-days*day).toISOString();
  const args = [tenantId,from,to,filters.market];
  const current = await period(tx,args);
  const previous = days===null?null:await period(tx,[tenantId,new Date(now.getTime()-days*day*2).toISOString(),from,filters.market]);
  const trendFrom = from||new Date(now.getTime()-90*day).toISOString();
  const daily = await tx.query(`SELECT to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD') AS day,
    market_code,currency_code,${columns},COALESCE(SUM(total) FILTER (WHERE payment_status='paid'),0)::numeric AS paid_value
    FROM commerce_orders WHERE ${where} GROUP BY day,market_code,currency_code ORDER BY day,market_code,currency_code`,
    [tenantId,trendFrom,to,filters.market]);
  const recent = await tx.query(`SELECT id,order_number,market_code,currency_code,total,payment_status,fulfilment_status,created_at
    FROM commerce_orders WHERE ${where} ORDER BY created_at DESC,id DESC LIMIT 20`,args);
  return {schemaVersion:2,scope:'existing_commerce_workspace',filters,period:{from,to,timezone:'UTC'},
    ...current,previous,daily:daily.rows.map(r=>({day:r.day,marketCode:r.market_code,currency:r.currency_code,
      orderCount:Number(r.order_count),paidOrders:Number(r.paid_orders),paidValue:Number(r.paid_value)})),trendFrom,
    recentOrders:recent.rows.map(r=>({id:r.id,orderNumber:r.order_number,marketCode:r.market_code,currency:r.currency_code,
      total:Number(r.total),paymentStatus:r.payment_status,fulfilmentStatus:r.fulfilment_status,createdAt:r.created_at})),
    measurement:{basis:'Orders created in the selected period, using their current status.',
      paidValue:'Total value of orders currently marked paid; excludes partially and fully refunded orders.',
      refunds:'Refunded-order value is the full order value, not the actual amount refunded.',
      trafficAvailable:false,campaignAttributionAvailable:false,profitAvailable:false}};
}
module.exports = {queryCommerceAnalytics};
