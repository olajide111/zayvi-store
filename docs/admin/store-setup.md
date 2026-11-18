# Store setup overview

Store setup reads selling countries and social profiles from the existing authenticated admin APIs. It shows enabled countries, the default country/currency, actual country-switcher visibility and linked social platform names. Social profiles are optional; no saved links means the storefront social section stays hidden.

These cards report saved configuration, not approval to launch. They do not infer payment, delivery, product or production readiness. Each source may fail independently; unavailable or malformed settings show an error, never an empty or completed setup. Refresh rereads both sources, with cancellation on unmount and a 15-second timeout.

The customer-page checklist links Continue setup to the first unpublished page in the selected market. Once all five pages are published, it links to the first page with unpublished draft changes. It shows completion only when all five are published without draft changes. Administrators may still manage content in both markets regardless of which markets are enabled for shoppers.

Validation covers a Nigeria-only store, hidden switcher, one social profile, optional empty links, partial source failure, refresh recovery, invalid market responses, next missing page, published draft changes and phone/desktop layout. All operations added here are read-only.
