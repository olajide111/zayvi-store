import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import test from 'node:test';
import assert from 'node:assert/strict';
import {ALL_STUDIO_THEMES} from '../lib/theme-registry';
import ThemedShop from '../components/themes/ThemedShop';
test('every theme renders a catalogue loading state without substituting sample products',()=>{
 for(const theme of ALL_STUDIO_THEMES){
  const html=renderToStaticMarkup(<ThemedShop theme={theme} brand="Merchant" headline="" motion="off" font="sans" view="collection" source="store" palette="theme"/>);
  assert.match(html,/Loading your store/ ,theme.id);
  assert.doesNotMatch(html,/DEMO STORE · SAMPLE PRODUCTS/,theme.id);
  assert.match(html,/NO ORDERS OR PAYMENTS/,theme.id);
  assert.match(html,/Merchant/,theme.id);
 }
});
