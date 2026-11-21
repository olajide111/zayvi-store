import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import { adminGroups, adminPrimary } from '../components/admin/admin-navigation';
import { ALL_STUDIO_THEMES } from '../lib/theme-registry';
import { THEME_GALLERY_GROUPS } from '../components/themes/theme-gallery-groups';

test('every dashboard navigation destination has a page', () => {
  for (const { href } of [...adminPrimary, ...adminGroups.flatMap(group => [...group.items])]) {
    assert.ok(existsSync(`app${href}/page.tsx`), `Missing dashboard destination: ${href}`);
  }
});

test('every theme has one gallery entry and shared editor, demo and preview routes', () => {
  const groups = THEME_GALLERY_GROUPS.flatMap(group => group.ids);
  assert.equal(new Set(ALL_STUDIO_THEMES.map(theme => theme.id)).size, ALL_STUDIO_THEMES.length);
  for (const theme of ALL_STUDIO_THEMES) assert.equal(groups.filter(id => id === theme.id).length, 1, theme.id);
  for (const suffix of ['', '/demo', '/preview']) {
    const source = readFileSync(`app/admin/themes/[themeId]${suffix}/page.tsx`, 'utf8');
    assert.match(source, /theme-registry/);
    assert.match(source, /notFound/);
  }
});
