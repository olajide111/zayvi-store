# Phone workspace follow-ups

The phone More menu now uses the same focus containment, Escape, scroll-lock and trigger-restoration hook as the shopping dialogs. It has a named dialog and an explicit Close action, and closes when switching to desktop width. Desktop navigation and store preview navigation remain separate.

The growth page has compact shortcuts for payment review, paid/unfulfilled orders, failed payments and returns. They work with the existing orders API while the analytics backend update awaits deployment. Campaign-link fields stay collapsed until requested.

Order queue, payment, fulfilment, order status and GB/NG currency filters round-trip through the URL. Opening a follow-up, refreshing it or returning to it restores the workflow view. Repeated/unknown values fall back to All. Customer name/email/phone searches remain local component state and are never added to these links. Filtering still applies to loaded orders only; these views are not full-database pagination or proof that a metric's entire cohort has loaded.

No backend, secret, migration or payment change is required. Pure navigation tests cover round-trips, malformed/repeated values and exclusion of customer searches/tenant selectors. TypeScript/build checks and the existing storefront suite run before merge. Browser interaction and phone visual checks remain unverified in the socket-restricted local environment.
