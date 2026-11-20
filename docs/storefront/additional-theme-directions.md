# Additional storefront directions

Status: proposed, not applied. Needs sign-off from the named owner before it is merged or used.

## What this adds

Six storefront directions that sit beside the existing six template families. Nothing existing was changed: `lib/storefront-theme.ts`, `app/admin/themes/page.tsx` and the theme migration are untouched.

| Direction | Builds on | Best for |
| --- | --- | --- |
| Fashion showroom | editorial | Clothing and accessories with cut-out photography |
| African editorial boutique | editorial | Fashion, textiles, homeware and craft with strong photography |
| Modern African marketplace | general-commerce | Large catalogues and multiple sellers |
| Atelier minimal | editorial | Small premium ranges |
| Fresh market | grocery | Food and repeat orders |
| Spec sheet | product-specification | Electronics, solar, tools, trade buyers |

Each direction has its own navigation, page composition, product layout, collection layout, bag layout, fonts and colour tokens. The designs, prototypes, asset lists and motion notes are on the Design canvas "Zayvi storefront directions".

## What is in the code

- `lib/storefront-theme-directions.ts`: the closed lists (families, layouts, section types), the catalogue, a default theme per direction and `validateDirectionTheme`. It reuses the existing validator for shared fields (brand, localisation, schema version), so existing rules apply unchanged.
- `tests/storefront-theme-directions.test.ts`: checks every default validates, nothing collides with the existing families, the existing system still behaves the same, and bad input is rejected.
- `app/admin/themes/directions/page.tsx` and `[family]/page.tsx`: a read-only gallery and a preview page per direction. They cannot publish anything.
- `components/storefront-directions/`: preview components with sample content, all prefixed `Zdx` so names cannot collide with the Zayvi team's code. Only the marketplace direction has a built preview so far; the other five show a "designed, renderer not built" notice.

## What is not in the code

- No live renderer. No storefront page uses these directions. The admin preview is sample content only.
- No database change. Saving a direction theme needs a decision on how to store the extra fields (a new migration or the existing JSON column).
- No change to the live store, Vercel, AWS or any account.

## Rules kept

Theme data is untrusted input and is checked against closed lists, never evaluated. No arbitrary HTML, CSS or script. No invented reviews, popularity, stock or delivery claims. WCAG 2.2 AA. Reduced motion respected.

## Needs before a direction can go live

- Showroom: cut-out product images. Editorial: art-directed photography and maker approval for any community-specific pattern. Marketplace: seller records (vendor portal). Fresh market: pack size and unit price per product, and delivery slots from the shipping engine. Spec sheet: structured spec fields and a quote-request flow.

## How clashes are avoided

- Every new file is in a new path: `lib/storefront-theme-directions.ts`, `components/storefront-directions/`, `app/admin/themes/directions/`, one new test and this doc.
- No existing file is edited, including `globals.css`, `layout.tsx` and the existing theme files. A test fails if the change touches anything outside those paths.
- Component and constant names use the `Zdx` / `ZDX_` prefix. Styling uses Tailwind utilities only, with no global CSS and no new fonts.
- Preview limitation: fonts are the page's current fonts. The distinct font choices apply when a renderer is approved.
