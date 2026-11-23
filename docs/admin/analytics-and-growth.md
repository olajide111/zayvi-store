# Analytics and sales growth

The dashboard now has period and market filters, equal-duration prior-period comparisons, a daily order chart with a data table, per-currency order values/averages and CSV export. Marketing & sales growth is registered in the shared desktop/mobile/search navigation. Its follow-ups use recorded unpaid, failed, paid/unfulfilled and refunded orders; links open existing order, payment and returns workflows. A campaign-link builder creates UTM-labelled public HTTPS URLs without sending or publishing campaigns.

The sales-value chart appears on the overview dashboard and detailed analytics page. It shows daily currently-paid order value for one market/currency at a time. Touch the plot or use its labelled day slider for exact values; a data table provides the same figures. Zero-order days are filled as zero only when a v2 daily report is present. A legacy all-time response displays an explicit graph-awaiting-data notice instead of inventing daily values. The existing order-count chart remains separate. For All time, both charts cover the last 90 days while all-time headline metrics retain their full scope. The overview reuses its existing analytics response and respects its market selector; it makes no additional backend request for the chart.

## Measurement contract

`GET /analytics?range=7d|30d|90d|all&market=all|GB|NG` uses the existing trusted commerce tenant transaction. Default parameters preserve all-time/all-market compatibility for the existing overview. It accepts no tenant selector. Start bounds are inclusive and end bounds exclusive; UTC is explicit. Comparisons cover the same duration immediately before the current period. Current statuses are evaluated for orders **created** in those periods, not payments made during the periods. These cohort values can change after later reconciliation/refunds.

GBP and NGN are never summed. Paid order value includes only orders currently marked paid. Partially/fully refunded orders are excluded; their full order values are not actual refund amounts. The report makes no net-revenue/profit, visitor conversion, abandoned-cart, acquisition-cost or campaign-attribution claim. Unpaid orders are not proof of abandoned checkouts or permission to message a customer.

The existing legacy commerce workspace supplies these figures. Hammy's sample catalogue/basket is not its data source. New seller/store analytics must use the eventual owner-scoped boundary; a request-supplied store ID must not become a tenant binding.

## Release and verification

No database migration is required. The updated commerce Lambda package must be applied through the existing Preview saved-plan process before schema-v2 filters/comparisons become available online. Preserve Cognito owner configuration, webhook-secret ARN and alarm-topic ARN in private Preview inputs. Review the whole plan; do not use targeting or ignore overrides to hide unrelated changes. The frontend keeps the old all-time report visible with filters/export disabled until the backend confirms the v2 response and exact requested filters.

Local PostgreSQL tests check date boundaries, prior cohorts, all-time compatibility, tenant RLS, empty periods, market filtering across every report section, currency separation and refund definitions. Pure tests check zero-baseline comparisons, gap-filled order counts, CSV formula protection and campaign URL validation/parameter preservation. TypeScript, the production web build and commerce Lambda bundle are checked separately. Browser visual validation is pending because local Chromium cannot create its required process socket in this environment.

Before considering this live-verified: apply the reviewed API-only Preview change, confirm both markets/ranges and CSV against known Preview orders, exercise refresh/error/empty states on phone/tablet/desktop and compare an order creation time at a filter boundary. Existing test-mode fulfilment restrictions remain unchanged. No campaigns, recovery messages, offers or real payments are enabled by this release.
