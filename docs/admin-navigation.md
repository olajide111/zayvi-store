# Adding dashboard tabs and pages

The navigation registry is `components/admin/admin-navigation.ts`. Desktop navigation, the mobile More menu, page search and active-route matching use the same entries. Do not add separate copies of a tab in those components.

1. Create a Next page at `app/admin/<route>/page.tsx`. Use the installed Next documentation and `AdminPageHeading` for the normal dashboard layout. Add appropriate session and store/owner authorization to any server data or mutation endpoints; a navigation entry alone does not grant access.
2. Add an entry to the appropriate `adminGroups` group. The `title`, `/admin...` `href` and Lucide `icon` are required. Optional search synonyms belong in the same registry's keyword map. A primary mobile tab also needs `label`; the bottom bar currently accommodates five primary pages and More.
3. For nested routes, parent active-state selection is automatic. Register a named child if it needs its own entry; the child takes precedence over the parent.
4. Run `tests/admin-connections.test.ts` with the existing test bundling workflow, then `npm run typecheck` and `npm run build`. The checks reject duplicate destinations, missing pages and entries that cannot be found by title.

Example group entry:

```tsx
{ title: 'Size guides', href: '/admin/size-guides', icon: FileText },
```

This assumes a real `app/admin/size-guides/page.tsx` is also implemented; it does not generate or publish a page automatically.

## Store areas

- **Store Templates** opens the saved starter reference at `/admin/pilots/default`. Its Default Store v1 shopping implementation is retained independently.
- **My Store — Hammy** opens the user's working store workspace at `/admin/pilots/hammy`.
- Future unqualified store changes apply to Hammy. The starter only changes when explicitly requested.
- These dashboard labels do not establish database store identity, owner authorization or live selling readiness. Those remain separate activation requirements.
