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
