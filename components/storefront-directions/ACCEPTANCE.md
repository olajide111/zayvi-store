# Additional directions review record

This work is additive on `codex/additional-storefront-directions`. It starts from `0e61775375a2ab0f30cc5008c23ad2c17ffc74c4`. No pre-existing theme, renderer, navigation, package manifest, API, database or infrastructure file is modified. The editor foundation PR remains separate.

## Sources and port

The supplied ZIP's patch exactly matches the separately attached patch. The patch was applied on this review branch. It supplied six direction contracts but only a simplified marketplace renderer; the five missing renderers and all exact board layouts were then ported from the exported `.dc.html` sources. Every exported source, including canvas.json and individual screen boards, is retained byte-for-byte in `source/`. The public canvas URL could not be fetched in this session; no visual parity certification is claimed.

`generated/` contains React ports of all twelve desktop/mobile prototypes. Inline dimensions, spacing, colours, easing and durations come from those exports. State logic is compiled source in normal React modules, not runtime eval, innerHTML injection or a design-tool runtime. Fonts are self-hosted Latin/Latin-extended WOFF2 subsets; original OFL licences are in `fonts/`.

## Verification

| Acceptance item | Result |
| --- | --- |
| Existing themes/shared files unchanged | Verified against the baseline Git tree; only isolated new paths |
| Four screens × six directions × two device boards | 48 server renders pass without unresolved bindings |
| GBP/NGN and bag increment/decrement | 36 assertions pass on all twelve board ports |
| Theme contracts and validation | All six supplied contract tests pass |
| Fonts and licences | Local WOFF2 subsets and nine OFL files included |
| Checkout/PayPal/quote safety | Capture guard reports preview-only; no backend/payment calls |
| 1440/390 previews | Dedicated fixed-width iframe modes with fit/actual-size controls |
| Exact pixel parity, touch/swipe/focus and motion on real browsers | Pending visual/browser review; build/SSR tests do not establish this |
| Owner sign-off and merge | Pending; no merge or publishing performed |
| Real photography and catalogue data | Not supplied; original drawn/gradient placeholders retained and labelled |

## Deliberate adaptations for acceptance

- Only transform/opacity animate: the showroom's original animated `top` coordinate is folded into its transform; the marketplace shadow changes without animation.
- Minimum 44px control targets and visible focus override smaller source targets; reduced-motion overrides are local to the canvas iframe.
- Marketplace/spec/fresh search inputs gain local query filtering where the source only drew inputs. The fresh slot cards are illustrative; desktop selection only changes local demo state and never reserves a delivery slot.
- A persistent sample banner and checkout/quote feedback surround the design. Nothing is sent, charged, reserved or published.
- Device/start-screen changes restart source sample state; device previews are simulations rather than native-device tests.

## Run checks

- `npm run build`
- `node components/storefront-directions/zdx-port-validation.cjs`
- `node --import tsx --test tests/storefront-theme-directions.test.ts` where tsx is available (not added as a project dependency).

All additions are for owner review. Tenant persistence, entitlements, real product assets and production commerce integration require separate work.

## Owner-requested implementation into Preview

The owner subsequently requested implementation. The integration uses `lib/theme-registry.ts` to append the six direction IDs to the main gallery while retaining the original 20 definitions byte-for-byte. The existing editor and device-demo routes dispatch new IDs to the isolated source-derived renderers. Brand, safe colour presets/custom tokens, typography and motion preview controls are connected for platform admins; browser drafts remain local and keyed by the new ID. Original board review URLs remain available.

This implementation also includes the editor foundations from PR #49. The previous additive-only file rule now permits the narrow gallery/editor/route hooks and foundation helpers; theme definitions and normal default rendering are preserved. Registry tests check unchanged source bytes and unique IDs. No production deployment, database migration, payment activation or publication is included. New directions are labelled plan-pending rather than silently assigning a free or paid entitlement. Data-backed product rendering and per-tenant publishing still require their declared catalogue contracts.

## Modern African Marketplace refinement

User requested a stronger marketplace experience after the source-board integration. Only `modern-marketplace` now uses the responsive `ZdxMarketplacePreview` renderer; the supplied source files and generated reference ports are preserved, and the other five directions and original twenty themes are unchanged.

- Added textile photography from the existing credited demo-photo collection, original product-specific sample SVG illustrations, department discovery, seller directory, saved finds and mobile navigation.
- Search matches product, department, seller and description; department and seller filters combine, with explicit empty states and market-specific price sorting.
- Bag starts empty, combines quantities, groups sample sellers, supports removal, and recalculates explicit GB/NG sample prices. Bag and saved finds last only for the mounted demo session.
- Brand, palette and font controls still feed the renderer. Motion-off and system reduced-motion settings suppress transitions.
- Preview content remains fictional/sample. No catalogue writes, orders, delivery calculations, payment execution or publish/entitlement changes were introduced.
- Validation: Next production build; marketplace model tests; SSR smoke tests for four initial screens and custom appearance; existing registry/contract/colour tests and reference-port smoke tests. Live browser visual review remains pending.

## Fresh Market, African Editorial and Spec Sheet refinements

The owner requested three distinct improvements after approving the marketplace direction. These three IDs now use responsive renderers in `ZdxRefinedStorefronts.tsx`. The source exports and generated reference ports are kept intact.

- **Fresh Market:** warm illustrated harvest, four aisle cards, pack/unit prices, inline quantity controls, desktop basket, mobile basket bar and a four-item pantry bundle. Delivery slots are explicitly unconnected; the demo never reserves one.
- **African Editorial Boutique:** oversized magazine typography, textile photography, asymmetric numbered garment plates, cloth journal and material notes. Size selection is required, and different sizes remain separate bag lines. Illustrations are labelled as concepts, with no claim that the sample photographs depict the garments or their makers.
- **Spec Sheet:** dark technical workbench, equipment illustrations, searchable model/SKU/specification index, up-to-three-product comparison, visible missing fields and a sample quote list. No datasheets, compatibility guarantees or real quote submission are fabricated.
- Shared controls continue to support custom brand, palette and fonts; system reduced motion and the existing motion-off control suppress animation/transitions. Search/filter/sort, explicit UK/Nigeria prices, quantities, removals and empty states work within each mounted demo. No persistence or live catalogue integration is implied.
- Validation: production build; 19 data/model/registry/colour/contract tests; 12 SSR initial-screen renders plus custom appearance checks for all three themes; prior marketplace/reference-port checks. Live browser visual review remains pending.
- The refined Modern African Marketplace, Fashion Showroom, Atelier Minimal and original twenty theme definitions are unchanged by this refinement. Access tiers, billing, checkout, database and infrastructure remain outside this change.

## Fresh Market motion simulation

Owner requested a more lifelike shopping simulation. Fresh Market now has gentle harvest motion, shelf entrance and quantity/total feedback, product illustrations flying to a visible basket target, selected-item markers, an always-visible basket dock and a native modal basket drawer. The drawer supports in-place quantity changes/removal and a separate full basket review. Basket updates do not wait for animations; decorative flights are bounded during rapid taps and cleaned up when the component unmounts or motion is disabled.

The local motion toggle, Studio motion-off wrapper and OS reduced-motion preference all suppress decorative effects. Native dialog behaviour provides modal focus containment, Escape handling and focus restoration; background scrolling is locked while open. Basket updates have a polite screen-reader status. No payment or ordering flow is activated.

Validation: production build and typecheck; existing 19 model/registry/contract/colour tests; motion preference gate test; SSR checks include the closed native dialog, basket target and motion control. Live browser interaction/animation and visual review remain pending. Other directions retain their previous layout and behaviour.

## Theme naming and Oja basket drop refinement

The six added display names are now Runway (fashion-showroom), Ilé (african-editorial), Soko (modern-marketplace), Forma (atelier-minimal), Oja (fresh-market), and Volt (spec-sheet). Route IDs and saved-draft keys stay stable. Original twenty theme names/definitions remain intact.

Oja now uses aubergine, coral and cream, with its registry/editor primary matching the renderer. Custom palette controls still take priority. The basket dock has a larger open basket illustration. Produce is rendered at 176 px on phones / 208 px on larger viewports, lifted before travelling, held at near-full size, and dropped vertically with clipping into the basket mouth instead of shrinking to a tiny dot. Basket quantity state remains independent of decorative motion.

Validation: production build; 22 model, motion, registry, contract and colour tests including stable naming, palette defaults and readable pick/drop geometry; refined-theme SSR checks. Live browser visual review remains pending.

## Forma, Adire, Accra and gallery curation

The owner explicitly requested reworking the previously protected Adire and Accra themes. The regression guard now excludes only those two definition lines and continues to compare the other eighteen original definitions byte for byte. Adire and Accra remain free, with stable IDs.

- **Forma:** glacier blue and deep petrol, a single-piece showcase with previous/next and keyboard arrows, a horizontal six-piece wardrobe, material concepts and size-specific bags. The default palette matches gallery/editor settings and continues to support custom colours/fonts/motion. Source boards and generated reference ports remain intact.
- **Adire:** charcoal and marigold, a portrait-led attire-house layout, occasion/attire navigation and six original SVG garment concepts (agbada, iro-and-buba, boubou, kaftan, wrap and gele). These are labelled sample illustrations, not product photos or provenance claims.
- **Accra:** cobalt and tangerine, a city poster and staggered product blocks, department matrix and six everyday-retail demo products. It no longer shares Adire’s textile demo catalogue or homepage layout. Store-source mode still uses the actual public catalogue through the existing loader.
- **Gallery:** five curated groups cover all 26 themes once: African signatures; fashion/considered spaces; immersive/premium; everyday retail/home; equipment/trade. Existing search, industry, style and access filters apply before grouping. Live thumbnail iframes now show Adire and Accra’s actual designs.

Validation: production build/typecheck, 24 model/motion/registry/contract/colour tests, sixteen refined-theme screen renders/custom appearances, distinct African-shop SSR checks and six parsed local SVG assets. Native browser visual review remains pending. No tenant publication, live checkout, payment, database or infrastructure changes.

## London signatures: Mayfair and Camden

Added two free London-inspired signature previews as peers to the African signatures. These are separate registry entries (`mayfair`, `camden`), not replacements for any existing theme or changes to the six direction contracts. The gallery now has 28 themes in six groups, with a dedicated London signatures group.

- **Mayfair:** oyster, claret and a warm stone wardrobe; balanced house-style masthead, an original architectural illustration, framed garment plate, switchable wardrobe chapters and a six-piece tailoring/accessory edit.
- **Camden:** signal red, asphalt and chalk; graphic campaign typography, a switchable style edit, inspiration photography clearly separated from illustrated product concepts, category blocks and a six-piece streetwear edit.
- Both default to GBP but have explicit GBP and NGN sample prices. Market switching retains selected basket items/variants. Search, categories, sort, sizes, bag quantities, removals and empty states use the existing demo engine. Neither theme implies British product origin or an actual London retail address.
- The editor exposes brand, palette, font and motion controls, with local drafts. Unsupported live catalogue/headline controls are hidden. These previews create no orders or payments and are not tenant publishing integrations.
- Validation: production build/typecheck; 26 model/motion/registry/contract/colour tests; 24 initial-screen/custom-appearance SSR renders, plus existing African-shop checks. Native browser visual review remains pending because Preview is protected; no share link or authentication change was requested for this update.
