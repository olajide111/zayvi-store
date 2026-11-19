# Orders workspace

Payment status, fulfilment status, order status and currency filters are independent and combine with order/customer/email search. The list labels each status explicitly. Refunded and partially refunded payments can be selected directly; a cancelled order may still show a failed payment status because payment and order state are separate.

Summary cards apply the selected currency before search/status filters. Order value includes all payment statuses and is grouped by currency; it is not revenue. Counts and totals cover the loaded order set, not an all-time report. The current AWS list endpoint returns at most the latest 250 orders.

Refresh orders rereads the existing authenticated API while retaining filters. Successful loads show a London-time refresh timestamp. Loading, failure and malformed responses suppress previous summary values and the list; failure offers Retry loading orders. Requests time out after 15 seconds and abort when leaving the page. Refresh does not verify a provider payment or alter an order.

Browser checks cover combined status/currency filters, refunds and cancellation, empty matches and reset, refreshed orders, failed/malformed responses and recovery, separate GBP/NGN totals, detail links and phone/desktop layout. Payment/fulfilment mutation APIs are unchanged.
