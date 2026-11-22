# Hammy saved selections

Hammy's preview basket now offers Save for later. It moves the complete product/size/colour/quantity selection into a saved list below the full basket. Move to basket merges matching selections under the same quantity cap. Validation happens before removing the original line, so an overflow cannot lose either selection. Saving does not open a basket or change the current collection. The compact drawer links to saved items instead of duplicating another list.

The browser stores both lists in one `zayvi-hammy-shopping-v2` session-storage snapshot. Existing `zayvi-hammy-demo-bag-v1` selections are read on first use when no v2 snapshot exists. Stored values are validated against the sample catalogue; browser-supplied prices/totals, foreign-store products and unsupported variants are rejected. Default Store has independent products, navigation and basket storage and is unchanged.

This is a preview convenience, not an account wishlist, abandoned-cart service, stock reservation or connected selling flow. No selections are sent to analytics or messaging. Phone/tablet layouts use a single column; larger screens show two. Keyboard focus moves to the saved/returned item or the next available action, with existing basket announcements retained.

The `test:storefront` command now runs the existing Hammy shopping/quick-view/cart/pilot and Default Store isolation tests in CI. It uses SSR class-name substitutes for CSS modules and is not visual/browser validation. Separate pure tests cover save/restore, matching-option merges, quantity overflow, state immutability and storage validation. Live browser checks remain pending because this environment blocks Chromium's process socket.
