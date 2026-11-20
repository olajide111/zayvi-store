# Zayvi storefront directions: handoff pack

Status: for review. Nothing here is applied. Needs sign-off from the named owner before it is merged.

## What to build from (in order of authority)

1. **The Design canvas** "Zayvi storefront directions" (share link from Ola). The prototypes are the source of truth for look, layout and motion. Open the Play desktop and Play mobile links on the Overview board.
2. **`design-source/*.dc.html`** are the exact source files behind every board. They contain the real values: font sizes, spacing, colours, easing and durations, written as inline styles. Copy values from these rather than judging by eye. Files: `<direction>-desktop.dc.html` and `<direction>-mobile.dc.html` are the full prototypes (all four screens, selected by a `screen` setting); `<direction>-<screen>-<device>.dc.html` are the individual boards; `<direction>-spec.dc.html` is each direction's assets, motion and theme mapping. Directions: showroom, editorial, market, atelier, fresh, spec.
3. **`code/zayvi-additional-themes.patch`** adds the theme contracts, tests, admin gallery and a working marketplace preview. Apply on a new branch only.

## Fixed widths used in the designs

Desktop 1440 px, mobile 390 px. Check the build at both.

## Tokens per direction

| Direction | Fonts | Colours |
| --- | --- | --- |
| Fashion showroom | Bricolage Grotesque | floor #E4E0D8, rail #6D6B65, accent #B8330F, text #1B1A18 |
| African editorial | Fraunces, Instrument Sans | paper #FAF5EC, ink #1B1812, accent #B04A22, textile #1F2A5A and #E7B43C |
| Modern marketplace | Plus Jakarta Sans | primary #0B5D3B, accent #F2A900, surface #FAFBF8 |
| Atelier minimal | Cormorant Garamond, Jost | ivory #F7F4EE, ink #111111, stone #CFC8BA |
| Fresh market | Nunito | leaf #2E7D32, accent #E4572E, cream #FFF9EC |
| Spec sheet | IBM Plex Sans, Plex Mono | surface #0B1424, panel #0F1B30, accent #3DA5FF |

All fonts are open licence and should be self-hosted.

## Motion (summary; exact values are in each prototype)

Easing cubic-bezier(.22,.8,.2,1). Showroom garments 0.8 s; editorial image reveal 1.2 to 1.4 s; atelier strip 0.7 s and drawer 0.4 s; marketplace menu 0.2 s, card lift 0.15 s, bag 0.25 s. Only transform and opacity animate. Reduced motion turns all of it off.

## Acceptance checklist ("exactly this design")

- Each screen matches its board at 1440 and 390 px: layout, spacing, type sizes, colours.
- Interactions match the prototype: market switch (GBP and NGN), add to bag, quantity changes, filters and sorting where shown, the strip, drawer or panel behaviour.
- Motion matches the durations above and respects reduced motion.
- All controls are real buttons or links, at least 44 px, with visible focus (WCAG 2.2 AA).
- No invented reviews, ratings, stock counts, popularity or delivery promises. Delivery and returns text says "shown at checkout".
- Existing themes and shared files are untouched.

## Not in the designs, needs decisions

- Photography and cut-outs. The art in the prototypes is drawn placeholder only.
- Real catalogue data each direction needs (see each spec board): showroom cut-outs, editorial photography and cloth notes, marketplace sellers, fresh-market pack sizes and delivery slots, spec-sheet spec fields and quote flow.
- Storing the chosen direction per tenant (a migration or the existing JSON column).
- The prototypes run on a design tool's own runtime, so they show how it should look and behave. They are not React code to copy; port the values.
