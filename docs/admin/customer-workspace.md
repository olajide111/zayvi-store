# Customer workspace

The existing customer-record API now has a phone-oriented read-only workspace. Search combines with order-activity and record-status filters; sorting supports recent activity, number of order records and name. Twenty-five matching records render initially, with Show 25 more for remaining already-loaded records. This is not server pagination: the API still returns at most 250 records.

Each row expands to existing email/phone and first-order/creation dates. Contact details are selectable with clipboard-copy controls and a manual fallback notice. The order-workspace link is deliberately generic: the existing order-list response lacks the customer/store binding needed to promise an exact related-order lookup. No customer search/contact value is put into a URL, sent to analytics or used to send a message.

The API's count includes non-cancelled draft/unpaid order records, so segments say Multiple orders/One order/No orders rather than confirmed repeat purchases. Its unqualified lifetime-value field is not displayed: it lacks a currency breakdown and must not be represented as customer spend. Status is a customer-record status, not proof of a registered user account or marketing consent. Hammy's sample basket remains separate.

Refresh, request timeout/cancellation, retry and empty/no-match states are implemented. No database migration, backend deployment or new secret is needed. Pure tests cover segment/search/status intersections, sorting and unavailable dates; typecheck and production build run separately. Local visual/interactive browser verification remains unavailable because Chromium cannot create its process socket here.
