import test from 'node:test';
import assert from 'node:assert/strict';
import {ALL_STUDIO_THEMES} from '../lib/theme-registry';
import {themePreviewEngine,usesSharedCatalogue} from '../lib/theme-preview-engine';
test('all registered themes route real catalogue requests through the catalogue adapter',()=>{
 assert.equal(ALL_STUDIO_THEMES.length,31);
 for(const theme of ALL_STUDIO_THEMES)assert.equal(themePreviewEngine(theme,'store'),'catalogue',theme.id);
});
test('distinctive demos retain their own renderers',()=>{
 for(const theme of ALL_STUDIO_THEMES){
  assert.equal(themePreviewEngine(theme,'demo'),theme.signatureFamily?'signature':theme.directionFamily?'direction':'catalogue',theme.id);
  assert.equal(usesSharedCatalogue(theme),Boolean(theme.signatureFamily||theme.directionFamily));
 }
});
