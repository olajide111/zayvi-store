<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Default Store and Hammy

The user has retained Default Store version 1 as a separate starter baseline under `app/admin/pilots/default`, `components/pilots/DefaultStoreShop.tsx`, its own CSS, and `lib/default-store-*`. Hammy Store is the customised store under the Hammy paths. Treat future unqualified storefront improvements as Hammy-only. Do not update the Default Store baseline or make it import Hammy implementation/configuration unless the user explicitly requests a baseline change. These previews do not provision stores or enable checkout.

The dashboard must keep Default Store and Hammy Store as separate navigation entries/pages. Default Store is the starter reference; Hammy is the working custom store. The user deferred picture work on 22 November 2026: keep the existing workspace available without making photo enhancements the next development priority.

Dashboard display names are now **Store Templates** for the retained starter and **My Store — Hammy** for the working customised store. Keep the internal baseline paths/identities unchanged. Add future dashboard navigation in `components/admin/admin-navigation.ts`; desktop, mobile and page search share that registry.

Hammy shopping should keep customers browsing: product quick view must preserve the collection context, successful add-to-basket should show a non-modal confirmation and must not automatically open a basket drawer or cart page. The agreed sales-growth build order is store identity/access → real catalogue/checkout → abandoned-cart recovery → bundles/offers → customer-care automation. Basic delivery, returns and support are launch prerequisites within checkout, not deferred to the final automation phase. Record actual verification before advancing; a preview UI is not a connected selling integration.

Hammy uses SVG icons only for functional controls; avoid emoji and Unicode glyph icons. Prefer clear text labels and omit unnecessary decorative icons.
