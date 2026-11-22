<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Default Store and Hammy

The user has retained Default Store version 1 as a separate starter baseline under `app/admin/pilots/default`, `components/pilots/DefaultStoreShop.tsx`, its own CSS, and `lib/default-store-*`. Hammy Store is the customised store under the Hammy paths. Treat future unqualified storefront improvements as Hammy-only. Do not update the Default Store baseline or make it import Hammy implementation/configuration unless the user explicitly requests a baseline change. These previews do not provision stores or enable checkout.

The dashboard must keep Default Store and Hammy Store as separate navigation entries/pages. Default Store is the starter reference; Hammy is the working custom store. The user deferred picture work on 22 November 2026: keep the existing workspace available without making photo enhancements the next development priority.
